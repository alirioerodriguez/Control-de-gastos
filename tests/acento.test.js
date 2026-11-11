// Pruebas del color principal elegible (Más → Ajustes → Apariencia → Color principal).
// aplicarAcento() pisa --brand / --on-brand / --accent-ink: el texto de los botones y el del menú
// tienen que leerse (4,5:1) con cualquier color que elija la persona y en cualquiera de los temas.
// Uso: node tests/acento.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (nombre) => require('./tramo')(html, nombre)

// Las tarjetas de cada tema, sacadas del CSS (así la prueba sigue a la paleta si cambia)
const tarjetas = [...new Set([...html.matchAll(/--card:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1].toLowerCase()))]

const props = new Map()
let cardActual = '#ffffff'
global.document = { documentElement: { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) } } }
global.getComputedStyle = () => ({ getPropertyValue: (k) => (k === '--card' ? cardActual : '') })
global.UI = { acento: null }
let guardado = 0
global.saveUI = () => { guardado++ }
eval(tramo('acento') + ';Object.assign(global,{ACENTOS,hexRGB,rgbHEX,contraste,aplicarAcento});')

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('hay tarjetas de tema para probar', tarjetas.length >= 3, tarjetas)
caso('hexRGB acepta #abc, rechaza basura', JSON.stringify(hexRGB('#abc')) === '[170,187,204]' && hexRGB('rojo') === null && hexRGB('') === null)

// 8 colores predefinidos + extremos que obligan a ajustar (casi blanco, casi negro, amarillo, neón)
const colores = ACENTOS.filter((a) => a.k).map((a) => a.k).concat(['#ffffff', '#fefefe', '#000000', '#111111', '#ffff00', '#1dea00', '#808080', '#7f7f7f', '#ff0000'])
// y 200 al azar, con semilla fija para que la prueba sea siempre la misma
let semilla = 7
const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647
for (let i = 0; i < 200; i++) colores.push(rgbHEX([azar() * 255, azar() * 255, azar() * 255]))

const malos = []
for (const card of tarjetas) {
  cardActual = card
  for (const c of colores) {
    props.clear()
    aplicarAcento(c)
    const fondo = hexRGB(props.get('--brand')), texto = hexRGB(props.get('--on-brand')), ink = hexRGB(props.get('--accent-ink'))
    const cBtn = contraste(fondo, texto), cInk = contraste(ink, hexRGB(card))
    if (cBtn < 4.5 || cInk < 4.5) malos.push({ card, c, cBtn: cBtn.toFixed(2), cInk: cInk.toFixed(2) })
  }
}
caso(`botón y menú se leen (≥ 4,5:1) con ${colores.length} colores en ${tarjetas.length} temas`, malos.length === 0, malos.slice(0, 5))

cardActual = '#ffffff'; props.clear()
const r1 = aplicarAcento('#1971c2')
caso('un azul que ya se lee no se toca', props.get('--brand') === '#1971c2' && !r1.ajustado && UI.acento === '#1971c2', [...props])
const r2 = aplicarAcento('#ffff00')
caso('un amarillo claro lleva texto oscuro y avisa si se ajustó', props.get('--on-brand') === '#141414' && typeof r2.ajustado === 'boolean', [...props])

const antes = guardado
aplicarAcento(null)
caso('volver al del tema borra las 3 variables y lo guarda', props.size === 0 && UI.acento === null && guardado === antes + 1, [...props])
aplicarAcento('cualquier cosa')
caso('un valor inválido vuelve al color del tema', props.size === 0 && UI.acento === null)

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
