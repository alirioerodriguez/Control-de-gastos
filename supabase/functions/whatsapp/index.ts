// Función de Supabase: webhook de la Cloud API de WhatsApp (Meta) para "Mis Cuentas por WhatsApp" (plan Plus).
// El usuario le escribe al número de Mis Cuentas (texto, audio o foto del ticket) y el gasto se guarda en su cuenta.
//   GET  → verificación del webhook (hub.verify_token = WHATSAPP_VERIFY_TOKEN).
//   POST → mensajes. Se valida X-Hub-Signature-256 con WHATSAPP_APP_SECRET, se responde 200 enseguida
//          y el mensaje se procesa en segundo plano.
// Texto: primero el intérprete local (el mismo del dictado); si no encuentra el monto, Gemini.
// Audio y fotos: Gemini (GEMINI_API_KEY). Cada carga lleva origen 'whatsapp' y origen_ref 'wa:<id del mensaje>'.
// Vincular el número: la app muestra un código de 6 dígitos (whatsapp_codigo()) y el usuario lo manda por acá.
// Tablas y secretos: supabase/whatsapp.sql y supabase/whatsapp.md. Publicar con --no-verify-jwt (Meta no manda JWT).
import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { encodeBase64 } from 'jsr:@std/encoding@1/base64'
import { cardLabel, cardTitulo, categoriaReciente, Contexto, interpretar, normV, Resultado, round2 } from './interprete.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const GRAPH = `https://graph.facebook.com/${Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v23.0'}`
const APP_URL = 'https://control-de-gastos-lyart-theta.vercel.app'
const MODELOS = ['gemini-3.5-flash-lite', 'gemini-2.5-flash-lite']
const MAX_MEDIA = 15 * 1024 * 1024
const MAX_POR_HORA = 40 // mensajes por número y por hora: más que eso se ignora (cuida el costo de Gemini y de Meta)
const MAX_CODIGOS_MAL = 5 // códigos equivocados por número y por hora

const TXT_VINCULAR = `Hola 👋 Este es el número de *Mis Cuentas*.\n\nPara cargar tus gastos por acá, primero conectá este WhatsApp a tu cuenta:\n1. Abrí la app → *Más* → *WhatsApp*.\n2. Tocá *Conectar WhatsApp* y mandame el código de 6 dígitos que te muestra.\n\n${APP_URL}`
const TXT_AYUDA = `Mandame tus gastos como los dirías:\n• _42.300 en Coto con Visa en 3 cuotas_\n• _1500 de nafta ayer_\n• _cobré 350 mil de sueldo_\nTambién un *audio* o una *foto del ticket*.\n\nSi algo quedó mal, mandá *DESHACER* y borro lo último que cargué.`
const TXT_PLUS = `La carga por WhatsApp es parte de *Mis Cuentas Plus*. Tu cuenta sigue funcionando gratis en la app: ${APP_URL}`

// ---------------------------------------------------------------- utilidades

const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

function mismoTexto(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

async function firmaValida(cuerpo: string, firma: string | null): Promise<boolean> {
  const secreto = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
  if (!secreto || !firma?.startsWith('sha256=')) return false
  const clave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', clave, new TextEncoder().encode(cuerpo)))
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  return mismoTexto(firma.slice(7).toLowerCase(), hex)
}

function plata(n: number, moneda: string | null) {
  const v = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
  const m = (moneda || 'ARS').toUpperCase()
  return m === 'ARS' ? `$${v}` : m === 'USD' ? `US$${v}` : `${m} ${v}`
}

function fechaTexto(f: string, hoy: string) {
  if (f === hoy) return 'hoy'
  const [y, m, d] = hoy.split('-').map(Number)
  const ayer = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
  if (f === ayer) return 'ayer'
  return `${f.slice(8, 10)}/${f.slice(5, 7)}${f.slice(0, 4) === hoy.slice(0, 4) ? '' : '/' + f.slice(0, 4)}`
}

function mesSuma(mes: string, k: number) {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + k, 1)).toISOString().slice(0, 7)
}
// Igual que primeraCuotaMes de la app: compra después del cierre → la primera cuota es un mes más tarde.
function primeraCuotaMes(fechaCompra: string, cierreDia: number | null) {
  const mes = fechaCompra.slice(0, 7)
  const dia = Number(fechaCompra.slice(8, 10))
  let cierre = cierreDia ? Number(cierreDia) : null
  if (cierre) { const [y, mm] = mes.split('-').map(Number); cierre = Math.min(cierre, new Date(Date.UTC(y, mm, 0)).getUTCDate()) }
  return mesSuma(mes, (cierre && dia > cierre) ? 2 : 1)
}

// ---------------------------------------------------------------- Meta

const token = () => Deno.env.get('WHATSAPP_TOKEN') ?? ''

async function enviar(db: SupabaseClient, msgId: string, para: string, texto: string) {
  const r = await fetch(`${GRAPH}/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: para, type: 'text', context: { message_id: msgId }, text: { body: texto.slice(0, 4000) } }),
  })
  if (!r.ok) { console.error('whatsapp: no se pudo responder', r.status, await r.text()); return }
  await db.from('whatsapp_mensajes').update({ respondido: true }).eq('id', msgId)
}

