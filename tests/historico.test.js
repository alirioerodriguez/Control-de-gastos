// Pruebas del histórico anual en 3 vistas: nominal, en pesos de hoy (ajustado por IPC) y en dólares del día.
// Uso: node tests/historico.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
eval(tramo('historico') + ';global.factorIpcEntre=factorIpcEntre;global.convertirMovimientoVista=convertirMovimientoVista;global.EXPLICACION_VISTA_HIST=EXPLICACION_VISTA_HIST;')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

// Si en septiembre hubo 3,5 % y en octubre 2,7 %, un peso de agosto se multiplica por 1,035 * 1,027 = 1,062945
const tasas = { '2026-08': 4.2, '2026-09': 3.5, '2026-10': 2.7, '2026-11': 2.4 }
const fAgoOct = factorIpcEntre('2026-08', '2026-10', tasas)
caso('el factor IPC acumula los meses posteriores al gasto hasta el mes actual', Math.abs(fAgoOct - 1.035 * 1.027) < 1e-6, fAgoOct)
caso('el mismo mes tiene factor 1 (no se infla a sí mismo)', factorIpcEntre('2026-10', '2026-10', tasas) === 1)

const movMarzo = { fecha: '2026-08-15', monto: 100000, moneda: 'ARS', dolar_dia: 1000 }
const vNominal = convertirMovimientoVista(movMarzo, 'nominal', { mesHoy: '2026-10', tasasIpc: tasas, dolarFallback: 1200 })
const vIpc = convertirMovimientoVista(movMarzo, 'ipc', { mesHoy: '2026-10', tasasIpc: tasas, dolarFallback: 1200 })
const vUsd = convertirMovimientoVista(movMarzo, 'usd', { mesHoy: '2026-10', tasasIpc: tasas, dolarFallback: 1200 })

caso('vista nominal conserva los $ 100.000 pagados ese día', vNominal === 100000, vNominal)
caso('vista en pesos de hoy ajusta por IPC acumulado ($ 106.294,50)', vIpc === 106294.5, vIpc)
caso('vista en dólares usa dolar_dia del movimiento (1000 -> US$ 100) y no el dólar de hoy (1200)', vUsd === 100, vUsd)
caso('las 3 vistas tienen su explicación de una línea para la pantalla',
  EXPLICACION_VISTA_HIST.nominal.length > 10 && EXPLICACION_VISTA_HIST.ipc.includes('INDEC') && EXPLICACION_VISTA_HIST.usd.includes('MEP'))

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
