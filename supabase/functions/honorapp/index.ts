// Función de Supabase (proyecto de Mis Cuentas): la llama honorapp para enlazar cuentas y mandar los cobros
// de cada mes como ingresos. Solo la puede usar honorapp: exige la clave secreta compartida (ENLACE_SECRETO).
// La cuenta se identifica por el mail confirmado (honorapp manda el mail verificado de su usuaria).
// Acciones: estado, enlazar, desenlazar, recibir. Ver supabase/enlace-honorapp.sql.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const CATEGORIA = 'Honorarios'

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

/** Compara sin filtrar por tiempo cuántos caracteres coinciden. */
function mismoSecreto(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })

function ultimoDia(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number)
  return `${periodo.slice(0, 8)}${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`
}

Deno.serve(async (req) => {
  const secreto = Deno.env.get('ENLACE_SECRETO') ?? ''
  if (req.method !== 'POST' || !mismoSecreto(req.headers.get('x-enlace-secreto') ?? '', secreto)) {
    return json({ ok: false, mensaje: 'No autorizado.' }, 401)
  }
  let cuerpo: { accion?: string; email?: string; cuenta_ars?: string | null; cuenta_usd?: string | null; totales?: { periodo: string; moneda: string; total: number }[] }
  try {
    cuerpo = await req.json()
  } catch {
    return json({ ok: false, mensaje: 'Pedido inválido.' }, 400)
  }
  if (!cuerpo.email || typeof cuerpo.email !== 'string' || cuerpo.email.length > 320) return json({ ok: false, mensaje: 'Falta el mail.' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: userId } = await db.rpc('usuario_por_mail', { p_email: cuerpo.email })
  if (!userId) return json({ ok: true, existe: false })

  const { data: cuentas } = await db.from('accounts').select('key, nombre, moneda').eq('user_id', userId).order('created_at')
  const { data: enlace } = await db.from('enlace_honorapp').select('*').eq('user_id', userId).maybeSingle()
  const claves = new Set((cuentas ?? []).map((c) => c.key))

  if (cuerpo.accion === 'estado') {
    return json({
      ok: true,
      existe: true,
      enlazado: !!enlace?.activo,
      cuenta_ars: enlace?.cuenta_ars ?? null,
      cuenta_usd: enlace?.cuenta_usd ?? null,
      ultimo_envio: enlace?.ultimo_envio ?? null,
      cuentas: cuentas ?? [],
    })
  }

  if (cuerpo.accion === 'enlazar') {
    const ars = cuerpo.cuenta_ars || null
    const usd = cuerpo.cuenta_usd || null
    if (!ars && !usd) return json({ ok: false, mensaje: 'Elegí al menos una cuenta.' }, 400)
    if ((ars && !claves.has(ars)) || (usd && !claves.has(usd))) return json({ ok: false, mensaje: 'Esa cuenta no existe en Mis Cuentas.' }, 400)
    const { error } = await db.from('enlace_honorapp').upsert({ user_id: userId, cuenta_ars: ars, cuenta_usd: usd, activo: true })
    return error ? json({ ok: false, mensaje: error.message }, 500) : json({ ok: true })
  }

  if (cuerpo.accion === 'desenlazar') {
    if (enlace) await db.from('enlace_honorapp').update({ activo: false }).eq('user_id', userId)
    return json({ ok: true })
  }

  if (cuerpo.accion === 'recibir') {
    if (!enlace?.activo) return json({ ok: false, mensaje: 'La cuenta de Mis Cuentas no está enlazada.' }, 409)
    const totales = Array.isArray(cuerpo.totales) ? cuerpo.totales.slice(0, 60) : []

    // La categoría «Honorarios» se crea si no existe.
    const { data: cat } = await db.from('categories').select('id').eq('user_id', userId).eq('nombre', CATEGORIA).maybeSingle()
    if (!cat) await db.from('categories').insert({ user_id: userId, nombre: CATEGORIA, emoji: '🩺', tipo: 'ingreso', color: '#557f69', orden: 99 })

    const hoy = hoyAR()
    let guardados = 0
    let borrados = 0
    for (const t of totales) {
      if (!/^\d{4}-\d{2}-01$/.test(t.periodo) || !['ARS', 'USD'].includes(t.moneda) || typeof t.total !== 'number' || !Number.isFinite(t.total)) continue
      const ref = `honorapp:${t.periodo.slice(0, 7)}:${t.moneda}`
      const cuenta = t.moneda === 'ARS' ? enlace.cuenta_ars : enlace.cuenta_usd
      const { data: existente } = await db.from('transactions').select('id').eq('user_id', userId).eq('origen_ref', ref).maybeSingle()
      const total = Math.round(t.total * 100) / 100
      if (total <= 0 || !cuenta) {
        if (existente) {
          await db.from('transactions').delete().eq('id', existente.id)
          borrados++
        }
        continue
      }
      const [anio, mes] = t.periodo.split('-').map(Number)
      const fila = {
        user_id: userId,
        fecha: hoy.slice(0, 7) === t.periodo.slice(0, 7) ? hoy : ultimoDia(t.periodo),
        cuenta,
        tipo: 'ingreso',
        monto: total,
        categoria: CATEGORIA,
        descripcion: `honorapp · ${MESES[mes - 1]} ${anio}`,
        origen: 'honorapp',
        origen_ref: ref,
      }
      const { error } = existente
        ? await db.from('transactions').update(fila).eq('id', existente.id)
        : await db.from('transactions').insert(fila)
      if (!error) guardados++
    }
    await db.from('enlace_honorapp').update({ ultimo_envio: new Date().toISOString() }).eq('user_id', userId)
    return json({ ok: true, guardados, borrados })
  }

  return json({ ok: false, mensaje: 'Acción desconocida.' }, 400)
})
