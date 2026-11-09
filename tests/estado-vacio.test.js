// Pruebas del estado vacío interactivo MD3 (3 tarjetas de muestra que no guardan en la cuenta).
// Uso: node tests/estado-vacio.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.esc = (s) => String(s || '')
global.icon = (n) => `<svg data-ic="${n}"></svg>`
eval(tramo('estado-vacio') + ';global.EJEMPLOS_VACIO_MD3=EJEMPLOS_VACIO_MD3;global.htmlEstadoVacioMD3=htmlEstadoVacioMD3;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('define exactamente las 3 tarjetas de demostración en 1 toque',
  EJEMPLOS_VACIO_MD3.length === 3 &&
  EJEMPLOS_VACIO_MD3.map((e) => e.id).join(',') === 'jerga,resumen,qr')

const render = htmlEstadoVacioMD3()
caso('el HTML incluye los 3 botones con data-demo, aclara que son de ejemplo y usa clases MD3',
  render.includes('data-demo="jerga"') &&
  render.includes('data-demo="resumen"') &&
  render.includes('data-demo="qr"') &&
  render.includes('No se guardan en tu cuenta'))

caso('la muestra de resumen incluye consumos en cuotas y en dólares, y la de QR es un QR válido de ARCA',
  EJEMPLOS_VACIO_MD3[1].textoResumen.includes('C.07/12') &&
  EJEMPLOS_VACIO_MD3[2].urlQr.startsWith('https://www.arca.gob.ar/fe/qr/?p='))

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
