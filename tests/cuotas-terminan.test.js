// Qué compras pagan su última cuota en un mes (al mes siguiente esa plata se libera).
// Saca el código de index.html con tests/tramo.js. Uso: node tests/cuotas-terminan.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

eval(tramo('cuotas-terminan') + ';global.comprasQueTerminan=comprasQueTerminan;global.listaNombres=listaNombres;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

const purch = [
  { id: 'a', descripcion: 'Celular' },
  { id: 'b', descripcion: 'Heladera' },
  { id: 'c', descripcion: '' },
]
const inst = [
  { purchase_id: 'a', mes: '2026-11-01' }, { purchase_id: 'a', mes: '2026-12-01' },
  { purchase_id: 'b', mes: '2026-12-01' }, { purchase_id: 'b', mes: '2027-01-01' },
  { purchase_id: 'c', mes: '2026-12-01' },
]
const r = comprasQueTerminan('2026-12', purch, inst)
caso('en diciembre terminan el celular y la compra sin nombre; la heladera sigue en enero', JSON.stringify(r) === JSON.stringify(['Celular', 'Compra']), r)
caso('un mes sin cuotas que terminen da una lista vacía', comprasQueTerminan('2026-11', purch, inst).length === 0)
caso('lista los nombres en castellano', listaNombres(['Celular']) === 'Celular' && listaNombres(['A', 'B', 'C']) === 'A, B y C')

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
