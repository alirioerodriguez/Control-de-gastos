// Prueba del lado web del widget del celular (index.html: avisarWidget, datosWidget, ?accion=nuevo). Necesita playwright y @supabase/supabase-js en NODE_PATH.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..')
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  fs.readFile(path.join(ROOT, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(f.endsWith('.html') ? String(d).replace(/ integrity="[^"]*"/g, '') : d) } }) }).listen(8767)
const SUPA = fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js', { paths: (process.env.NODE_PATH || '').split(require('path').delimiter).concat([process.cwd()]) }), 'utf8')
let fallas = 0; const ok = (t, c, d) => { if (c) console.log('✓', t); else { fallas++; console.log('✗', t, d ?? '') } }
;(async () => {
  const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => { window.__msgs = []; window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) } })
  await p.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SUPA : 'window.Chart=function(){return{destroy(){},update(){}}}' }))
  await p.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await p.goto('http://localhost:8767/?accion=nuevo'); await p.waitForTimeout(1500)
  ok('sin sesión no manda cifras', !(await p.evaluate(() => window.__msgs.some((m) => m.type === 'widget' && m.datos))))
  await p.evaluate(() => {
    user = { id: 'u1' }; currentUid = 'u1'; booted = true; PROFILE = { nombre: 'Lu' }
    const hoy = todayISO(); ACCOUNTS = [{ key: 'efectivo', nombre: 'Efectivo', moneda: 'ARS' }]; CTA_MON = { efectivo: 'ARS' }; CTA_NOMBRE = { efectivo: 'Efectivo' }
    TX = [{ id: 't1', fecha: hoy, tipo: 'gasto', monto: 12300, categoria: 'Súper', descripcion: 'Coto', cuenta: 'efectivo', created_at: hoy + 'T10:00:00Z' },
          { id: 't2', fecha: hoy, tipo: 'ingreso', monto: 500000, categoria: 'Sueldo', descripcion: '', cuenta: 'efectivo', created_at: hoy + 'T09:00:00Z' }]
    BUD = [{ categoria: 'Súper', monto: 15000 }, { categoria: 'Salidas', monto: 40000 }]
    REC = [{ id: 'f1', cuenta: 'efectivo', tipo: 'gasto', monto: 30000, descripcion: 'Alquiler', categoria: 'Casa' }]
    show('app'); renderTodo() })
  await p.waitForTimeout(400)
  const w = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'widget').pop())
  ok('con sesión manda disponible, gastado, mes y hora', w && w.datos && /\$/.test(w.datos.disponible) && /\$/.test(w.datos.gastado) && w.datos.mes && /\d\d:\d\d/.test(w.datos.actualizado), JSON.stringify(w))
  ok('«?accion=nuevo» abrió el formulario de gasto y limpió la dirección', await p.evaluate(() => typeof R === 'object' && R && R.tipo === 'gasto') && !(await p.url()).includes('accion='), await p.url())
  const n = await p.evaluate(() => window.__msgs.length); await p.evaluate(() => renderTodo())
  ok('manda los últimos movimientos', w.datos.movimientos.length === 2 && w.datos.movimientos[0].titulo === 'Coto' && w.datos.movimientos[1].ingreso === true, JSON.stringify(w.datos.movimientos))
  ok('manda lo que viene y cuánto quedaría', w.datos.viene && w.datos.viene.items.some((x) => x.titulo === 'Alquiler' && /^− \$\s30\.000/.test(x.monto)) && /\$/.test(w.datos.viene.queda), JSON.stringify(w.datos.viene))
  ok('manda los presupuestos, el más justo primero', w.datos.presupuestos.length === 2 && w.datos.presupuestos[0].cat === 'Súper' && w.datos.presupuestos[0].pct === 82 && /15\.000/.test(w.datos.presupuestos[0].limite), JSON.stringify(w.datos.presupuestos))
  ok('no repite el mensaje si nada cambió', (await p.evaluate(() => window.__msgs.length)) === n)
  await p.evaluate(() => { oculto = true; renderTodo() })
  const o = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'widget').pop())
  ok('con «ocultar montos» manda ••••• y no las cifras', o.datos.oculto && o.datos.disponible === '•••••' && o.datos.gastado === '•••••', JSON.stringify(o))
  ok('«ocultar montos» también en movimientos, lo que viene y presupuestos', o.datos.movimientos.every((m) => m.monto === '•••••') && o.datos.viene.queda === '•••••'
    && o.datos.viene.items.every((x) => /•••••/.test(x.monto)) && o.datos.presupuestos.every((x) => x.gastado === '•••••' && x.limite === '•••••'), JSON.stringify(o.datos))
  await p.evaluate(() => { R = null; window.__accionDesdeApp('nuevo') })
  ok('«+ Gasto» con la app ya abierta abre el formulario', await p.evaluate(() => R && R.tipo === 'gasto'))
  await p.evaluate(() => { R = null; window.__accionDesdeApp('ingreso') })
  ok('«Ingreso» del widget de atajos abre el formulario de ingreso', await p.evaluate(() => R && R.tipo === 'ingreso'))
  await p.evaluate(() => { window.__accionDesdeApp('presupuesto') })
  ok('el widget de presupuestos abre Presupuestos', await p.evaluate(() => subView === 'presu'))
  ok('sin errores de JavaScript', errs.length === 0, errs)
  console.log(fallas ? fallas + ' FALLAS' : 'todo bien'); await b.close(); srv.close(); process.exit(fallas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
