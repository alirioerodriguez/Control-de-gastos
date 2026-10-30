// Gastos compartidos por voz con VARIAS personas (el intérprete local, sin IA ni internet).
// voz.test.js usa una sola persona («Sofi»); acá hay cuatro y se comprueba que cada frase termine en la persona
// correcta, con quién pagó y cómo se reparte. Saca el código directamente de index.html.
// Uso:  node tests/personas.test.js
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
const codigo = [
  html.match(/function diasAtras\(.*?\n/)[0],
  tramo('const round2 =', '/* ---------- fechas locales'),
  tramo('const p2 =', 'function mesSuma'),
  html.match(/function mesSuma\(.*?\n/)[0],
  tramo('function primeraCuotaMes', 'function cuotasDeTarjetaMes'),
  tramo('const NUM_PAL=', '/* ---------------- Gemini'),
].join('\n')

// lo mínimo de la app que el intérprete necesita
global.CATS = ['Supermercado', 'Auto', 'Salidas', 'Salud', 'Sueldo', 'Servicios', 'Nafta', 'Comida', 'Cigarrillos', 'Transporte',
  'Suscripciones', 'Ropa', 'Mascotas', 'Regalos', 'Alquiler', 'Gimnasio', 'Cuidado personal', 'Luz', 'Gas', 'Internet', 'Celular', 'Ventas'].map((nombre) => ({ nombre }))
global.ACCOUNTS = [{ key: 'ef', nombre: 'Efectivo' }, { key: 'mp', nombre: 'Mercado Pago' }, { key: 'gal', nombre: 'Banco Galicia' }, { key: 'uala', nombre: 'Ualá' }]
global.CARDS = [{ id: 'v1', alias: '', banco: 'Galicia', marca: 'Visa' }, { id: 'm1', alias: '', banco: 'Santander', marca: 'Mastercard' }]
global.PAIRS = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }]; global.TX = []; global.PURCH = []; global.STXN = []; global.user = { id: 'u' }
global.catsAlfa = () => CATS
global.cardTitulo = (c) => c.marca + ' ' + c.banco
// Cuatro personas con las que se comparten gastos: pareja, amigo, madre y una con nombre corto que está dentro de otro («Mariana»)
const GENTE = { u2: 'Sofi', u3: 'Fede', u4: 'Mamá', u5: 'Ana' }
global.otherId = (p) => ({ p1: 'u2', p2: 'u3', p3: 'u4', p4: 'u5' })[p.id]
global.otherProf = (id) => ({ apodo: GENTE[id] || 'usuario' })
eval(codigo + ';global.planCuotas=planCuotas;global.mesSuma=mesSuma;global.interpretarLocal=interpretarLocal;global.movimientos=()=>VS;global.resetVoz=()=>{VS=[];vozSel=0;APRENDE={categoria:{},comercio:{}};};global.aprender=(a)=>{APRENDE=a;};')

