// La carga en 2 pasos (v8.0): el paso 1 muestra solo el monto y el tipo; el paso 2, la categoría y el resto.
// Uso: node tests/reg-pasos.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

const casos = [
  ['el paso 1 oculta categoría, cuenta, fecha, descripción y guardar',
    /#reg\[data-paso="1"\] :is\(\.regrow,#reg-extra,#reg-varios-row,#reg-quick,#reg-hint,#reg-listo\)\{display:none !important\}/.test(html)],
  ['el paso 2 oculta los tipos, el teclado y el botón Siguiente',
    /#reg\[data-paso="2"\] :is\(#reg-tipos,#reg-keys,#reg-sig,#reg-del,#reg-mic,#reg-cam\)\{display:none !important\}/.test(html)],
  ['hay botón Siguiente al lado de Guardar', html.includes('<button class="btn" id="reg-sig"') && html.includes('id="reg-listo"')],
  ['con monto cargado desde otra pantalla arranca en el paso 2', html.includes('paso: montoPre ? 2 : 1')],
  ['Siguiente no deja pasar sin monto', /\$\("reg-sig"\)\.onclick=[\s\S]{0,300}if\(!\(regTotal\(\)>0\)\)/.test(html)],
  ['atrás en el paso 2 vuelve al monto en vez de cerrar', /\$\("reg-back"\)\.onclick=\(\)=>\{ if\(R\.paso===2\)\{ R\.paso=1; renderReg\(\); return; \}/.test(html)],
  ['renderReg marca el paso en la hoja', html.includes('$("reg").setAttribute("data-paso",String(R.paso||1));')],
]
let bien = 0
for (const [que, ok] of casos) { if (ok) bien++; else console.log('✗', que) }
console.log(`${bien}/${casos.length} bien`)
process.exit(bien === casos.length ? 0 : 1)
