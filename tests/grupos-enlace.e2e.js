// Prueba de punta a punta del enlace de grupos: dueño en la app + amigo sin cuenta + amiga con cuenta.
// Necesita el Postgres local de tests/grupos-enlace.test.sql y tests/grupos-enlace.rest-local.js corriendo (puerto 8766),
// y en NODE_PATH: playwright, pg y @supabase/supabase-js. Las capturas van a la carpeta SHOTS.
const { chromium } = require('playwright')
const http = require('http'), fs = require('fs'), path = require('path')
const ROOT = '/home/user/control-de-gastos', SHOTS = process.env.SHOTS || '/tmp/'
const tipos = { '.js': 'text/javascript', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' }
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'; if (!path.extname(f)) f += '.html'
  fs.readFile(path.join(ROOT, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': tipos[path.extname(f)] || 'text/plain' }); r.end(d) } }) }).listen(8765)
const SUPA = fs.readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js', 'utf8')
const DUENO = '11111111-1111-1111-1111-111111111111', VALE = '22222222-2222-2222-2222-222222222222'
const log = (...a) => console.log(...a)
let fallas = 0; const ok = (t, c, d) => { if (c) log('✓', t); else { fallas++; log('✗', t, d ?? '') } }

async function pagina(b, usuario) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', (e) => p.errs.push(e.message)); p.on('dialog', (d) => d.accept())
  await p.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SUPA : 'window.Chart=function(){return{destroy(){},update(){}}}' }))
  await p.route(/supabase\.co/, async (r) => { const u = new URL(r.request().url()); const resp = await r.fetch({ url: 'http://localhost:8766' + u.pathname + u.search }); await r.fulfill({ response: resp }) })
  if (usuario) await p.addInitScript((tok) => { // simula estar logueado: el cliente manda el token de ese usuario
    let real; Object.defineProperty(window, 'supabase', { configurable: true, get: () => real, set: (v) => { real = { ...v, createClient: (u, k, o) => v.createClient(u, k, { ...(o || {}), global: { headers: { Authorization: 'Bearer ' + tok } } }) } } })
  }, 'user:' + usuario)
  return p
}
const espera = (p, ms = 400) => p.waitForTimeout(ms)

