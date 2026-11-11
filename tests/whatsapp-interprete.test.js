// Pruebas del intérprete que usa la función de WhatsApp (supabase/functions/whatsapp/interprete.ts):
// la copia del intérprete del dictado que entiende los mensajes de texto sin pasar por Gemini.
// Node ya corre TypeScript sin compilar (desde la 22.18), así que se importa el .ts tal cual.
// Uso: node tests/whatsapp-interprete.test.js
const path = require('path')
const { pathToFileURL } = require('url')

;(async () => {
  const { interpretar, normV } = await import(pathToFileURL(path.join(__dirname, '..', 'supabase', 'functions', 'whatsapp', 'interprete.ts')).href)
  // hoy fijo y un lunes de enero: «ayer» tiene que cruzar el año
  const ctx = {
    hoy: '2027-01-01',
    cuentas: [{ key: 'mp', nombre: 'Mercado Pago', moneda: 'ARS' }, { key: 'efectivo', nombre: 'Efectivo', moneda: 'ARS' }],
    tarjetas: [{ id: 't1', alias: null, banco: 'Galicia', marca: 'visa', cierre_dia: 25 }],
    categorias: ['Supermercado', 'Transporte', 'Sueldo', 'Comida en la calle', 'Otros'].map((nombre) => ({ nombre })),
    historial: [],
  }
  let fallas = 0, total = 0
  const caso = (frase, espera) => {
    total++
    const r = interpretar(frase, ctx)
    const mal = Object.entries(espera).filter(([k, v]) => r[k] !== v)
    if (mal.length) fallas++
    console.log(mal.length ? '✗' : '✓', frase, mal.length ? '\n  ' + JSON.stringify(Object.fromEntries(mal.map(([k]) => [k, r[k]]))) : '')
  }

  caso('42.300 en Coto con Visa en 3 cuotas', { tipo: 'tarjeta', monto: 42300, card: 't1', cuotas: 3, comercio: 'Coto', categoria: 'Supermercado' })
  caso('1500 de nafta ayer', { tipo: 'gasto', monto: 1500, fecha: '2026-12-31', categoria: 'Transporte' })
  caso('cobré 350 mil de sueldo', { tipo: 'ingreso', monto: 350000, categoria: 'Sueldo' })
  caso('5 lucas en el super con mercado pago', { tipo: 'gasto', monto: 5000, cuenta: 'mp', categoria: 'Supermercado' })
  caso('gasté 10 lucas, no, pará, 12 lucas', { monto: 12000 })
  caso('2 palos en efectivo', { monto: 2000000, cuenta: 'efectivo' })
  caso('12 cuotas de 10 lucas con visa', { tipo: 'tarjeta', monto: 120000, cuotas: 12 })
  caso('hola', { monto: 0 })   // sin monto: la función le pregunta a Gemini o pide el monto

  total++
  const ok = normV('DESHACÉ') === 'deshace'
  if (!ok) fallas++
  console.log(ok ? '✓' : '✗', 'normV saca mayúsculas y tildes (para reconocer DESHACER)')

  console.log(`\n${total - fallas}/${total} bien`)
  process.exit(fallas ? 1 : 0)
})()
