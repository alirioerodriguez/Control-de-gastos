// WCAG 2.2: lo que se puede revisar sin navegador, para que no se pierda en un cambio.
//  - Foco visible con teclado (2.4.7 / 2.4.11): hay reglas :focus-visible con contorno.
//  - Movimiento (2.3.3): se respeta prefers-reduced-motion.
//  - Nombre accesible (4.1.2): ningún <button> sin texto queda sin aria-label, title o aria-labelledby.
// El contraste ya lo mide contraste.test.js. Uso: node tests/wcag22.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

const fallas = []
if (!/:focus-visible\s*\{[^}]*outline/i.test(html)) fallas.push('falta un :focus-visible con outline')
if (!/prefers-reduced-motion:\s*reduce/i.test(html)) fallas.push('falta @media (prefers-reduced-motion: reduce)')
for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
  const texto = m[2].replace(/<[^>]+>/g, '').replace(/\$\{[^}]*\}/g, 'x').trim()   // ${…} cuenta como texto
  if (!texto && !/aria-label|aria-labelledby|title=/i.test(m[1])) fallas.push('botón sin nombre: ' + m[0].slice(0, 80))
}

// 2.4.11 Foco no tapado: la barra de abajo es fija, así que el scroll tiene que dejarle margen al foco (lo mide foco-tapado.e2e.mjs)
if (!/html\{[^}]*scroll-padding-bottom/.test(html)) fallas.push('falta scroll-padding-bottom en html (la barra de abajo tapa el foco)')
// 2.5.7 Arrastre: el reparto por porcentaje tiene el deslizador con nombre, un campo numérico y botones de +/- 5 sin arrastrar
for (const id of ['reg-pct', 'reg-pct-n', 'reg-pct-menos', 'reg-pct-mas']) if (!html.includes('id="' + id + '"')) fallas.push('falta #' + id + ' en el reparto por porcentaje')
if (!/id="reg-pct" type="range"[^>]*aria-label=/.test(html)) fallas.push('el deslizador del porcentaje no tiene nombre accesible')
// 4.1.2 / 1.3.1: los select y el campo de fecha que se vieron sin nombre en axe-core
for (const id of ['f-cuenta', 'f-cat', 'reg-sel', 'reg-fecha']) if (!new RegExp('<(?:select|input) id="' + id + '"[^>]*aria-label=').test(html)) fallas.push('#' + id + ' sin aria-label')
console.log(fallas.length ? '✗ ' + fallas.join('\n✗ ') : '✓ foco visible, movimiento reducido y botones con nombre')
process.exit(fallas.length ? 1 : 0)
