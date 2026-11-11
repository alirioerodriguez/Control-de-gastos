// Prueba en el navegador de lo que sumó la v5.2/v5.3: color principal, «Instalar la app» y la pantalla de WhatsApp.
// Abre la app en Chrome sin ventana con una sesión de mentira (como toques.e2e.mjs) y revisa que:
//   - la tarjeta «Instalá Mis Cuentas» aparece en Inicio y la X la esconde (y queda recordado);
//   - elegir un color en Apariencia pinta los botones, se mantiene al cambiar de tema y «El del tema» lo deshace;
//   - «Instalar la app» muestra los pasos de cada equipo;
//   - Más → WhatsApp abre sin romper aunque la base todavía no tenga las tablas;
//   - no hay errores de JavaScript en ningún momento.
// Uso:  node tests/acento-instalar.e2e.mjs      (CAPTURAS=carpeta para guardar capturas · CHROME=ruta de Chrome)
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtempSync, readFile, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : 'google-chrome')
const CAPTURAS = process.env.CAPTURAS

const srv = createServer((q, r) => {
  let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  readFile(join(RAIZ, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.svg') ? 'image/svg+xml' : f.endsWith('.json') || f.endsWith('.webmanifest') ? 'application/json' : 'text/html' }); r.end(d) } })
}).listen(0)
const puertoWeb = srv.address().port
const puerto = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${puerto}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'acento-'))}`, 'about:blank'], { stdio: 'ignore' })
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

let ws
for (let i = 0; i < 50 && !ws; i++) {
  await dormir(200)
  try { const pag = (await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json()).find((x) => x.type === 'page'); if (pag) ws = new WebSocket(pag.webSocketDebuggerUrl) } catch {}
}
if (!ws) { console.log('No se pudo abrir Chrome en', CHROME); process.exit(1) }
await new Promise((r) => (ws.onopen = r))
let id = 0; const esperando = new Map(); const errores = []
ws.onmessage = (m) => {
  const d = JSON.parse(m.data)
  if (d.method === 'Runtime.exceptionThrown') errores.push(d.params.exceptionDetails.exception?.description?.split('\n')[0] || d.params.exceptionDetails.text)
  if (d.id && esperando.has(d.id)) { esperando.get(d.id)(d); esperando.delete(d.id) }
}
const cdp = (method, params = {}) => new Promise((r) => { const n = ++id; esperando.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluar = async (expression) => { const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result?.result?.value }
const captura = async (nombre) => { if (!CAPTURAS) return; const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(CAPTURAS, nombre + '.png'), Buffer.from(r.result.data, 'base64')) }

let fallas = 0, total = 0
const caso = (nombre, ok, detalle) => { total++; if (!ok) fallas++; console.log(ok ? '✓' : '✗', nombre, ok ? '' : '\n  ' + JSON.stringify(detalle)) }

await cdp('Runtime.enable')
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await cdp('Page.navigate', { url: `http://localhost:${puertoWeb}/` })
await dormir(4000)
await evaluar(`user={id:'u1'};currentUid='u1';booted=true;PROFILE={nombre:'Lu'};show('app');renderTodo();pintarAvisoInstalar();true`)
await dormir(600)

// --- Instalar: tarjeta en Inicio
caso('en el navegador aparece «Instalá Mis Cuentas» en Inicio', await evaluar(`!!document.querySelector('#inst-aviso .instcard')`))
await captura('1-inicio-instalar')
await evaluar(`$('inst-cerrar').click();true`)
caso('la X la esconde y queda recordado', await evaluar(`$('inst-aviso').innerHTML==='' && !!localStorage.getItem(INST_OCULTO)`))
await evaluar(`pintarAvisoInstalar();true`)
caso('no vuelve a aparecer al repintar', await evaluar(`$('inst-aviso').innerHTML===''`))

// --- Color principal
const fondoBtn = `getComputedStyle(document.querySelector('.btn')||document.body).backgroundColor`
const temaAntes = await evaluar(`getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()`)
await evaluar(`openSub('tema');true`); await dormir(400)
caso('Apariencia muestra «Color principal» con 9 opciones', await evaluar(`document.querySelectorAll('.acgrid .acbtn').length`) === 9)
await evaluar(`document.querySelector('[data-acento="#1971c2"]').click();true`); await dormir(300)
caso('elegir Azul pinta los botones de azul', await evaluar(fondoBtn) === 'rgb(25, 113, 194)', await evaluar(fondoBtn))
caso('queda marcado como elegido', await evaluar(`document.querySelector('[data-acento="#1971c2"]').getAttribute('aria-checked')`) === 'true')
await captura('2-apariencia-azul')
const otroTema = await evaluar(`TEMAS.find(t=>t.k!==UI.tema).k`)
await evaluar(`aplicarTema(${JSON.stringify(otroTema)});true`)
caso('al cambiar de tema el azul se mantiene', await evaluar(fondoBtn) === 'rgb(25, 113, 194)', await evaluar(fondoBtn))
await evaluar(`aplicarTema(${JSON.stringify(await evaluar('TEMAS[0].k'))});renderSub();true`); await dormir(200)
await evaluar(`document.querySelector('[data-acento=""]').click();true`); await dormir(300)
const temaDespues = await evaluar(`getComputedStyle(document.documentElement).getPropertyValue('--brand').trim()`)
const estiloHtml = await evaluar(`document.documentElement.getAttribute('style')||''`)
caso('«El del tema» vuelve al color de la marca', !/--brand/.test(estiloHtml) && temaDespues.length > 0, { temaAntes, temaDespues, estiloHtml })
await evaluar(`aplicarAcento('#ffff00');renderSub();true`); await dormir(300)
caso('un amarillo lleva texto oscuro en el botón', await evaluar(`getComputedStyle(document.querySelector('.btn')).color`) === 'rgb(20, 20, 20)', await evaluar(`getComputedStyle(document.querySelector('.btn')).color`))
await captura('3-apariencia-amarillo')
await evaluar(`aplicarAcento(null);true`)

// --- Instalar la app (guía)
await evaluar(`instTab=null;openSub('instalar');true`); await dormir(400)
caso('la guía tiene las 3 pestañas', await evaluar(`document.querySelectorAll('[data-insttab]').length`) === 3)
for (const [tab, n] of [['android', 4], ['ios', 4], ['compu', 3]]) {
  await evaluar(`document.querySelector('[data-insttab="${tab}"]').click();true`); await dormir(150)
  caso(`pestaña ${tab}: ${n} pasos`, await evaluar(`document.querySelectorAll('.instpasos li').length`) === n)
}
await evaluar(`document.querySelector('[data-insttab="android"]').click();true`); await dormir(150)
await captura('4-instalar-android')

// --- WhatsApp: sin las tablas en la base, avisa y no rompe
await evaluar(`openSub('whatsapp');true`)
let txt = ''
for (let i = 0; i < 20 && (!txt || /Cargando/.test(txt)); i++) { await dormir(500); txt = await evaluar(`($('wa-body')||{}).textContent||''`) }
caso('Más → WhatsApp abre y deja de decir «Cargando…»', txt && !/Cargando/.test(txt), txt.slice(0, 120))
await captura('5-whatsapp')
caso('Ajustes lista «WhatsApp» e «Instalar la app»', await evaluar(`CFG.some(c=>c.k==='whatsapp') && CFG.some(c=>c.k==='instalar')`))

caso('sin errores de JavaScript', errores.length === 0, errores)
ws.close(); chrome.kill(); srv.close()
console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
