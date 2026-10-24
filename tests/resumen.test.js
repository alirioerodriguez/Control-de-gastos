// Pruebas de la lectura de las cuotas del resumen de la tarjeta (v6.8).
// Saca cuotasDelResumen de index.html, así prueba lo mismo que corre en la app.
// Uso:  node tests/resumen.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
eval(tramo('const MESES_ABR=', '/* fin cuotas del resumen (puro) */') + ';global.cuotasDelResumen=cuotasDelResumen;global.fechaResumen=fechaResumen;')

const CASOS = [
  ['Visa (Galicia): "C.07/12" y columnas de pesos y dólares', `
RESUMEN DE CUENTA VISA
CIERRE ACTUAL 24 Oct 26 VENCIMIENTO ACTUAL 05 Nov 26
CIERRE ANTERIOR 26 Sep 26 VENCIMIENTO ANTERIOR 07 Oct 26
PRÓXIMO CIERRE 27 Nov 26 PRÓXIMO VENC. 09 Dic 26
SALDO ANTERIOR 412.300,00
SU PAGO EN PESOS -412.300,00
12-04-26 * 004512 MERCADOLIBRE*CELULAR C.07/12 45.833,33
03-08-26 K 018833 FRAVEGA C.03/06 28.500,00
15-10-26 004987 COTO SUC 120 81.230,55
20-09-26 * 007777 SAMSUNG STORE C.02/18 31.111,11
02-10-26 001234 NETFLIX.COM USD 9,99
SALDO ACTUAL $ 186.674,99   PAGO MINIMO $ 22.000,00`,
    { vence: '2026-11-05', cierre: '2026-10-24', esResumen: true, cuotas: [
      { descripcion: 'MERCADOLIBRE CELULAR', actual: 7, total: 12, monto: 45833.33, fecha: '2026-04-12' },
      { descripcion: 'FRAVEGA', actual: 3, total: 6, monto: 28500, fecha: '2026-08-03' },
      { descripcion: 'SAMSUNG STORE', actual: 2, total: 18, monto: 31111.11, fecha: '2026-09-20' }] }],
  ['Mastercard (Santander): "Cuota 04/06" y fechas con barras', `
Mastercard Santander · Resumen de tarjeta
Fecha de cierre actual: 23/10/2026   Vencimiento actual: 04/11/2026
Fecha Comprobante Detalle Cuota Pesos Dólares
10/07/2026 334455 GARBARINO SA Cuota 04/06 52.000,00
18/10/2026 998877 YPF SERVICENTRO 35.400,00
Pago mínimo 15.000,00`,
    { vence: '2026-11-04', cuotas: [{ descripcion: 'GARBARINO SA', actual: 4, total: 6, monto: 52000, fecha: '2026-07-10' }] }],
  ['Amex: "CUOTA 2 DE 3" en mayúsculas', `
AMERICAN EXPRESS
Vencimiento actual 10-11-26
05-09-26 DESPEGAR.COM CUOTA 2 DE 3 120.000,00
Saldo actual 120.000,00`,
    { vence: '2026-11-10', cuotas: [{ descripcion: 'DESPEGAR.COM', actual: 2, total: 3, monto: 120000 }] }],
  ['Naranja: "Cta. 05/10" y una bonificación en negativo', `
Tarjeta Naranja · Resumen de cuenta
Vencimiento actual: 08/11/26
11/06/26 ZAPATERIA PEPE Cta. 05/10 9.990,00
11/06/26 BONIF. ZAPATERIA PEPE Cta. 05/10 -999,00
Pago mínimo 4.000,00`,
    { vence: '2026-11-08', cuotas: [{ descripcion: 'ZAPATERIA PEPE', actual: 5, total: 10, monto: 9990 }] }],
  ['Cuota en dólares', `
Saldo actual
Vencimiento actual 05 Nov 26
01-09-26 APPLE.COM/BILL C.02/03 USD 150,00`,
    { cuotas: [{ descripcion: 'APPLE.COM/BILL', actual: 2, total: 3, monto: 150, moneda: 'USD' }] }],
  ['Fechas sueltas y "12/24" que no son cuotas', `
Saldo actual 10.000,00
Vencimiento actual 05/11/2026
Período 12/24 consumos
15/10/2026 KIOSCO 10.000,00`,
    { cuotas: [] }],
  ['"C.13/12" no existe: se descarta', `
Pago mínimo
01-01-26 RARO C.13/12 1.000,00`,
    { cuotas: [] }],
  ['Una factura común no es un resumen', `
FACTURA B Nº 0003-00001234
Total $ 54.231,80`,
    { esResumen: false, cuotas: [] }],
]
let fallas = 0
for (const [nombre, texto, esp] of CASOS) {
  const r = cuotasDelResumen(texto)
  const errs = []
  for (const k of ['vence', 'cierre', 'esResumen']) if (k in esp && r[k] !== esp[k]) errs.push(`${k}: ${r[k]} (esperaba ${esp[k]})`)
  if (r.cuotas.length !== esp.cuotas.length) errs.push(`leí ${r.cuotas.length} cuotas (esperaba ${esp.cuotas.length}): ${JSON.stringify(r.cuotas)}`)
  else esp.cuotas.forEach((c, i) => { for (const k in c) if (r.cuotas[i][k] !== c[k]) errs.push(`cuota ${i + 1} ${k}: ${r.cuotas[i][k]} (esperaba ${c[k]})`) })
  if (errs.length) fallas++
  console.log(errs.length ? '✗' : '✓', nombre + (errs.length ? '\n    ' + errs.join('\n    ') : ''))
}
console.log(`\n${CASOS.length - fallas}/${CASOS.length} bien`)
process.exit(fallas ? 1 : 0)
