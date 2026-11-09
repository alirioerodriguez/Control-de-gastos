// Pruebas del guardado y resolución de la cotización del dólar MEP del día en cada movimiento.
// Uso: node tests/dolar-dia.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
eval(tramo('dolar-dia') + ';global.extraerVentaDolar=extraerVentaDolar;global.urlDolarFecha=urlDolarFecha;global.resolverDolarCache=resolverDolarCache;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('extrae venta válida de dolarapi.com o argentinadatos.com', extraerVentaDolar({ venta: 1180.5 }) === 1180.5 && extraerVentaDolar({ venta: '1250,25' }) === 1250.25)
caso('descarta respuestas vacías o sin cotización positiva', extraerVentaDolar({}) === null && extraerVentaDolar({ venta: 0 }) === null)
caso('arma URL de hoy en dolarapi.com y de fecha pasada en argentinadatos.com',
  urlDolarFecha('2026-11-09', '2026-11-09') === 'https://dolarapi.com/v1/dolares/bolsa' &&
  urlDolarFecha('2026-03-15', '2026-11-09') === 'https://api.argentinadatos.com/v1/cotizaciones/dolares/bolsa/2026/03/15')

const cache = { '2026-11-08': 1150, '2026-11-09': 1165 }
caso('encuentra la cotización exacta en caché', resolverDolarCache('2026-11-08', cache) === 1150)
caso('sin conexión para hoy usa la última cotización conocida en caché como plan B', resolverDolarCache('2026-11-10', cache) === 1165)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