;(async () => {
  const b = await chromium.launch()
  // ---------- DUEÑO en la app ----------
  const d = await pagina(b, DUENO)
  await d.goto('http://localhost:8765/'); await espera(d, 1200)
  await d.evaluate((uid) => { user = { id: uid }; PROFILE = { nombre: 'Lu' }; sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); subView = 'grupos'; show('sub'); renderSub(); bindSub() }, DUENO)
  await espera(d, 800)
  ok('dueño: la app detecta la base con eventos y enlaces', await d.evaluate(() => !GRP.local && GRP.eventos && GRP.enlaces), await d.evaluate(() => JSON.stringify({ l: GRP.local, e: GRP.eventos, n: GRP.enlaces })))
  await d.fill('#g-nuevo', 'Cumple de Juan'); await d.click('#g-crear'); await espera(d)
  for (const n of ['Lu', 'Juan']) { await d.fill('#g-m-nombre', n); await d.click('#g-m-sumar'); await espera(d) }
  const idJuan = await d.evaluate(() => GRP.miembros.find((m) => m.nombre === 'Juan').id)
  await d.click(`[data-g-invitado="${idJuan}"]`); await espera(d)
  await d.fill('#g-x-desc', 'Carne'); await d.fill('#g-x-monto', '60000'); await d.click('#g-x-guardar'); await espera(d)
  const carne = await d.evaluate(() => GRP.gastos[0])
  ok('dueño: gasto con todos marcados se guarda «entre todos» (participantes null)', carne && carne.participantes === null && carne.reparto === 'asistentes', JSON.stringify(carne))
  await d.evaluate(() => { window.open = (u) => { window.__abierto = u } })
  await d.click('#g-invitar'); await espera(d, 800)
  const wa = await d.evaluate(() => window.__abierto)
  const enlace = await d.evaluate(() => GRP.grupos[0].enlace)
  ok('dueño: «Invitar por WhatsApp» crea un enlace largo y abre WhatsApp con el link', enlace && enlace.length >= 24 && wa && wa.startsWith('https://wa.me/') && decodeURIComponent(wa).includes('/evento#' + enlace), wa)
  await d.screenshot({ path: SHOTS + 'e2e-1-duenio.png', fullPage: true })

  // ---------- AMIGO SIN CUENTA ----------
  const a = await pagina(b, null)
  await a.goto('http://localhost:8765/evento#' + enlace); await espera(a, 1000)
  ok('amigo: ve el nombre del grupo', (await a.textContent('#titulo')) === 'Cumple de Juan')
  ok('amigo: le pregunta quién es', await a.isVisible('#sec-quien'))
  await a.fill('#quien-nombre', 'Mati'); await a.click('#quien-sumar'); await espera(a, 600)
  ok('amigo: se sumó y ve su sección', await a.isVisible('#sec-yo') && (await a.textContent('#yo-nombre')) === 'Mati')
  await a.click('#mas'); await espera(a); await a.click('#mas'); await espera(a)
  ok('amigo: dice que van 3 con él', (await a.textContent('#cuantos')) === '3' && (await a.textContent('#cuantos-txt')) === 'Vos y 2 más')
  await a.fill('#g-desc', 'Torta'); await a.fill('#g-monto', '20.000'); await a.click('#g-guardar'); await espera(a, 600)
  const deudaA = await a.textContent('#yo-cuentas')
  // total 80000; cabezas: Lu 1 + Mati 3 = 4 → 20000 c/u. Mati puso 20000, le toca 60000 → le paga 40000 a Lu
  ok('amigo: la cuenta da bien (le paga $ 40.000 a Lu)', deudaA.includes('Le pagás $ 40.000,00 a Lu'), deudaA)
  ok('amigo: no puede borrar la carne del dueño (sin botón)', (await a.$$('[data-borrar]')).length === 1)
  await a.screenshot({ path: SHOTS + 'e2e-2-amigo.png', fullPage: true })
  await a.click('[data-pague]'); await espera(a, 600)
  ok('amigo: «Ya le pagué» lo deja a mano', (await a.textContent('#yo-cuentas')).includes('Estás a mano'))
  await a.reload(); await espera(a, 1000)
  ok('amigo: al volver a abrir, lo recuerda (no pregunta de nuevo)', await a.isVisible('#sec-yo') && !(await a.isVisible('#sec-quien')))

  // ---------- AMIGA CON CUENTA ----------
  const v = await pagina(b, VALE)
  await v.goto('http://localhost:8765/evento#' + enlace); await espera(v, 1000)
  await v.fill('#quien-nombre', 'Vale'); await v.click('#quien-sumar'); await espera(v, 600)
  await v.goto('http://localhost:8765/'); await espera(v, 1200)
  await v.evaluate((uid) => { user = { id: uid }; PROFILE = { nombre: 'Vale' }; sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); subView = 'grupos'; show('sub'); renderSub(); bindSub() }, VALE)
  await espera(v, 800)
  ok('amiga con cuenta: le aparece en «Grupos donde te sumaron»', (await v.textContent('#grp-root')).includes('Grupos donde te sumaron') && (await v.textContent('#grp-root')).includes('Cumple de Juan'))
  await v.screenshot({ path: SHOTS + 'e2e-3-amiga-cuenta.png', fullPage: true })

  // ---------- DUEÑO ve todo y cambia el enlace ----------
  await d.click('#g-volver'); await espera(d); await d.click('[data-g-abrir]'); await espera(d, 800)
  const t = await d.textContent('#grp-root')
  ok('dueño: ve a Mati y Vale, la torta y el pago anotado', t.includes('Mati') && t.includes('Vale') && t.includes('Torta') && t.includes('Pagos anotados'))
  await d.screenshot({ path: SHOTS + 'e2e-4-duenio-ve-todo.png', fullPage: true })
  await d.click('#g-cambiar-enlace'); await espera(d, 300)
  await d.click('text=Cambiar >> nth=-1').catch(() => {}); await espera(d, 600)
  const nuevo = await d.evaluate(() => GRP.grupos[0].enlace)
  ok('dueño: cambió el enlace', nuevo && nuevo !== enlace)
  await a.reload(); await espera(a, 1000)
  ok('amigo: con el enlace viejo ve un aviso claro', await a.isVisible('#sec-error') && (await a.textContent('#error-txt')).includes('no existe o lo cambiaron'))

  for (const [n, p] of [['dueño', d], ['amigo', a], ['amiga', v]]) ok(`${n}: sin errores de JavaScript`, p.errs.length === 0, p.errs)
  log(`\n${fallas ? fallas + ' FALLAS' : 'todo bien'}`)
  await b.close(); srv.close(); process.exit(fallas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
