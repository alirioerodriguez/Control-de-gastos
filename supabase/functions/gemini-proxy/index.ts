// Función de Supabase (proyecto de Mis Cuentas): la IA de "Contame el gasto", foto del ticket y resumen.
// La key de Gemini vive acá como secreto (GEMINI_API_KEY) y nunca llega al navegador.
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Pedidos:  {ping:true}                  → {configurado:boolean}
//           {cupo:true}                  → {configurado:boolean, esPro:boolean, relecturasUsadas:number, resumenesUsados:number}
//           {modelo, body, tipo?}        → la respuesta de generateContent tal cual (y cabeceras x-cupo-*)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json', ...extraHeaders } })

const MODELOS = new Set(['gemini-3.5-flash', 'gemini-3.5-flash-lite'])
const TOPE_DIA = 200
const CUPO_RELECTURAS_MES = 15
const CUPO_RESUMENES_MES = 1
const MAX_BYTES = 12 * 1024 * 1024

function inicioMesUTC(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0)).toISOString()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Sólo POST.' }, 405)
  const key = Deno.env.get('GEMINI_API_KEY') ?? ''

  const crudo = await req.text()
  if (crudo.length > MAX_BYTES) return json({ error: 'El pedido es demasiado grande.' }, 413)
  let cuerpo: { ping?: boolean; cupo?: boolean; modelo?: string; tipo?: string; body?: unknown }
  try {
    cuerpo = JSON.parse(crudo)
  } catch {
    return json({ error: 'Pedido inválido.' }, 400)
  }
  if (cuerpo.ping) return json({ configurado: !!key })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)
  const { data: quien } = await db.auth.getUser(token)
  if (!quien?.user) return json({ error: 'Iniciá sesión para usar la IA.' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const uid = quien.user.id
  const desdeMes = inicioMesUTC()

  const [{ data: perf }, { count: relMes }, { count: resMes }] = await Promise.all([
    admin.from('profiles').select('*').eq('user_id', uid).maybeSingle(),
    admin.from('uso_ia').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('tipo', 'relectura').gte('at', desdeMes),
    admin.from('uso_ia').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('tipo', 'resumen_pdf').gte('at', desdeMes),
  ])
  const esPro = !!(perf && (perf.es_pro === true || perf.plan === 'pro' || perf.plan === 'combo_honorapp'))
  const relecturasUsadas = relMes ?? 0
  const resumenesUsados = resMes ?? 0

  if (cuerpo.cupo) {
    return json({ configurado: !!key, esPro, relecturasUsadas, resumenesUsados, topeRelecturas: CUPO_RELECTURAS_MES, topeResumenes: CUPO_RESUMENES_MES })
  }

  if (!key) return json({ error: 'Falta el secreto GEMINI_API_KEY.' }, 503)
  if (!cuerpo.modelo || !MODELOS.has(cuerpo.modelo) || !cuerpo.body) return json({ error: 'Falta el modelo o el pedido.' }, 400)

  const tipoUso = cuerpo.tipo === 'resumen_pdf' ? 'resumen_pdf' : 'relectura'
  if (!esPro) {
    if (tipoUso === 'relectura' && relecturasUsadas >= CUPO_RELECTURAS_MES) {
      return json({
        error: 'Usaste tus 15 relecturas con IA de este mes. El dictado por voz, el lector de QR de ARCA y de servicios y los gastos compartidos siguen andando gratis y sin límite.',
        codigo: 'CUPO_MENSUAL_RELECTURA',
        relecturasUsadas,
        resumenesUsados,
      }, 429)
    }
    if (tipoUso === 'resumen_pdf' && resumenesUsados >= CUPO_RESUMENES_MES) {
      return json({
        error: 'Ya usaste tu lectura de resumen con IA de este mes. Si bajás el PDF original del home banking, lo leo gratis sin usar IA.',
        codigo: 'CUPO_MENSUAL_RESUMEN',
        relecturasUsadas,
        resumenesUsados,
      }, 429)
    }
  }

  const { count: diaCount } = await admin
    .from('uso_ia')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
    .gte('at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  if ((diaCount ?? 0) >= TOPE_DIA) return json({ error: 'Llegaste al máximo de cargas con IA por hoy. Mañana vuelve a andar.' }, 429)

  await admin.from('uso_ia').insert({ user_id: uid, tipo: tipoUso })

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cuerpo.modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(cuerpo.body),
  })
  const texto = await r.text()
  return new Response(texto, {
    status: r.status,
    headers: {
      ...CORS,
      'Content-Type': 'application/json',
      'x-cupo-relecturas': String(relecturasUsadas + (tipoUso === 'relectura' ? 1 : 0)),
      'x-cupo-resumenes': String(resumenesUsados + (tipoUso === 'resumen_pdf' ? 1 : 0)),
    },
  })
})
