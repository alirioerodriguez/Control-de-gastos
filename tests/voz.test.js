// Pruebas del intérprete local de "Contame el gasto" (sin IA, sin internet).
// Saca el código directamente de index.html, así prueba lo mismo que corre en la app.
// Uso:  node tests/voz.test.js
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
const codigo = [
  html.match(/function diasAtras\(.*?\n/)[0],
  tramo('const round2 =', '/* ---------- fechas locales'),
  tramo('const p2 =', 'function mesSuma'),
  tramo('const NUM_PAL=', '/* ---------------- Gemini'),
].join('\n')

// lo mínimo de la app que el intérprete necesita
global.CATS = ['Supermercado', 'Auto', 'Salidas', 'Salud', 'Sueldo', 'Servicios', 'Nafta', 'Comida', 'Cigarrillos'].map((nombre) => ({ nombre }))
global.ACCOUNTS = [{ key: 'ef', nombre: 'Efectivo' }, { key: 'mp', nombre: 'Mercado Pago' }]
global.CARDS = [{ id: 'v1', alias: '', banco: 'Galicia', marca: 'Visa' }]
global.PAIRS = []; global.TX = []; global.PURCH = []; global.STXN = []; global.user = { id: 'u' }
global.catsAlfa = () => CATS
global.cardTitulo = (c) => c.marca + ' ' + c.banco
global.otherProf = () => ({}); global.otherId = () => null
eval(codigo + ';global.interpretarLocal=interpretarLocal;global.movimientos=()=>VS;')

const hoy = diasAtras(0), ayer = diasAtras(1)
// frase → lo que tiene que salir (uno por movimiento; sólo se comparan los campos que se ponen)
const CASOS = [
  // orden libre
  ['supermercado 12.300', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['12.300 supermercado', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['categoría comida, monto 5000, descripción almuerzo con Juan', [{ monto: 5000, categoria: 'Comida', descripcion: 'Almuerzo con Juan' }]],
  ['descripción almuerzo con Juan 5000 comida', [{ monto: 5000, categoria: 'Comida', descripcion: 'Almuerzo con Juan' }]],
  ['comercio La Parolaccia salidas 5000 ayer', [{ monto: 5000, categoria: 'Salidas', comercio: 'La Parolaccia', fecha: ayer }]],
  ['auto con la visa 90000 en 3 cuotas', [{ monto: 90000, categoria: 'Auto', tipo: 'tarjeta', cuotas: 3 }]],
  // números hablados
  ['ciento cincuenta pesos de pan', [{ monto: 150 }]],
  ['mil quinientos en el kiosco', [{ monto: 1500 }]],
  ['trescientos cincuenta mil de alquiler', [{ monto: 350000 }]],
  ['12 millones 533 mil 422 con 21', [{ monto: 12533422.21 }]],
  ['pagué 15,000 de nafta en YPF', [{ monto: 15000, comercio: 'YPF' }]],
  ['3500 por 2 medialunas', [{ monto: 3500 }]],
  // equivocarse y corregir: cambia sólo lo que se vuelve a decir
  ['gaste 15.000 en mercado en el coto, ah no eso no, fueron 16.500 en el coto', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, no me equivoqué, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000, mentira, 16.500 en el coto', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, uy no, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15 mil en el coto, me confundí, 16 mil 500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, no, en el jumbo', [{ monto: 15000, comercio: 'Jumbo' }]],
  ['son 500 no 800 en Coto', [{ monto: 800, comercio: 'Coto' }]],
  ['no me equivoqué, son 15.000 en el coto', [{ monto: 15000, comercio: 'Coto' }]],
  // varios gastos en una frase
  ['gaste 15.000 con la mercado pago en el kiosco de la esquina comprando cigarros, también otros 12.000 en el chino comprando pasta y arroz',
    [{ monto: 15000, categoria: 'Cigarrillos', cuenta: 'mp' }, { monto: 12000, categoria: 'Comida' }]],
  ['pagué 30.000 de luz y después 8.000 de gas ayer', [{ monto: 30000, fecha: hoy }, { monto: 8000, fecha: ayer }]],
  ['15.000 en el kiosco y 12.000 en el chino', [{ monto: 15000 }, { monto: 12000 }]],
  ['15.000 en el kiosco, también 12.000 en el chino, ah no, 13.000', [{ monto: 15000 }, { monto: 13000 }]],
  ['compré pan y también leche 3000', [{ monto: 3000 }]],   // un solo gasto contado con detalle
  ['40 mil de nafta con la visa en 3 cuotas', [{ monto: 40000, tipo: 'tarjeta', cuotas: 3 }]],
]

let fallas = 0
for (const [frase, esperado] of CASOS) {
  global.V = { texto: frase, auto: {}, manual: {}, iaHecho: null, _n: 0 }
  interpretarLocal()
  const vs = movimientos()
  const errores = []
  if (vs.length !== esperado.length) errores.push(`${vs.length} movimientos, esperaba ${esperado.length}`)
  esperado.forEach((e, i) => Object.entries(e).forEach(([k, v]) => {
    if (!vs[i] || vs[i][k] !== v) errores.push(`#${i + 1} ${k}: ${JSON.stringify(vs[i] && vs[i][k])}, esperaba ${JSON.stringify(v)}`)
  }))
  if (errores.length) { fallas++; console.log('✗', frase, '\n   ' + errores.join('\n   ')) }
  else console.log('✓', frase)
}
console.log(`\n${CASOS.length - fallas}/${CASOS.length} bien`)
process.exit(fallas ? 1 : 0)
