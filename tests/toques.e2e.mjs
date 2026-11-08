// WCAG 2.2 · 2.5.8 (tamaño del objetivo, AA): todo lo que se toca mide al menos 24 × 24 px.
// Abre la app en Chrome sin ventana a 360 px de ancho, entra con una sesión de mentira (como widget-web.e2e.js),
// recorre las pantallas principales y mide cada botón, enlace y campo visible. También lista los que quedan por
// debajo de 44 px (lo que piden Apple y Material), solo como aviso.
// Uso:  node tests/toques.e2e.mjs        (CHROME=ruta si Chrome no está en el lugar de siempre)
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFile } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome')
const PANTALLAS = ['app', 'movs', 'cuentas', 'tar', 'metas', 'mas', 'reg']
const MINIMO = 24, COMODO = 44

const srv = createServer((q, r) => {
  let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  readFile(join(RAIZ, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : 'text/html' }); r.end(d) } })
}).listen(0)
const puertoWeb = srv.address().port
const puerto = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'toques-'))}`, 'about:blank'], { stdio: 'ignore' })
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let ws
for (let i = 0; i < 50 && !ws; i++) {
  await dormir(200)
  try { const pag = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((x) => x.type === 'page'); if (pag) ws = new WebSocket(pag.webSocketDebuggerUrl) } catch {}
}
if (!ws) { console.log('No se pudo abrir Chrome en', CHROME); process.exit(1) }
await new Promise((r) => (ws.onopen = r))
let id = 0; const esperando = new Map()
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && esperando.has(d.id)) { esperando.get(d.id)(d); esperando.delete(d.id) } }
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; esperando.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluar = async (expression) => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value }

await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 2, mobile: true })
await cdp('Page.navigate', { url: `http://localhost:${puertoWeb}/` })
await dormir(4000)
await evaluar(`user={id:'u1'};currentUid='u1';booted=true;PROFILE={nombre:'Lu'};show('app');renderTodo();true`)

const MEDIR = `(() => {
  const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [onclick]'
  const vistos = []
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el)
    if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden],[aria-hidden=true]')) continue
    // .fecha-oculta: el calendario nativo que abre un botón visible (ese botón es el que se mide)
    if (el.classList.contains('fecha-oculta')) continue
    // Los enlaces dentro de un texto corrido están exceptuados por la norma (2.5.8, «en línea»)
    if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /P|LI|SPAN|SMALL|DIV/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 20) continue
    // Si el elemento es parte de un control más grande (la etiqueta envuelve al campo), cuenta el más grande
    const lab = el.closest('label'); const rr = lab ? lab.getBoundingClientRect() : r
    const w = Math.max(r.width, rr.width), h = Math.max(r.height, rr.height)
    const nombre = (el.getAttribute('aria-label') || el.title || el.textContent || el.id || el.className || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 40)
    vistos.push({ nombre, w: Math.round(w), h: Math.round(h) })
  }
  return vistos
})()`

const chicos = [], justos = []
const todos = []
let total = 0
for (const p of PANTALLAS) {
  try { await evaluar(`show(${JSON.stringify(p)});true`) } catch (e) { console.log('·', p, 'no se pudo abrir:', e.message.split('\n')[0]); continue }
  await dormir(500)
  const v = await evaluar(MEDIR)
  total += v.length
  for (const x of v) {
    todos.push({ ...x, p })
    if (x.w < MINIMO || x.h < MINIMO) chicos.push(`${p}: «${x.nombre}» ${x.w}×${x.h}`)
    else if (x.w < COMODO || x.h < COMODO) justos.push(`${p}: «${x.nombre}» ${x.w}×${x.h}`)
  }
}
ws.close(); chrome.kill(); srv.close()

console.log(`${total} objetivos medidos en ${PANTALLAS.length} pantallas a 360 px`)
console.log('Los 5 más chicos: ' + todos.sort((a, b) => Math.min(a.w, a.h) - Math.min(b.w, b.h)).slice(0, 5).map((x) => `${x.p} «${x.nombre}» ${x.w}×${x.h}`).join(' · '))
if (justos.length) console.log(`\nAviso: ${justos.length} cumplen 24 px pero quedan bajo ${COMODO} px:\n  ` + [...new Set(justos)].join('\n  '))
console.log(chicos.length ? `\n✗ ${chicos.length} por debajo de ${MINIMO} × ${MINIMO} px:\n  ` + [...new Set(chicos)].join('\n  ') : `\n✓ todos miden al menos ${MINIMO} × ${MINIMO} px (WCAG 2.5.8)`)
process.exit(chicos.length ? 1 : 0)