const hoy = diasAtras(0)
// frase → lo que tiene que salir (uno por movimiento; sólo se comparan los campos que se ponen)
// «pagador: 'u'» es el usuario; u2 = Sofi, u3 = Fede, u4 = Mamá, u5 = Ana. «pair» es la conexión con esa persona.
const CASOS = [
  'Cada frase termina en la persona que nombrás',
  ['cena con Sofi 36 mil a medias', [{ tipo: 'compartido', pair: 'p1', monto: 36000, split: 'ambos', pagador: 'u' }]],
  ['cena con Fede 24 mil a medias', [{ tipo: 'compartido', pair: 'p2', monto: 24000, split: 'ambos', pagador: 'u', categoria: 'Comida', conQuien: 'Fede' }]],
  ['el super con Mamá 30 mil a medias', [{ tipo: 'compartido', pair: 'p3', monto: 30000, conQuien: 'Mamá', categoria: 'Supermercado' }]],
  ['pagó Ana 12 mil de la farmacia a medias', [{ tipo: 'compartido', pair: 'p4', pagador: 'u5', categoria: 'Salud' }]],

  'Quién pagó: el usuario o la otra persona',
  ['Fede pagó la nafta 20 mil a medias', [{ tipo: 'compartido', pair: 'p2', pagador: 'u3', monto: 20000, categoria: 'Nafta' }]],
  ['el super con Mamá 30 mil, pagó mamá', [{ tipo: 'compartido', pair: 'p3', pagador: 'u4' }]],
  ['Sofi pagó el súper, 48.000, a medias', [{ tipo: 'compartido', pair: 'p1', pagador: 'u2', monto: 48000 }]],
  ['pagué la luz 10 mil, Fede me debe la mitad', [{ tipo: 'compartido', pair: 'p2', pagador: 'u', split: 'ambos', categoria: 'Luz' }]],

  'Cómo se reparte',
  ['Sofi me debe 15 mil del cine', [{ tipo: 'compartido', pair: 'p1', split: 'solo_otro', monto: 15000 }]],
  ['Fede me debe 8 mil del cine', [{ tipo: 'compartido', pair: 'p2', split: 'solo_otro' }]],

  'Sin tildes ni mayúsculas, como lo escribe el dictado',
  ['almuerzo con mama 8 mil a medias', [{ tipo: 'compartido', pair: 'p3', conQuien: 'Mamá' }]],
  ['cena con MAMÁ 8 mil a medias', [{ tipo: 'compartido', pair: 'p3' }]],
  ['cena con fede 8 mil a medias', [{ tipo: 'compartido', pair: 'p2' }]],

  'Un nombre dentro de otra palabra no cuenta',
  ['regalo para Mariana 5 mil', [{ tipo: 'gasto', categoria: 'Regalos', conQuien: null }]],      // «Ana» está dentro de «Mariana»
  ['sándwich de Federico 3 mil', [{ tipo: 'gasto' }]],                                              // «Fede» está dentro de «Federico»
  ['el alfajor de Sofía 2 mil', [{ tipo: 'gasto' }]],                                               // «Sofi» está dentro de «Sofía»

  'Sin nadie nombrado es un gasto personal',
  ['el super 30 mil', [{ tipo: 'gasto', monto: 30000, categoria: 'Supermercado', conQuien: null }]],
  ['pagué 15 mil de nafta', [{ tipo: 'gasto', categoria: 'Nafta' }]],

  'Varios gastos en una frase, cada uno con su persona',
  ['cena con Fede 24 mil a medias y el cine con Sofi 10 mil a medias', [{ tipo: 'compartido', pair: 'p2', monto: 24000 }, { tipo: 'compartido', pair: 'p1', monto: 10000 }]],

  '«y el / y la» corta aunque no haya coma (antes se perdía el primer gasto sin avisar)',
  ['el super 30 mil y la nafta 20 mil', [{ monto: 30000, categoria: 'Supermercado', tipo: 'gasto' }, { monto: 20000, categoria: 'Nafta', tipo: 'gasto' }]],
  ['cena con Fede 24 mil a medias y el cine con Sofi 10 mil a medias', [{ tipo: 'compartido', pair: 'p2', monto: 24000, categoria: 'Comida' }, { tipo: 'compartido', pair: 'p1', monto: 10000, categoria: 'Salidas' }]],
  ['pagué 15 mil de nafta y la mitad de 8 mil de peaje con Fede', [{ monto: 15000 }, { monto: 8000 }]],

  'Los números dichos con palabras no se parten en dos gastos',
  ['treinta y un mil de nafta', [{ monto: 31000, categoria: 'Nafta' }]],
  ['cuarenta y cinco mil en el super', [{ monto: 45000, categoria: 'Supermercado' }]],
  ['veinte y cinco mil de alquiler', [{ monto: 25000, categoria: 'Alquiler' }]],

  'LÍMITE CONOCIDO: un gasto con dos personas a la vez (grupo). Hoy se asigna a UNA sola, la última que nombrás, y la otra no se avisa.',
  ['cena con Sofi y Fede 60 mil a medias', [{ tipo: 'compartido', pair: 'p2', monto: 60000 }]],
]

let fallas = 0
let total = 0
for (const caso of CASOS) {
  if (typeof caso === 'string') { console.log('\n— ' + caso); continue }
  let [frase, esperado] = caso; total++
  resetVoz()
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
console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
