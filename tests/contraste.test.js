// Contraste WCAG 2.2 de los 6 temas de color de la app (sin IA, sin internet).
// Saca los colores directamente de index.html, así mide lo mismo que se ve.
//   - Texto normal: 4,5:1 (AA, 1.4.3).   - Bordes de campos y foco: 3:1 (1.4.11 y 2.4.13).
// Uso:  node tests/contraste.test.js
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

// ---- Leer los temas ---------------------------------------------------------------
const temas = {}
for (const m of html.matchAll(/^(:root, \[data-theme="clara"\]|\[data-theme="([a-z-]+)"\])\{([^}]*)\}/gm)) {
  const nombre = m[2] || 'clara'
  const vars = {}
  for (const v of m[3].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g)) vars[v[1]] = v[2]
  temas[nombre] = vars
}

// ---- Contraste --------------------------------------------------------------------
const rgb = (hex) => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

// ---- Qué se mide ------------------------------------------------------------------
const TEXTO = 4.5
const NO_TEXTO = 3
const colores = ['red', 'green', 'teal', 'amber', 'violet', 'blue']
// [nombre, frente, fondo, mínimo]
const pares = (t) => [
  ['texto principal sobre el fondo', 'ink', 'bg', TEXTO],
  ['texto principal sobre las tarjetas', 'ink', 'card', TEXTO],
  ['texto principal sobre lo suave', 'ink', 'soft', TEXTO],
  ['texto secundario sobre el fondo', 'ink-2', 'bg', TEXTO],
  ['texto secundario sobre las tarjetas', 'ink-2', 'card', TEXTO],
  ['texto secundario sobre lo suave', 'ink-2', 'soft', TEXTO],
  ['texto terciario sobre las tarjetas', 'ink-3', 'card', TEXTO],
  ['texto terciario sobre el fondo', 'ink-3', 'bg', TEXTO],
  ...colores.flatMap((c) => [
    [`${c} (texto de color) sobre su fondo suave`, c, `${c}-bg`, TEXTO],
    [`${c} (texto de color) sobre las tarjetas`, c, 'card', TEXTO],
  ]),
  ['rojo de error sobre su fondo', 'red-ink', 'red-bg', TEXTO],
  ['rojo de error sobre las tarjetas', 'red-ink', 'card', TEXTO],
  ['texto sobre la cabecera oscura', 'on-dark', 'dark', TEXTO],
  ['texto secundario sobre la cabecera oscura', 'on-dark-2', 'dark', TEXTO],
  ['texto suave sobre la cabecera oscura', 'on-dark-3', 'dark', TEXTO],
  ...colores.map((c) => [`${c} claro (versión para la cabecera oscura)`, `${c}-hi`, 'dark', TEXTO]),
  ['texto sobre los botones de acento', 'on-accent', 'red', TEXTO],
  ['borde de los campos sobre las tarjetas', 'line-in', 'card', NO_TEXTO],
  ['borde de los campos sobre el fondo', 'line-in', 'bg', NO_TEXTO],
  ['anillo de foco sobre las tarjetas', 'foco', 'card', NO_TEXTO],
  ['anillo de foco sobre el fondo', 'foco', 'bg', NO_TEXTO],
].filter(([, f, b]) => t[f] && t[b])

let fallas = 0
let total = 0
const nombres = Object.keys(temas)
console.log(`Temas encontrados: ${nombres.join(', ')}`)
if (nombres.length !== 6) { console.log('✗ se esperaban 6 temas'); process.exit(1) }

for (const nombre of nombres) {
  const t = temas[nombre]
  console.log(`\n— ${nombre}`)
  for (const [que, f, b, min] of pares(t)) {
    total++
    const r = contraste(t[f], t[b])
    if (r + 1e-9 < min) { fallas++; console.log(`✗ ${que}: ${r.toFixed(2)}:1 (mínimo ${min}) · ${f} ${t[f]} sobre ${b} ${t[b]}`) }
  }
  if (!fallas) console.log('✓ todo en regla')
}

// El cálculo mismo, contra valores conocidos de WCAG
total += 3
if (Math.abs(contraste('#000000', '#ffffff') - 21) > 1e-9) { fallas++; console.log('✗ negro sobre blanco no da 21:1') }
if (Math.abs(contraste('#777777', '#ffffff') - 4.48) > 0.01) { fallas++; console.log('✗ #777 sobre blanco no da 4,48:1') }
if (Math.abs(contraste('#767676', '#ffffff') - 4.54) > 0.01) { fallas++; console.log('✗ #767676 sobre blanco no da 4,54:1') }

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
