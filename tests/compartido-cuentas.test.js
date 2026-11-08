// Gastos compartidos en tus cuentas: tu parte suma al gasto del mes y a su categoría, lo que pagaste sale de tu
// cuenta y los pagos para saldar no son gasto. Saca el código de index.html. Uso: node tests/compartido-cuentas.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)
const linea = (re) => html.match(re)[0]
global.user = { id: 'yo' }
global.CTA_MON = { mp: 'ARS', usd: 'USD' }
global.round2 = (n) => Math.round(n * 100) / 100
eval(linea(/function sharedOwed\(t\)\{[\s\S]*?\n  return [^\n]*\n/) + tramo('compartido-cuentas') +
  ';global.parteMia=parteMia;global.compartidoMes=compartidoMes;global.compartidoDeCuenta=compartidoDeCuenta;global.esPagoSaldo=esPagoSaldo;global.SALDO_TITULO=SALDO_TITULO;')

let fallas = 0
const caso = (nombre, ok, detalle) => { if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }
const g = (o) => ({ fecha: '2026-11-05', titulo: 'Cena', monto: 30000, pagado_por: 'yo', dividido: 'ambos', created_by: 'yo', categoria: 'Salidas', ...o })

caso('mitad y mitad: tu parte es la mitad, pagues vos o el otro', parteMia(g()) === 15000 && parteMia(g({ pagado_por: 'sofi' })) === 15000)
caso('porcentaje: `porcentaje` es la parte de quien pagó', parteMia(g({ dividido: 'pct', porcentaje: 70 })) === 21000 && parteMia(g({ dividido: 'pct', porcentaje: 70, pagado_por: 'sofi' })) === 9000)
caso('entero: lo debe entero quien no pagó', parteMia(g({ dividido: 'solo_otro' })) === 0 && parteMia(g({ dividido: 'solo_otro', pagado_por: 'sofi' })) === 30000)
caso('el pago para saldar no es gasto', parteMia(g({ titulo: SALDO_TITULO, dividido: 'solo_otro', pagado_por: 'sofi' })) === 0)

global.STXN = [
  g(),
  g({ titulo: 'Super', monto: 10000, pagado_por: 'sofi', categoria: 'Supermercado', created_by: 'sofi', cuenta: 'mp' }),
  g({ fecha: '2026-10-30', monto: 99999 }),
  g({ titulo: SALDO_TITULO, dividido: 'solo_otro', monto: 5000, cuenta: 'mp' }),
  g({ cuenta: 'usd', monto: 100, categoria: 'Viaje' }),
]
const nov = compartidoMes('2026-11', 'ARS')
caso('el mes suma solo tu parte, de ese mes y en esa moneda', nov.total === 20000 && nov.cats.Salidas === 15000 && nov.cats.Supermercado === 5000, nov)
caso('lo cargado en una cuenta en dólares va a los dólares', compartidoMes('2026-11', 'USD').total === 50)
caso('de tu cuenta sale lo que pagaste vos (incluido el pago para saldar), no lo que cargó el otro con su cuenta', compartidoDeCuenta('mp') === 5000 && compartidoDeCuenta('usd') === 100)

console.log(`\n${7 - fallas}/7 bien`)
process.exit(fallas ? 1 : 0)
