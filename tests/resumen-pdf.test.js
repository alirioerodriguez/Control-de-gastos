// Lector de resúmenes en PDF (v7.6): filas por coordenada Y, plantilla por emisor, suma contra el saldo del resumen
// y fecha efectiva de la cuota. Usa fixtures sintéticos (tests/fixtures/resumenes-sinteticos.js): texto con
// coordenadas como el de pdf.js, sin PDF ni datos reales. Uso:  node tests/resumen-pdf.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)
global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
global.Impuestos = require('../impuestos.js')
eval(tramo('resumen') + ';global.cuotasDelResumen=cuotasDelResumen;global.renglonesPDF=renglonesPDF;global.emisorDelResumen=emisorDelResumen;global.validarSumaResumen=validarSumaResumen;')
const F = require('./fixtures/resumenes-sinteticos')

let fallas = 0, total = 0
const ok = (cond, msg, det) => { total++; if (!cond) fallas++; console.log(cond ? '✓' : '✗', msg + (cond ? '' : '\n    ' + det)) }

// 1) Cada banco: del texto con coordenadas al resultado completo
for (const banco of ['GALICIA', 'SANTANDER', 'BBVA', 'ICBC', 'NARANJA']) {
  const esp = F.ESPERADO[banco], texto = renglonesPDF(F[banco]), r = cuotasDelResumen(texto)
  const errs = []
  if (r.emisor !== esp.emisor) errs.push(`emisor ${r.emisor} (esperaba ${esp.emisor})`)
  if (r.validacion.estado !== esp.estado) errs.push(`validación ${JSON.stringify(r.validacion)}`)
  for (const k of ['cierre', 'vence']) if (r[k] !== esp[k]) errs.push(`${k}: ${r[k]} (esperaba ${esp[k]})`)
  if (r.cuotas.length !== esp.cuotas.length) errs.push(`leí ${r.cuotas.length} cuotas: ${JSON.stringify(r.cuotas)}`)
  else esp.cuotas.forEach((c, i) => { for (const k in c) if (r.cuotas[i][k] !== c[k]) errs.push(`cuota ${i + 1} ${k}: ${r.cuotas[i][k]} (esperaba ${c[k]})`) })
  if (esp.usd !== undefined && r.consumosUsd.totalUsd !== esp.usd) errs.push(`USD ${r.consumosUsd.totalUsd} (esperaba ${esp.usd})`)
  ok(!errs.length, `${esp.emisor}: emisor, cuotas, fechas y suma`, errs.join('\n    ') + '\n' + texto)
}

// 2) Filas por Y: el orden de entrega no importa y la columna de dólares sale marcada
const sant = renglonesPDF(F.SANTANDER).split('\n')
ok(/^20\/10\/2026 112233 SERVICIO ONLINE DEMO USD 12,50$/.test(sant.find((l) => /SERVICIO/.test(l)) || ''), 'Santander: el importe de la columna «Dólares» sale con USD', sant.join('\n'))
ok(/^10\/07\/2026 334455 LIBRERIA DEMO SA Cuota 04\/06 52\.000,00$/.test(sant.find((l) => /LIBRERIA/.test(l)) || ''), 'Santander: la fila se arma completa pese a la diferencia de Y', sant.join('\n'))
const a = renglonesPDF(F.GALICIA), b = renglonesPDF([...F.GALICIA].reverse())
ok(a === b, 'el orden en que pdf.js entrega los pedazos no cambia las filas', a + '\n--\n' + b)

// 3) Emisor: por el encabezado; sin pista, ninguno; con dos, no se adivina
ok(emisorDelResumen('Resumen de tarjeta\nVISA') === null, 'sin nombre de banco: no hay emisor', '')
ok(emisorDelResumen('Banco Santander\nTarjeta Naranja') === null, 'dos emisores en el encabezado: no se adivina', '')
ok((emisorDelResumen('Resumen\nTARJETA NARANJA X') || {}).id === 'naranja', 'detecta Naranja en mayúsculas', '')

// 4) La suma: si no cuadra avisa; si falta un dato, dice sin-datos y no da por bueno
const nc = cuotasDelResumen(renglonesPDF(F.GALICIA_NO_CUADRA)).validacion
ok(nc.estado === 'no-cuadra' && nc.diferencia === 1500 && nc.calculado === 127063.88, 'Galicia sin el renglón de sellos: no cuadra y dice por cuánto (1.500)', JSON.stringify(nc))
const sd = validarSumaResumen('Saldo actual 10.000,00\n15/10/2026 KIOSCO 10.000,00', null)
ok(sd.estado === 'sin-datos', 'sin saldo anterior: sin-datos (no se da por bueno lo que no se pudo comprobar)', JSON.stringify(sd))
const c1 = validarSumaResumen('Saldo anterior 100,00\n01/10/26 A 10,10\n02/10/26 B 0,20\nSaldo actual 110,30', null)
ok(c1.estado === 'cuadra', 'suma con centavos (100 + 10,10 + 0,20 = 110,30)', JSON.stringify(c1))
const c2 = validarSumaResumen('Saldo anterior 100,00\n01/10/26 A 10,10\nSaldo actual 110,11', null)
ok(c2.estado === 'no-cuadra' && c2.diferencia === 0.01, 'un centavo de diferencia ya no cuadra', JSON.stringify(c2))

// 5) Fecha efectiva = cierre del resumen; la fecha de compra original se conserva
const g = cuotasDelResumen(renglonesPDF(F.GALICIA)).cuotas[0]
ok(g.fechaCompra === '2026-04-12' && g.fechaEfectiva === '2026-10-24' && g.fecha === '2026-04-12', 'cuota de abril en el resumen de octubre: compra 12/04, efectiva 24/10', JSON.stringify(g))

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
