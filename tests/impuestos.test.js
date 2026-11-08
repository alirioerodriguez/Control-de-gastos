// Pruebas de impuestos.js (pagar en dólares con tarjeta y paquetes del exterior). Uso: node tests/impuestos.test.js
const { pagoConTarjeta, envio } = require('../impuestos.js')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

const netflix = pagoConTarjeta({ precioUsd: 10, dolar: 1000, tipo: 'digital', iibbPct: 2 })
caso('servicio digital en pesos: IVA 21 + percepción 30 + IIBB 2 = 53 %', netflix.precioPesos === 10000 && netflix.impuestos === 5300 && netflix.total === 15300 && netflix.recargoPct === 53, netflix)
caso('cada dólar termina valiendo 1,53 veces el oficial', netflix.dolarFinal === 1530, netflix)

const conDolares = pagoConTarjeta({ precioUsd: 10, dolar: 1000, tipo: 'digital', iibbPct: 2, conDolares: true })
caso('con dólares propios no hay percepción del 30 %', conDolares.impuestos === 2300 && !conDolares.lineas.some((l) => l.nombre.startsWith('Percepción')), conDolares)

const hotel = pagoConTarjeta({ precioUsd: 100, dolar: 1000, tipo: 'exterior', iibbPct: 2 })
caso('compra en el exterior que no es digital: solo la percepción', hotel.impuestos === 30000 && hotel.lineas.length === 1, hotel)

const libro = pagoConTarjeta({ precioUsd: 20, dolar: 1000, tipo: 'excluido' })
caso('libros, salud y educación: sin impuestos', libro.impuestos === 0 && libro.total === 20000, libro)

const vacio = pagoConTarjeta({ precioUsd: '', dolar: 1000 })
caso('sin precio no rompe', vacio.total === 0 && vacio.dolarFinal === 0, vacio)

const chico = envio({ fobUsd: 100, fleteUsd: 20, dolar: 1000, arancelPct: 20 })
caso('dentro de la franquicia: solo IVA (sin arancel ni estadística)', chico.dentroDeFranquicia && chico.aduanaUsd === 25.2 && chico.lineasUsd.length === 1, chico)
caso('pagado con tarjeta en pesos suma la percepción sobre la compra', chico.percepcion === 36000 && chico.total === 120000 + 25200 + 36000, chico)

const grande = envio({ fobUsd: 600, fleteUsd: 0, dolar: 1000, arancelPct: 20, pagadoConTarjetaEnPesos: false })
caso('lo que pasa de USD 400 paga arancel y 3 % de estadística', grande.excedenteUsd === 200 && grande.aduanaUsd === 126 + 40 + 6 && grande.percepcion === 0, grande)
caso('más de USD 3.000 queda fuera del régimen', envio({ fobUsd: 3500, dolar: 1000 }).fueraDeRegimen === true)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
