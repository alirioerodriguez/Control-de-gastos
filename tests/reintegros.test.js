// Pruebas de la calculadora de topes de reintegro por banco o billetera.
// Saca el código de index.html con tests/tramo.js. Uso: node tests/reintegros.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
eval(tramo('reintegros') + ';global.calcularPlanReintegro=calcularPlanReintegro;global.gastoParaAgotarTope=gastoParaAgotarTope;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('25 % con tope de $ 10.000 se agota pagando exactamente $ 40.000', gastoParaAgotarTope(25, 10000) === 40000)

const promos = [
  { id: 'p1', medio: 'Banco Galicia', porcentaje: 25, tope: 10000, dias: 'Jueves' },
  { id: 'p2', medio: 'Mercado Pago', porcentaje: 20, tope: 4000, dias: 'Todos los días' },
]
const plan = calcularPlanReintegro(55000, promos)
caso('divide una compra de $ 55.000: $ 40.000 con la primera promo (ahorra $ 10.000) y $ 15.000 con la segunda (ahorra $ 3.000)',
  plan.pasos.length === 2 &&
  plan.pasos[0].pagar === 40000 && plan.pasos[0].reintegro === 10000 && plan.pasos[0].agotoTope === true &&
  plan.pasos[1].pagar === 15000 && plan.pasos[1].reintegro === 3000 && plan.pasos[1].agotoTope === false &&
  plan.reintegroTotal === 13000 && plan.neto === 42000, plan)

const sobra = calcularPlanReintegro(80000, promos)
caso('si la compra supera todos los topes, indica cuánto queda sin reintegro',
  sobra.pasos[0].pagar === 40000 && sobra.pasos[1].pagar === 20000 && sobra.sinPromo === 20000 && sobra.reintegroTotal === 14000, sobra)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
