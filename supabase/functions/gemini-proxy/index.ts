// Función de Supabase (proyecto de Mis Cuentas): la IA de "Contame el gasto" y de la foto del ticket.
// La key de Gemini vive acá como secreto (GEMINI_API_KEY) y nunca llega al navegador.
// Se publica con verificación de JWT (la de siempre): sólo la puede usar alguien con sesión iniciada.
// Pedidos:  {ping:true}            → {configurado:boolean}
//           {modelo, body}         → la respuesta de generateContent tal cual
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MODELO_OK = /^gemini-[a-z0-9.\-]{1,40}$/
const MAX_BYTES = 12 * 1024 * 1024 // una foto de ticket ya achicada pesa ~0,5 MB

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Sólo POST.' }, 405)
  const key = Deno.env.get('GEMINI_API_KEY') ?? ''

  const crudo = await req.text()
  if (crudo.length > MAX_BYTES) return json({ error: 'El pedido es demasiado grande.' }, 413)
  let cuerpo: { ping?: boolean; modelo?: string; body?: unknown }
  try {
    cuerpo = JSON.parse(crudo)
  } catch {
    return json({ error: 'Pedido inválido.' }, 400)
  }
  if (cuerpo.ping) return json({ configurado: !!key })
  if (!key) return json({ error: 'Falta el secreto GEMINI_API_KEY.' }, 503)
  if (!cuerpo.modelo || !MODELO_OK.test(cuerpo.modelo) || !cuerpo.body) return json({ error: 'Falta el modelo o el pedido.' }, 400)

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cuerpo.modelo}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(cuerpo.body),
  })
  const texto = await r.text()
  return new Response(texto, { status: r.status, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
