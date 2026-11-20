// Ventanas que salen una sola vez: invitación a tester (a quien ya usa la app, nunca al admin) y Savia (solo Sharon).
// Uso: node tests/una-vez.test.js
const fs = require('fs')
const path = require('path')
const tramo = require('./tramo')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const { ventanaQueToca, mailTesterValido, SAVIA_PARA } = new Function(tramo(html, 'una-vez') + '; return { ventanaQueToca, mailTesterValido, SAVIA_PARA }')()

let fallas = 0
const caso = (nombre, ok, detalle) => { if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }
const movs = (n, dias) => Array.from({ length: n }, (_, i) => ({ created_at: `2026-11-${String(1 + (i % dias)).padStart(2, '0')}T10:00:00Z` }))
const sharon = SAVIA_PARA[0]

caso('Sharon ve primero Savia', ventanaQueToca({ userId: sharon, movs: movs(50, 10) }) === 'savia')
caso('después de Savia, a Sharon le toca la de tester', ventanaQueToca({ userId: sharon, vistas: { savia: 'x' }, movs: movs(50, 10) }) === 'tester')
caso('con las dos vistas, nada más', ventanaQueToca({ userId: sharon, vistas: { savia: 'x', tester: 'y' }, movs: movs(50, 10) }) === null)
caso('Savia no le sale a nadie más', ventanaQueToca({ userId: 'otra', movs: movs(2, 1) }) === null)
caso('tester: a quien ya la usa (10 movimientos en 3 días)', ventanaQueToca({ userId: 'otra', movs: movs(10, 3) }) === 'tester')
caso('tester: no a quien recién empieza', ventanaQueToca({ userId: 'otra', movs: movs(9, 3) }) === null && ventanaQueToca({ userId: 'otra', movs: movs(30, 2) }) === null)
caso('tester: nunca al admin', ventanaQueToca({ userId: 'otra', esAdmin: true, movs: movs(50, 10) }) === null)
caso('mail del tester', mailTesterValido(' ana@gmail.com ') && !mailTesterValido('ana@') && !mailTesterValido(''))
caso('se llama al terminar de cargar y no repite en la sesión', /setTimeout\(ventanaUnaVez,/.test(html) && /ventanaUnaVezHecha=true/.test(html))
caso('el sí manda tipo tester al panel', /tipo:"tester"/.test(html))
caso('el logo de Savia está en el repo', fs.existsSync(path.join(__dirname, '..', 'savia.png')))

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
