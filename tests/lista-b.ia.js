// Lista B de QA-microfono.md contra Gemini, con el mismo prompt y el mismo esquema que usa la app.
// Guarda las respuestas en tests/lista-b/<fecha>.json y las compara con la corrida anterior, así un ajuste
// del prompt (por ejemplo para B26) muestra al toque qué otros casos cambiaron.
// Uso:  GEMINI_API_KEY=... node tests/lista-b.ia.js [B3 B26 ...]
// Sin la clave no hace nada: la clave es tuya y no se guarda en ningún archivo.
const fs = require('fs')
const path = require('path')

const KEY = process.env.GEMINI_API_KEY
if (!KEY) { console.log('Lista B: falta GEMINI_API_KEY en el entorno; no se corre nada.'); process.exit(0) }
const MODELO = process.env.GEMINI_MODELO || 'gemini-3.5-flash'

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

// Los casos salen de la tabla de QA-microfono.md: si se agrega uno ahí, entra solo.
const qa = fs.readFileSync(path.join(__dirname, 'QA-microfono.md'), 'utf8')
const casos = [...qa.matchAll(/^\| (B\d+) \| (.+?) \| (.+?) \|$/gm)].map(([, id, frase, esperado]) => ({ id, frase, esperado }))
const pedidos = process.argv.slice(2)
const elegidos = pedidos.length ? casos.filter(c => pedidos.includes(c.id)) : casos

// Los mismos datos de ejemplo que voz.test.js, para que las corridas se puedan comparar entre sí
const CUR = 'ARS'
const cx = {
  cats: ['Supermercado', 'Auto', 'Salidas', 'Salud', 'Sueldo', 'Servicios', 'Nafta', 'Comida', 'Cigarrillos', 'Transporte', 'Suscripciones',
    'Ropa', 'Mascotas', 'Regalos', 'Alquiler', 'Gimnasio', 'Cuidado personal', 'Luz', 'Gas', 'Internet', 'Celular', 'Ventas', 'Hogar', 'Tecnología', 'Trabajo'],
  ctas: [{ key: 'ef', nombre: 'Efectivo' }, { key: 'mp', nombre: 'Mercado Pago' }, { key: 'gal', nombre: 'Banco Galicia' }, { key: 'usd', nombre: 'Dólares', moneda: 'USD' }],
  tars: [{ id: 'v1', nombre: 'Visa Galicia', marca: 'Visa', banco: 'Galicia' }, { id: 'm1', nombre: 'Mastercard Santander', marca: 'Mastercard', banco: 'Santander' }],
  gente: [{ pair: 'p1', nombre: 'Sofi' }],
  hist: [],
}
const todayISO = () => new Date().toISOString().slice(0, 10)
const armar = new Function('cx', 'CUR', 'todayISO', 'texto',
  tramo('ia-esquema') + '\nconst hoy=new Date();\n' + tramo('ia-prompt') + '\nreturn { prompt, esquema: esquemaFrase(cx) };')

async function preguntar(frase) {
  const { prompt, esquema } = armar(cx, CUR, todayISO, frase)
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: esquema, maxOutputTokens: 2048, thinkingConfig: { thinkingLevel: 'low' } } }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(body),
  })
  if (!r.ok) return { error: `HTTP ${r.status}` }
  const j = await r.json()
  const texto = (j.candidates?.[0]?.content?.parts || []).filter(p => !p.thought && p.text).map(p => p.text).join('')
  try { return JSON.parse(texto).movimientos || [] } catch { return { error: 'JSON ilegible', texto } }
}

// Lo que se compara entre corridas: los campos que deciden si el caso está bien
const resumen = (movs) => Array.isArray(movs)
  ? movs.map(m => [m.tipo, m.monto, m.categoria, m.comercio, m.cuotas, m.pagadas, m.card, m.cuenta, m.split, m.especial].map(x => x ?? '-').join(' · ')).join(' | ')
  : `ERROR ${movs.error}`

;(async () => {
  const carpeta = path.join(__dirname, 'lista-b')
  fs.mkdirSync(carpeta, { recursive: true })
  const anteriores = fs.readdirSync(carpeta).filter(f => f.endsWith('.json')).sort()
  const previa = anteriores.length ? JSON.parse(fs.readFileSync(path.join(carpeta, anteriores.at(-1)), 'utf8')) : null
  const salida = { fecha: new Date().toISOString(), modelo: MODELO, casos: {} }
  let cambios = 0
  for (const c of elegidos) {
    const movs = await preguntar(c.frase)
    const r = resumen(movs)
    salida.casos[c.id] = { frase: c.frase, esperado: c.esperado, resumen: r, movimientos: movs }
    const antes = previa?.casos?.[c.id]?.resumen
    const marca = antes === undefined ? 'nuevo' : antes === r ? 'igual' : 'CAMBIÓ'
    if (marca === 'CAMBIÓ') cambios++
    console.log(`${c.id.padEnd(4)} ${marca.padEnd(6)} ${r}\n      esperado: ${c.esperado}${marca === 'CAMBIÓ' ? `\n      antes:    ${antes}` : ''}`)
  }
  const archivo = path.join(carpeta, salida.fecha.replace(/[:.]/g, '-') + '.json')
  fs.writeFileSync(archivo, JSON.stringify(salida, null, 2))
  console.log(`\n${elegidos.length} casos · ${cambios} cambiaron respecto de ${anteriores.at(-1) || 'nada (primera corrida)'} · guardado en ${path.relative(process.cwd(), archivo)}`)
})()
