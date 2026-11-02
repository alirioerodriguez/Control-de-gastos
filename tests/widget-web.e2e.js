// Prueba del lado web del widget del celular (index.html: avisarWidget, datosWidget, ?accion=nuevo). Necesita playwright y @supabase/supabase-js en NODE_PATH.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path')
const ROOT = '/home/user/control-de-gastos'
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  fs.readFile(path.join(ROOT, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(d) } }) }).listen(8767)
const SUPA = fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8')
let fallas = 0; const ok = (t, c, d) => { if (c) console.log('✓', t); else { fallas++; console.log('✗', t, d ?? '') } }
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => { window.__msgs = []; window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) } })
  await p.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SUPA : 'window.Chart=function(){return{destroy(){},update(){}}}' }))
  await p.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await p.goto('http://localhost:8767/?accion=nuevo'); await p.waitForTimeout(1500)
  ok('sin sesión no manda cifras', !(await p.evaluate(() => window.__msgs.some((m) => m.type === 'widget' && m.datos))))
  await p.evaluate(() => { user = { id: 'u1' }; currentUid = 'u1'; booted = true; PROFILE = { nombre: 'Lu' }; show('app'); renderTodo() })
  await p.waitForTimeout(400)
  const w = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'widget').pop())
  ok('con sesión manda disponible, gastado, mes y hora', w && w.datos && /\$/.test(w.datos.disponible) && /\$/.test(w.datos.gastado) && w.datos.mes && /\d\d:\d\d/.test(w.datos.actualizado), JSON.stringify(w))
  ok('«?accion=nuevo» abrió el formulario de gasto y limpió la dirección', await p.evaluate(() => typeof R === 'object' && R && R.tipo === 'gasto') && !(await p.url()).includes('accion='), await p.url())
  const n = await p.evaluate(() => window.__msgs.length); await p.evaluate(() => renderTodo())
  ok('no repite el mensaje si nada cambió', (await p.evaluate(() => window.__msgs.length)) === n)
  await p.evaluate(() => { oculto = true; renderTodo() })
  const o = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'widget').pop())
  ok('con «ocultar montos» manda ••••• y no las cifras', o.datos.oculto && o.datos.disponible === '•••••' && o.datos.gastado === '•••••', JSON.stringify(o))
  await p.evaluate(() => { R = null; window.__accionDesdeApp('nuevo') })
  ok('«+ Gasto» con la app ya abierta abre el formulario', await p.evaluate(() => R && R.tipo === 'gasto'))
  ok('sin errores de JavaScript', errs.length === 0, errs)
  console.log(fallas ? fallas + ' FALLAS' : 'todo bien'); await b.close(); srv.close(); process.exit(fallas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
