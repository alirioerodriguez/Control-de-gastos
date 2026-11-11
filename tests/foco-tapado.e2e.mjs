// WCAG 2.2 · 2.4.11 Foco no tapado (AA): al recorrer la pantalla con Tab, el elemento con foco no puede quedar
// escondido detrás de la barra de abajo (.nav) ni de la barra de aviso sin conexión (#offline-bar).
// Mismo armado que axe.e2e.mjs: Playwright sobre el Chrome instalado, sesión de mentira, nada sale a internet salvo
// lo que la propia página ya carga. Lo que NO se puede probar acá: el teclado en pantalla de un celular (hace falta dispositivo).
// Dependencias: playwright-core en una carpeta aparte (ver axe.e2e.mjs).  Uso:  node tests/foco-tapado.e2e.mjs
import { createServer } from 'node:http'
import { readFile } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const req = createRequire(join(process.env.AXE_DEPS || RAIZ, 'noop.js'))
let chromium
try { ({ chromium } = req('playwright-core')) } catch (e) { console.log('Falta playwright-core (ver el encabezado de axe.e2e.mjs).'); process.exit(2) }
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome')
const PANTALLAS = ['app', 'movs', 'cuentas', 'tar', 'metas', 'mas']

const srv = createServer((q, r) => {
  let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  readFile(join(RAIZ, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); r.end(d) } })
}).listen(0)
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 360, height: 640 } })
await page.goto(`http://localhost:${srv.address().port}/`)
await page.waitForTimeout(3000)
await page.evaluate(() => { user = { id: 'u1' }; currentUid = 'u1'; booted = true; PROFILE = { nombre: 'Lu' }; show('app'); renderTodo(); return true })
await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}' })

// ¿el centro del elemento con foco está tapado por otra cosa? (elementFromPoint devuelve lo que se ve encima)
const TAPADO = () => {
  const el = document.activeElement
  if (!el || el === document.body) return null
  const r = el.getBoundingClientRect()
  if (!r.width || !r.height) return null
  const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1), x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1)
  const arriba = document.elementFromPoint(x, y)
  if (!arriba || el.contains(arriba) || arriba.contains(el)) return null
  const nombre = (el.getAttribute('aria-label') || el.id || el.textContent || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40)
  const tapa = arriba.closest('.nav, #offline-bar, #toasts, .ov, .sheet') ? (arriba.closest('.nav, #offline-bar, #toasts, .ov, .sheet').id || arriba.closest('.nav, #offline-bar, #toasts, .ov, .sheet').className) : (arriba.id || arriba.tagName)
  return { nombre, tapa, fuera: r.bottom > innerHeight || r.top < 0 }
}

let pasos = 0
const tapados = new Map()
for (const p of PANTALLAS) {
  await page.evaluate((x) => { show(x); window.scrollTo(0, 0); document.activeElement && document.activeElement.blur(); return true }, p)
  await page.waitForTimeout(400)
  const n = await page.evaluate(() => document.querySelectorAll('button, a[href], input, select, textarea, [tabindex]').length)
  for (let i = 0; i < Math.min(n + 5, 160); i++) {
    await page.keyboard.press('Tab')
    pasos++
    const t = await page.evaluate(TAPADO)
    if (t) tapados.set(`${p}: «${t.nombre}» tapado por ${t.tapa}`, t)
  }
}
await browser.close(); srv.close()
console.log(`${pasos} pasos de Tab en ${PANTALLAS.length} pantallas a 360×640`)
if (!tapados.size) { console.log('✓ el foco nunca quedó tapado (WCAG 2.4.11)'); process.exit(0) }
console.log(`✗ ${tapados.size} elementos con foco quedaron tapados:\n  ` + [...tapados.keys()].join('\n  '))
process.exit(1)
