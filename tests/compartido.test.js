// Pruebas del resumen de gastos compartidos que se manda por WhatsApp.
// Saca resumenCompartido de index.html, así prueba lo mismo que corre en la app.
// Uso:  node tests/compartido.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
eval(html.match(/function fechaCorta\(.*\n/)[0] + tramo('function resumenCompartido', 'function bindDividir') +
  ';global.resumenCompartido=resumenCompartido;')

const f = (n) => '$ ' + n.toLocaleString('es-AR')
const movs = [
  { fecha: '2026-10-12', titulo: 'Cena', monto: 30000, pagueYo: true, reparto: 'mitad' },
  { fecha: '2026-10-14', titulo: 'Super', monto: 20000, pagueYo: false, reparto: 'mitad' },
]
let fallas = 0
const caso = (nombre, ok, detalle) => { if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n' + detalle) }

const meDebe = resumenCompartido('Sofi Pérez', movs, 5000, 'alirio.mp', f)
caso('saluda por el nombre y lista los gastos en orden', meDebe.startsWith('Hola Sofi! Así vamos con los gastos compartidos:\n• ') &&
  meDebe.indexOf('Cena — pagué yo $ 30.000 (mitad)') < meDebe.indexOf('Super — pagaste vos $ 20.000 (mitad)'), meDebe)
caso('si te debe, el saldo y tu alias', meDebe.includes('Saldo: me debés $ 5.000.') && meDebe.endsWith('Mi alias para transferir: alirio.mp'), meDebe)
const leDebo = resumenCompartido('Sofi', movs, -5000, 'alirio.mp', f)
caso('si le debés, sin alias', leDebo.includes('Saldo: te debo $ 5.000.') && !leDebo.includes('alias'), leDebo)
caso('al día', resumenCompartido('Sofi', movs, 0, '', f).includes('Estamos al día.'), '')
const muchos = Array.from({ length: 20 }, (_, i) => ({ fecha: `2026-09-${String(i + 1).padStart(2, '0')}`, titulo: 'G' + (i + 1), monto: 100, pagueYo: true, reparto: 'mitad' }))
const largo = resumenCompartido('Sofi', muchos, 1000, '', f)
caso('con muchos gastos, solo los 15 últimos y lo avisa', largo.includes('(los últimos 15 de 20)') && largo.includes('G20') && !largo.includes('G5 '), largo)

console.log(`\n${5 - fallas}/5 bien`)
process.exit(fallas ? 1 : 0)
