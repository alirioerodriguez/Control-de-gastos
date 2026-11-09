// Pruebas del cupo mensual gratuito de IA (15 relecturas y 1 resumen PDF por mes, sin cobro aún).
// Saca el código de index.html con tests/tramo.js. Uso: node tests/cupo-ia.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.PROFILE = null
eval(tramo('cupo-ia') + ';global.esPro=esPro;global.estadoCupoIA=estadoCupoIA;global.textoCupoRelectura=textoCupoRelectura;global.textoCupoResumen=textoCupoResumen;global.CUPO_IA_RELECTURAS=CUPO_IA_RELECTURAS;global.CUPO_IA_RESUMENES=CUPO_IA_RESUMENES;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('topes gratis por defecto: 15 relecturas y 1 resumen por mes', CUPO_IA_RELECTURAS === 15 && CUPO_IA_RESUMENES === 1)

const inicio = estadoCupoIA({ mes: '2026-11', relecturasUsadas: 3, resumenesUsados: 0 }, '2026-11', false)
caso('cuenta bien cuánto queda en el mismo mes (15 - 3 = 12)', inicio.relecturasRestantes === 12 && inicio.resumenesRestantes === 1 && inicio.puedeRelectura && inicio.puedeResumen, inicio)
caso('texto en voz dice cuántas relecturas quedan', textoCupoRelectura(inicio) === 'Te quedan 12 relecturas con IA este mes · la voz y el QR son ilimitados.', textoCupoRelectura(inicio))

const agotado = estadoCupoIA({ mes: '2026-11', relecturasUsadas: 15, resumenesUsados: 1 }, '2026-11', false)
caso('al llegar a 15 relecturas y 1 resumen se bloquea solo la IA', !agotado.puedeRelectura && !agotado.puedeResumen && agotado.relecturasRestantes === 0 && agotado.resumenesRestantes === 0, agotado)
caso('cuando se termina el cupo avisa amablemente qué sigue andando gratis', textoCupoRelectura(agotado).includes('siguen andando gratis') && textoCupoResumen(agotado).includes('gratis'), { r: textoCupoRelectura(agotado), s: textoCupoResumen(agotado) })

const cambioMes = estadoCupoIA({ mes: '2026-10', relecturasUsadas: 15, resumenesUsados: 1 }, '2026-11', false)
caso('al cambiar de mes calendario el cupo vuelve a 15 y 1', cambioMes.relecturasRestantes === 15 && cambioMes.resumenesRestantes === 1 && cambioMes.puedeRelectura, cambioMes)

global.PROFILE = { plan: 'pro' }
const pro = estadoCupoIA({ mes: '2026-11', relecturasUsadas: 99, resumenesUsados: 9 }, '2026-11', esPro())
caso('bandera esPro desbloquea el cupo sin límites para conectar pagos más adelante', esPro() === true && pro.puedeRelectura && pro.puedeResumen && pro.relecturasRestantes === Infinity, pro)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