/** Tildes azules: no tiene costo. */
function marcarLeido(msgId: string) {
  return fetch(`${GRAPH}/${Deno.env.get('WHATSAPP_PHONE_ID')}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: msgId }),
  }).catch(() => {})
}

async function bajarMedia(mediaId: string): Promise<{ mime: string; b64: string } | null> {
  const info = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token()}` } })
  if (!info.ok) return null
  const { url, mime_type, file_size } = await info.json()
  if (!url || (file_size && file_size > MAX_MEDIA)) return null
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } })
  if (!r.ok) return null
  const bytes = new Uint8Array(await r.arrayBuffer())
  if (bytes.length > MAX_MEDIA) return null
  return { mime: String(mime_type || 'application/octet-stream').split(';')[0], b64: encodeBase64(bytes) }
}

// ---------------------------------------------------------------- Gemini

type DatosIA = Partial<Resultado> & { transcripcion?: string }

async function gemini(partes: unknown[]): Promise<DatosIA | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  const body = JSON.stringify({ contents: [{ parts: partes }], generationConfig: { temperature: 0, responseMimeType: 'application/json', maxOutputTokens: 600 } })
  for (const modelo of [Deno.env.get('WHATSAPP_GEMINI_MODELO'), ...MODELOS].filter(Boolean)) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body,
    })
    if (r.status === 404) continue // modelo retirado: se prueba el siguiente
    if (!r.ok) { console.error('whatsapp: gemini', r.status, await r.text()); return null }
    const j = await r.json()
    const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    try { return JSON.parse(String(txt).replace(/^```json|```$/g, '').trim()) } catch { return null }
  }
  return null
}

