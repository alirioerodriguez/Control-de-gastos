// Pruebas de "Ajustar por rendimiento" en cuentas remuneradas (Mercado Pago, Ualá, Naranja X).
// Uso: node tests/rendimiento-cuenta.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
global.fmt = (n) => '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
eval(tramo('rendimiento-cuenta') + ';global.calcularAjusteRendimiento=calcularAjusteRendimiento;global.esCuentaRemunerada=esCuentaRemunerada;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('detecta billeteras e inversiones como cuentas remuneradas',
  esCuentaRemunerada('billetera', 'Mercado Pago') &&
  esCuentaRemunerada('inversion', 'FCI') &&
  !esCuentaRemunerada('efectivo', 'Efectivo'))

const r = calcularAjusteRendimiento({ cuentaKey: 'mp', cuentaNombre: 'Mercado Pago', saldoActual: 250000, saldoBilletera: 253420.5, fecha: '2026-11-09', moneda: 'ARS' })
caso('cuando la billetera muestra más saldo, genera un movimiento de categoría Rendimientos y origen rendimiento',
  r.ok && r.diferencia === 3420.5 && r.fila.categoria === 'Rendimientos' && r.fila.origen === 'rendimiento' && r.fila.tipo === 'ingreso', r)

const menor = calcularAjusteRendimiento({ cuentaKey: 'mp', cuentaNombre: 'Mercado Pago', saldoActual: 250000, saldoBilletera: 245000, fecha: '2026-11-09', moneda: 'ARS' })
caso('si el saldo real es menor que el anotado, no registra rendimiento negativo y avisa',
  !menor.ok && menor.diferencia === -5000 && menor.mensaje.includes('menor'), menor)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
