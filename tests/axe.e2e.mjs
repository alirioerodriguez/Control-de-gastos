// Accesibilidad automática: axe-core (reglas WCAG 2.0/2.1/2.2 A y AA) sobre las pantallas principales en los 6 temas.
// Playwright maneja el Chrome que ya está instalado (no baja navegadores) y la app entra con una sesión de mentira,
// igual que toques.e2e.mjs. No toca Supabase ni Gemini: todo es local.
//
// Dependencias (NO van en el repo; se instalan en una carpeta aparte, sin instalar nada global):
//     mkdir ..\axe && cd ..\axe && npm i axe-core playwright-core
//     set AXE_DEPS=C:\ruta\a\axe          (la carpeta que contiene node_modules)
// Uso:  node tests/axe.e2e.mjs            (CHROME=ruta si Chrome no está en el lugar de siempre)
//       AXE_TEMAS=clara node tests/axe.e2e.mjs   para correr un solo tema
// Sale con 1 si hay violaciones (2 si faltan las dependencias). Cubre las 7 pantallas principales con una sesión de mentira;
// no abre las ventanas emergentes (resumen, voz, fecha) ni la pantalla de ingreso: eso queda para una segunda pasada.
import { createServer } from 'node:http'
import { readFile } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(process.env.AXE_DEPS || RAIZ, 'noop.js'))
let chromium, AXE
try { ({ chromium } = req('playwright-core')); AXE = req('axe-core').source } catch (e) {
  console.log('Faltan playwright-core y axe-core. Instalalos en una carpeta aparte y apuntá AXE_DEPS ahí (ver el encabezado de este archivo).')
  process.exit(2)
}
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')
const PANTALLAS = ['app', 'movs', 'cuentas', 'tar', 'metas', 'mas', 'reg']
const TEMAS = (process.env.AXE_TEMAS || 'clara,arena-serena,coral-suave,teal-claro,verde-noche,azul-intenso').split(',')

const srv = createServer((q, r) => {
  let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  readFile(join(RAIZ, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); r.end(d) } })
}).listen(0)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 360, height: 740 } })
await page.goto(`http://localhost:${srv.address().port}/`)
await page.waitForTimeout(3000)
await page.evaluate(() => { user = { id: 'u1' }; currentUid = 'u1'; booted = true; PROFILE = { nombre: 'Lu' }; show('app'); renderTodo(); return true })
await page.addScriptTag({ content: AXE })
// sin transiciones: si no, axe mide colores a medio cambiar justo después de pasar de un tema a otro
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' })

const fallas = new Map()     // regla → { impacto, ayuda, url, donde:Set }
let corridas = 0
for (const tema of TEMAS) {
  await page.evaluate((t) => aplicarTema(t), tema)
  for (const p of PANTALLAS) {
    try { await page.evaluate((x) => { show(x); return true }, p) } catch (e) { console.log('·', p, 'no se pudo abrir:', e.message.split('\n')[0]); continue }
    await page.waitForTimeout(400)
    const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }))
    corridas++
    for (const v of r.violations) {
      const f = fallas.get(v.id) || { impacto: v.impact, ayuda: v.help, url: v.helpUrl, donde: new Map() }
      for (const n of v.nodes) f.donde.set(`${tema}/${p}: ${n.target.join(' ')}`, n.failureSummary?.split('\n')[1]?.trim() || '')
      fallas.set(v.id, f)
    }
  }
}
await browser.close(); srv.close()

console.log(`axe-core sobre ${PANTALLAS.length} pantallas × ${TEMAS.length} temas (${corridas} corridas, 360 px de ancho)`)
if (!fallas.size) { console.log('✓ sin violaciones'); process.exit(0) }
for (const [id, f] of fallas) {
  console.log(`\n✗ ${id} (${f.impacto}): ${f.ayuda}\n  ${f.url}`)
  for (const [donde, detalle] of [...f.donde].slice(0, 8)) console.log(`   - ${donde}${detalle ? ' → ' + detalle : ''}`)
  if (f.donde.size > 8) console.log(`   … y ${f.donde.size - 8} más`)
}
process.exit(1)