function promptIA(ctx: Contexto, entrada: string) {
  const dia = new Date(`${ctx.hoy}T12:00:00-03:00`).toLocaleDateString('es-AR', { weekday: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  return `Sos un extractor de datos para una app de finanzas argentina. Devolvé SÓLO un JSON, sin explicar nada.

HOY es ${ctx.hoy} (${dia}). Usá esto para resolver fechas: "ayer", "anteayer", "hace 3 días", "la semana pasada",
"el miércoles de la semana pasada" (= el miércoles de la semana calendario anterior), "el 12 de agosto".

REGLAS IMPORTANTES:
1. Si la persona se corrige ("no, me equivoqué", "mejor dicho", "en realidad", "perdón"), vale SÓLO lo que dijo DESPUÉS.
2. Si un dato se dice dos veces, vale el ÚLTIMO.
3. Centavos: "500 pesos con 22" = 500.22.
4. Números compuestos: "12 millones 533 mil 422 con 21" = 12533422.21. "5 lucas" = 5000. "2 palos" = 2000000.
5. "en tres cuotas" son cuotas de tarjeta, nunca parte del monto ni de la descripción.
6. Los comercios son nombres propios (Coto, YPF, Farmacity). Nunca un número, ni una palabra suelta.
7. En un ticket, el monto es el TOTAL final pagado.

Categorías posibles (elegí SIEMPRE una de esta lista): ${JSON.stringify(ctx.categorias.map((c) => c.nombre))}
Cuentas: ${JSON.stringify(ctx.cuentas.map((a) => ({ key: a.key, nombre: a.nombre })))}
Tarjetas: ${JSON.stringify(ctx.tarjetas.map((c) => ({ id: c.id, nombre: cardTitulo(c) })))}

${entrada}

Devolvé:
{"transcripcion":string|null(lo que dijo, si es un audio),"tipo":"gasto|ingreso|tarjeta","monto":number,"categoria":string,
 "cuenta":string(key de cuenta)|null,"card":string(id de tarjeta)|null,"cuotas":number,
 "fecha":"YYYY-MM-DD","comercio":string|null,"descripcion":string|null}`
}

/** Mezcla lo que devolvió Gemini sobre lo que ya había (igual que interpretarIA de la app), validando cada dato. */
function aplicarIA(V: Resultado, d: DatosIA, ctx: Contexto) {
  if (Number(d.monto) > 0) V.monto = round2(Number(d.monto))
  if (d.tipo === 'gasto' || d.tipo === 'ingreso' || d.tipo === 'tarjeta') V.tipo = d.tipo
  if (d.categoria && ctx.categorias.some((c) => c.nombre === d.categoria)) V.categoria = d.categoria
  if (d.cuenta && ctx.cuentas.some((a) => a.key === d.cuenta)) V.cuenta = d.cuenta
  if (d.card && ctx.tarjetas.some((c) => c.id === d.card)) V.card = d.card
  if (Number(d.cuotas) >= 1) V.cuotas = Math.min(72, Math.round(Number(d.cuotas)))
  if (/^\d{4}-\d{2}-\d{2}$/.test(d.fecha || '') && d.fecha! <= ctx.hoy) V.fecha = d.fecha!
  if (d.comercio) V.comercio = String(d.comercio).slice(0, 80)
  if (d.descripcion) V.descripcion = String(d.descripcion).slice(0, 200)
  if (V.tipo === 'tarjeta' && !V.card && ctx.tarjetas.length) V.card = ctx.tarjetas[0].id
}

// ---------------------------------------------------------------- datos del usuario

async function contexto(db: SupabaseClient, uid: string): Promise<Contexto> {
  const [cuentas, tarjetas, categorias, movs, compras] = await Promise.all([
    db.from('accounts').select('key, nombre, moneda').eq('user_id', uid).order('created_at'),
    db.from('cards').select('id, alias, banco, marca, cierre_dia').eq('user_id', uid).order('created_at'),
    db.from('categories').select('nombre, tipo').eq('user_id', uid).order('orden'),
    db.from('transactions').select('comercio, categoria, tipo, cuenta, origen, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(300),
    db.from('card_purchases').select('comercio, categoria, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(150),
  ])
  const historial = [
    ...(movs.data ?? []).map((t) => ({ ...t, manual: !t.origen || t.origen === 'whatsapp' })),
    ...(compras.data ?? []).map((p) => ({ ...p, tipo: 'tarjeta', cuenta: null, manual: true })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return {
    hoy: hoyAR(),
    cuentas: cuentas.data ?? [],
    tarjetas: tarjetas.data ?? [],
    categorias: (categorias.data ?? []).filter((c) => !['compartido', 'transferencia', 'ahorro'].includes(c.tipo)),
    historial: historial.filter((h) => h.manual),
  }
}

// ---------------------------------------------------------------- acciones

async function vincular(db: SupabaseClient, msgId: string, tel: string, codigo: string): Promise<string> {
  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('whatsapp_mensajes').select('id', { count: 'exact', head: true })
    .eq('telefono', tel).eq('resultado', 'codigo_mal').gte('created_at', desde)
  if ((count ?? 0) >= MAX_CODIGOS_MAL) return 'Probaste demasiados códigos. Esperá una hora y pedí uno nuevo en la app.'

  const { data: cod } = await db.from('whatsapp_codigos').select('user_id, expira_at').eq('codigo', codigo).maybeSingle()
  if (!cod || new Date(cod.expira_at) < new Date()) {
    await db.from('whatsapp_mensajes').update({ resultado: 'codigo_mal' }).eq('id', msgId)
    return 'Ese código no es válido o ya venció (duran 15 minutos). Pedí uno nuevo en la app: *Más* → *WhatsApp*.'
  }
  // Un número por cuenta y una cuenta por número: se suelta lo anterior de los dos lados.
  await db.from('whatsapp_vinculos').delete().or(`user_id.eq.${cod.user_id},telefono.eq.${tel}`)
  const { error } = await db.from('whatsapp_vinculos').insert({ user_id: cod.user_id, telefono: tel })
  if (error) { console.error('whatsapp: vincular', error); return 'No pude conectar tu WhatsApp. Probá de nuevo en un rato.' }
  await db.from('whatsapp_codigos').delete().eq('user_id', cod.user_id)
  await db.from('whatsapp_mensajes').update({ resultado: 'vinculado', user_id: cod.user_id }).eq('id', msgId)
  return `¡Listo! ✅ Este WhatsApp quedó conectado a tu cuenta de Mis Cuentas.\n\n${TXT_AYUDA}`
}

async function deshacer(db: SupabaseClient, uid: string, msgId: string): Promise<string> {
  const desde = new Date(Date.now() - 7 * 86400_000).toISOString()
  const { data: ult } = await db.from('whatsapp_mensajes').select('id, tabla, fila_id, resultado')
    .eq('user_id', uid).eq('deshecho', false).not('fila_id', 'is', null).gte('created_at', desde)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!ult) return 'No encontré nada cargado por WhatsApp en los últimos 7 días para deshacer.'
  if (ult.tabla === 'card_purchases') await db.from('card_installments').delete().eq('purchase_id', ult.fila_id).eq('user_id', uid)
  if (ult.tabla === 'transactions' || ult.tabla === 'card_purchases') {
    const { error } = await db.from(ult.tabla).delete().eq('id', ult.fila_id).eq('user_id', uid)
    if (error) { console.error('whatsapp: deshacer', error); return 'No pude borrarlo. Probá desde la app.' }
  }
  await db.from('whatsapp_mensajes').update({ deshecho: true }).eq('id', ult.id)
  await db.from('whatsapp_mensajes').update({ resultado: 'deshacer' }).eq('id', msgId)
  return `Listo, borré: ${ult.resultado ?? 'lo último que cargaste'}.`
}

async function guardar(db: SupabaseClient, uid: string, msgId: string, V: Resultado, ctx: Contexto): Promise<string> {
  if (V.tipo === 'ahorro' || V.tipo === 'compartido') {
    return 'Los ahorros y los gastos compartidos todavía se cargan desde la app. Por acá puedo guardar gastos, ingresos y compras con tarjeta.'
  }
  if (!(V.monto > 0)) {
    return `No encontré el monto 🤔 Probá así: _42.300 en Coto con Visa en 3 cuotas_.`
  }
  const card = V.tipo === 'tarjeta' ? ctx.tarjetas.find((c) => c.id === V.card) ?? null : null
  if (V.tipo === 'tarjeta' && !card) V.tipo = 'gasto' // sin tarjetas cargadas va como gasto común
  if (!V.categoria) V.categoria = categoriaReciente(ctx, V.tipo)
  const ref = `wa:${msgId}`
  const hoy = ctx.hoy
  if (V.fecha > hoy) V.fecha = hoy

  let tabla: string, filaId: string, resumen: string
  if (card) {
    const cuotas = Math.max(1, Math.min(72, V.cuotas || 1))
    const { data: compra, error } = await db.from('card_purchases').insert({
      user_id: uid, fecha_compra: V.fecha, tarjeta: cardLabel(card), card_id: card.id, descripcion: V.descripcion,
      categoria: V.categoria, monto_total: V.monto, cuotas, comercio: V.comercio, origen: 'whatsapp', origen_ref: ref,
    }).select('id').single()
    if (error) return error.code === '23505' ? '' : falla(error)
    const primera = primeraCuotaMes(V.fecha, card.cierre_dia)
    const base = round2(V.monto / cuotas)
    const filas = []
    let ac = 0
    for (let i = 1; i <= cuotas; i++) {
      const m = i === cuotas ? round2(V.monto - ac) : base
      ac = round2(ac + base)
      filas.push({ user_id: uid, purchase_id: compra.id, nro_cuota: i, monto: m, mes: `${mesSuma(primera, i - 1)}-01`, pagada: false })
    }
    const { error: e2 } = await db.from('card_installments').insert(filas)
    if (e2) { await db.from('card_purchases').delete().eq('id', compra.id); return falla(e2) }
    tabla = 'card_purchases'; filaId = compra.id
    resumen = `${plata(V.monto, null)}${V.comercio ? ' en ' + V.comercio : ''} con ${cardTitulo(card)}${cuotas > 1 ? ` en ${cuotas} cuotas de ${plata(base, null)}` : ''}`
  } else {
    if (!ctx.cuentas.length) return `Todavía no tenés cuentas en Mis Cuentas. Creá una en la app y volvé a mandármelo: ${APP_URL}`
    const tipo = V.tipo === 'ingreso' ? 'ingreso' : 'gasto'
    const usada = ctx.historial.find((h) => h.tipo === tipo && h.cuenta && ctx.cuentas.some((a) => a.key === h.cuenta))
    const cuenta = V.cuenta ?? usada?.cuenta ?? ctx.cuentas[0].key
    const { data: tx, error } = await db.from('transactions').insert({
      user_id: uid, fecha: V.fecha, cuenta, tipo, monto: V.monto, categoria: V.categoria, descripcion: V.descripcion,
      comercio: V.comercio, origen: 'whatsapp', origen_ref: ref,
    }).select('id').single()
    if (error) return error.code === '23505' ? '' : falla(error)
    const cta = ctx.cuentas.find((a) => a.key === cuenta)
    tabla = 'transactions'; filaId = tx.id; V.tipo = tipo
    resumen = `${tipo === 'ingreso' ? 'ingreso de ' : ''}${plata(V.monto, cta?.moneda ?? null)}${V.comercio ? ' en ' + V.comercio : ''} · ${cta?.nombre ?? cuenta}`
  }
  await db.from('whatsapp_mensajes').update({ tabla, fila_id: filaId, resultado: resumen }).eq('id', msgId)
  const titulo = V.tipo === 'ingreso' ? 'Ingreso guardado' : V.tipo === 'tarjeta' ? 'Compra guardada' : 'Gasto guardado'
  return `✅ ${titulo}: ${resumen}${V.categoria ? ' · ' + V.categoria : ''} · ${fechaTexto(V.fecha, hoy)}.\nSi no era así, mandá *DESHACER*.`
}

function falla(error: { message?: string }) {
  console.error('whatsapp: guardar', error)
  return 'No pude guardarlo por un error del servidor. Probá de nuevo en un rato o cargalo desde la app.'
}

// ---------------------------------------------------------------- un mensaje

// deno-lint-ignore no-explicit-any
async function procesar(db: SupabaseClient, msg: any) {
  const tel = String(msg.from ?? '')
  const msgId = String(msg.id ?? '')
  if (!/^\d{8,15}$/.test(tel) || !msgId) return
  // Meta reintenta el webhook si tarda: la clave primaria evita procesar dos veces el mismo mensaje.
  const { error: dup } = await db.from('whatsapp_mensajes').insert({ id: msgId, telefono: tel, tipo: msg.type })
  if (dup) { if (dup.code !== '23505') console.error('whatsapp: registro', dup); return }
  // Mensajes viejos (reintentos de más de un día): no se cargan ni se contestan.
  if (Number(msg.timestamp) && Date.now() / 1000 - Number(msg.timestamp) > 86400) return

  const desde = new Date(Date.now() - 3600_000).toISOString()
  const { count } = await db.from('whatsapp_mensajes').select('id', { count: 'exact', head: true }).eq('telefono', tel).gte('created_at', desde)
  if ((count ?? 0) > MAX_POR_HORA) { await db.from('whatsapp_mensajes').update({ resultado: 'limite' }).eq('id', msgId); return }

  marcarLeido(msgId)
  const texto = String(msg.text?.body ?? msg.image?.caption ?? msg.document?.caption ?? '').trim()
  const responder = (t: string) => t ? enviar(db, msgId, tel, t) : Promise.resolve()

  const { data: vinculo } = await db.from('whatsapp_vinculos').select('user_id').eq('telefono', tel).maybeSingle()
  const conCodigo = texto.match(/^\s*(?:conectar|vincular)?\s*:?\s*(\d{6})\s*$/i)
  if (conCodigo && (!vinculo || /^\s*(conectar|vincular)/i.test(texto))) return responder(await vincular(db, msgId, tel, conCodigo[1]))

  if (!vinculo) {
    // A un número sin vincular se le explica una vez cada 12 horas: cada respuesta puede costar.
    const { count: yaDicho } = await db.from('whatsapp_mensajes').select('id', { count: 'exact', head: true })
      .eq('telefono', tel).eq('resultado', 'sin_vincular').gte('created_at', new Date(Date.now() - 12 * 3600_000).toISOString())
    await db.from('whatsapp_mensajes').update({ resultado: 'sin_vincular' }).eq('id', msgId)
    return (yaDicho ?? 0) > 0 ? undefined : responder(TXT_VINCULAR)
  }

  const uid = vinculo.user_id as string
  await db.from('whatsapp_mensajes').update({ user_id: uid }).eq('id', msgId)
  const { data: perfil } = await db.from('profiles').select('plan, es_admin').eq('user_id', uid).maybeSingle()
  if (!(perfil?.plan === 'plus' || perfil?.es_admin)) return responder(TXT_PLUS)

  const n = normV(texto).replace(/[^a-z ]/g, '').trim()
  if (/^(deshacer|deshace|deshaceme|borrar|borra|borralo|anular)( (eso|lo ultimo|el ultimo))?$/.test(n)) return responder(await deshacer(db, uid, msgId))
  if (/^(hola|ayuda|help|menu|como funciona|que hago|buenas|buen dia|buenas tardes|buenas noches)$/.test(n)) return responder(TXT_AYUDA)
  if (msg.type === 'text' && /^(gracias|muchas gracias|ok|oka|okey|dale|genial|joya|listo|perfecto|buenisimo|bien)$/.test(n)) return // no se contesta: cada respuesta puede costar

  const ctx = await contexto(db, uid)
  let V: Resultado
  if (msg.type === 'text') {
    V = interpretar(texto, ctx)
    if (!(V.monto > 0)) {
      const d = await gemini([{ text: promptIA(ctx, `Frase: "${texto.replace(/"/g, "'").slice(0, 1000)}"`) }])
      if (d) aplicarIA(V, d, ctx)
    }
  } else if (msg.type === 'audio' || msg.type === 'image' || (msg.type === 'document' && /^(image\/|application\/pdf)/.test(msg.document?.mime_type ?? ''))) {
    if (!Deno.env.get('GEMINI_API_KEY')) return responder('Todavía no puedo escuchar audios ni leer fotos. Mandámelo escrito: _42.300 en Coto con Visa_.')
    const media = await bajarMedia(msg.audio?.id ?? msg.image?.id ?? msg.document?.id)
    if (!media) return responder('No pude bajar el archivo (¿es muy grande?). Probá de nuevo o mandámelo escrito.')
    const esAudio = msg.type === 'audio'
    const entrada = esAudio
      ? 'Es un audio de WhatsApp: transcribilo y sacá los datos del gasto que dice.'
      : `Es la foto de un ticket o comprobante de compra argentino.${texto ? ` La persona agregó: "${texto.replace(/"/g, "'").slice(0, 300)}"` : ''}`
    const d = await gemini([{ text: promptIA(ctx, entrada) }, { inline_data: { mime_type: media.mime, data: media.b64 } }])
    if (!d) return responder(esAudio ? 'No pude entender el audio. ¿Me lo mandás escrito?' : 'No pude leer el ticket. ¿Me mandás el monto escrito?')
    // Si es un audio, lo que dijo pasa también por el intérprete local (entiende mejor las cuentas y tarjetas propias).
    V = d.transcripcion ? interpretar(String(d.transcripcion), ctx) : interpretar(texto, ctx)
    aplicarIA(V, d, ctx)
    if (!V.descripcion && d.transcripcion) V.descripcion = String(d.transcripcion).slice(0, 200)
  } else {
    return responder('Por ahora entiendo texto, audios y fotos de tickets.')
  }
  return responder(await guardar(db, uid, msgId, V, ctx))
}

// ---------------------------------------------------------------- entrada

Deno.serve(async (req) => {
  const url = new URL(req.url)
  if (req.method === 'GET') {
    const verify = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
    if (url.searchParams.get('hub.mode') === 'subscribe' && mismoTexto(url.searchParams.get('hub.verify_token') ?? '', verify)) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 })
    }
    return new Response('Prohibido', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405 })

  const crudo = await req.text()
  if (!await firmaValida(crudo, req.headers.get('x-hub-signature-256'))) return new Response('Firma inválida', { status: 401 })
  // deno-lint-ignore no-explicit-any
  let cuerpo: any
  try { cuerpo = JSON.parse(crudo) } catch { return new Response('JSON inválido', { status: 400 }) }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const miNumero = Deno.env.get('WHATSAPP_PHONE_ID')
  const mensajes = (cuerpo?.entry ?? []).flatMap((e: { changes?: unknown[] }) => e.changes ?? [])
    // deno-lint-ignore no-explicit-any
    .filter((c: any) => c.field === 'messages' && (!miNumero || c.value?.metadata?.phone_number_id === miNumero))
    // deno-lint-ignore no-explicit-any
    .flatMap((c: any) => c.value?.messages ?? [])
  // Los estados (enviado, entregado, leído) llegan por el mismo webhook y no se usan.

  const trabajo = Promise.all(mensajes.map((m: unknown) => procesar(db, m).catch((e) => console.error('whatsapp: mensaje', e))))
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(trabajo)
  else await trabajo
  return new Response('ok', { status: 200 })
})
