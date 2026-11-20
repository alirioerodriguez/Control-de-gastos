// Promos de otras apps del mismo creador en «Más»: links https con ?ref=mis-cuentas, nada más.
// Uso: node tests/otras-apps.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')

const bloque = html.match(/const OTRAS_APPS=(\[[\s\S]*?\n\]);/)
let fallas = 0
const caso = (nombre, ok, detalle) => { if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

caso('existe la lista OTRAS_APPS', !!bloque)
const apps = bloque ? eval(bloque[1]) : []
const urls = apps.map(a => a.url)
caso('muestra VeoMás, Un nuevo comienzo, honorapp y Savia al final', JSON.stringify(urls) === JSON.stringify([
  'https://donde-la-veo-app.vercel.app/?ref=mis-cuentas',
  'https://un-nuevo-comienzo-empleo.vercel.app/?ref=mis-cuentas',
  'https://control-de-facturacion-eight.vercel.app/?ref=mis-cuentas',
  'https://cicloapp.vercel.app/?ref=mis-cuentas',
]), urls)
caso('cada una tiene título, texto e imagen o emoji', apps.every(a => a.titulo && a.texto && (a.img || a.emoji)), apps)
caso('cada logo está en el repo', apps.filter(a => a.img).every(a => fs.existsSync(path.join(__dirname, '..', a.img))), apps.map(a => a.img))
caso('renderMasMenu usa la lista', /OTRAS_APPS\.map\(/.test(html))

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo OK')
process.exit(fallas ? 1 : 0)
