// Prueba del puente de voz de la app (mobile/voz.ts) contra el dictado real de index.html, en un navegador sin reconocimiento de voz.
// Antes: extraer POLYFILL_VOZ de mobile/voz.ts a poly.js. Necesita playwright y @supabase/supabase-js en NODE_PATH.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path')
const ROOT = '/home/user/control-de-gastos'
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  fs.readFile(path.join(ROOT, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d) } }) }).listen(8768)
const SUPA = fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8'), POLY = fs.readFileSync('poly.js', 'utf8')
let fallas = 0; const ok = (t, c, d) => { if (c) console.log('✓', t); else { fallas++; console.log('✗', t, d ?? '') } }
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  // como la vista web de Android: sin reconocimiento de voz; la «app» anota lo que le piden
  await p.addInitScript((poly) => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; window.__pedidos = []
    window.ReactNativeWebView = { postMessage: (m) => window.__pedidos.push(JSON.parse(m)) }; (0, eval)(poly) }, POLY)
  await p.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SUPA : 'window.Chart=function(){return{destroy(){},update(){}}}' }))
  await p.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await p.goto('http://localhost:8768/'); await p.waitForTimeout(1500)
  ok('la web ve un reconocedor de voz (el de la app)', await p.evaluate(() => hayDictado()))
  await p.evaluate(() => { user = { id: 'u1' }; booted = true; PROFILE = { nombre: 'Lu' }; show('app'); renderTodo(); openVoz('') })
  await p.waitForTimeout(300)
  await p.evaluate(() => toggleDictado()); await p.waitForTimeout(200)
  const ped = await p.evaluate(() => window.__pedidos.filter((m) => m.type === 'voz'))
  ok('al tocar el micrófono le pide a la app que escuche en es-AR, continuo y con parciales', ped.length && ped[0].accion === 'start' && ped[0].lang === 'es-AR' && ped[0].continuous && ped[0].interimResults, JSON.stringify(ped))
  const app = (ev) => p.evaluate((ev) => window.__vozDesdeApp(ev), ev)
  await app({ tipo: 'start' })
  ok('se pone a escuchar', await p.evaluate(() => escuchando))
  await app({ tipo: 'result', isFinal: false, texto: 'cena con' })
  ok('muestra el parcial mientras hablás', (await p.evaluate(() => V.texto)) === 'cena con', await p.evaluate(() => V.texto))
  await app({ tipo: 'result', isFinal: true, texto: 'cena con Sofi' })
  await app({ tipo: 'result', isFinal: false, texto: '30 mil' })
  await app({ tipo: 'result', isFinal: true, texto: '30 mil pesos' })
  ok('junta las frases sin repetir: «cena con Sofi 30 mil pesos»', (await p.evaluate(() => V.texto)) === 'cena con Sofi 30 mil pesos', await p.evaluate(() => V.texto))
  ok('entiende el monto (30.000)', (await p.evaluate(() => V.monto)) === 30000, await p.evaluate(() => V.monto))
  // el teléfono corta solo (Android viejo, sin modo continuo): la web vuelve a pedir que escuche
  await p.evaluate(() => { window.__pedidos = [] }); await app({ tipo: 'end' }); await p.waitForTimeout(400)
  ok('si el teléfono corta, la web pide seguir escuchando', await p.evaluate(() => window.__pedidos.some((m) => m.type === 'voz' && m.accion === 'start')))
  await app({ tipo: 'start' }); await app({ tipo: 'result', isFinal: true, texto: 'en efectivo' })
  ok('y lo nuevo se suma a lo anterior', (await p.evaluate(() => V.texto)) === 'cena con Sofi 30 mil pesos en efectivo', await p.evaluate(() => V.texto))
  await p.evaluate(() => { window.__pedidos = []; toggleDictado() }); await p.waitForTimeout(100)
  ok('al tocar de nuevo le pide a la app que pare', await p.evaluate(() => window.__pedidos.some((m) => m.accion === 'stop')))
  await app({ tipo: 'end' })
  // permiso de micrófono negado
  await p.evaluate(() => toggleDictado()); await app({ tipo: 'error', error: 'not-allowed' }); await app({ tipo: 'end' }); await p.waitForTimeout(300)
  const estado = await p.evaluate(() => document.getElementById('voz-estado').textContent)
  ok('sin permiso de micrófono muestra un aviso y deja de insistir', !(await p.evaluate(() => quiereEscuchar)) && estado.length > 0, estado)
  ok('sin errores de JavaScript', errs.length === 0, errs)
  console.log(fallas ? fallas + ' FALLAS' : 'todo bien'); await b.close(); srv.close(); process.exit(fallas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
