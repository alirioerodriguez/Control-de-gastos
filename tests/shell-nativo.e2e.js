// Prueba del lado web de la barra y el Inicio nativos de la app (index.html: «APP NATIVA») y de «Iniciar sesión con Apple».
// Necesita playwright y @supabase/supabase-js en NODE_PATH. Se saca el «integrity» de los scripts porque la librería
// se sirve desde el disco y puede no ser byte a byte la del CDN.
const { chromium } = require('playwright'), http = require('http'), fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..')
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split(/[?#]/)[0]); if (f === '/') f = '/index.html'
  fs.readFile(path.join(ROOT, f), (e, d) => { if (e) { r.writeHead(404); r.end() } else { r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(f.endsWith('.html') ? String(d).replace(/ integrity="[^"]*"/g, '') : d) } }) }).listen(8768)
const SUPA = fs.readFileSync(require.resolve('@supabase/supabase-js/dist/umd/supabase.js', { paths: (process.env.NODE_PATH || '').split(':').concat([process.cwd()]) }), 'utf8')
let fallas = 0; const ok = (t, c, d) => { if (c) console.log('✓', t); else { fallas++; console.log('✗', t, d ?? '') } }

async function pagina(b, { shell, iphone, apple }) {
  const ctx = await b.newContext(iphone ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) MisCuentasApp/1.0' } : {})
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript((shell) => { window.__msgs = []; window.ReactNativeWebView = { postMessage: (m) => window.__msgs.push(JSON.parse(m)) }; if (shell) window.__shellNativo = true }, shell)
  await p.route(/cdn\.jsdelivr\.net/, (r) => r.fulfill({ contentType: 'text/javascript', body: r.request().url().includes('supabase') ? SUPA : 'window.Chart=function(){return{destroy(){},update(){}}}' }))
  await p.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: r.request().url().includes('/auth/v1/settings') ? JSON.stringify({ external: { google: true, apple: !!apple } }) : '[]' }))
  await p.goto('http://localhost:8768/'); await p.waitForTimeout(1500)
  return { p, errs, ctx }
}

;(async () => {
  const b = await chromium.launch()

  // App vieja (sin barra nativa): nada cambia
  { const { p, errs, ctx } = await pagina(b, { shell: false })
    await p.evaluate(() => { user = { id: 'u1' }; currentUid = 'u1'; booted = true; show('app'); renderTodo() }); await p.waitForTimeout(300)
    ok('app vieja: no manda resumen ni sección', !(await p.evaluate(() => window.__msgs.some((m) => m.type === 'resumen' || m.type === 'seccion'))))
    ok('app vieja: la barra de la web se sigue viendo', await p.evaluate(() => getComputedStyle(document.getElementById('nav')).display !== 'none'))
    ok('app vieja: sin errores', errs.length === 0, errs); await ctx.close() }

  // App nueva
  { const { p, errs, ctx } = await pagina(b, { shell: true })
    ok('app nueva: esconde la barra de la web', await p.evaluate(() => document.documentElement.classList.contains('shell-nativo')))
    await p.evaluate(() => {
      user = { id: 'u1' }; currentUid = 'u1'; booted = true; PROFILE = { nombre: 'Lu Pérez' }
      const hoy = todayISO(); ACCOUNTS = [{ key: 'efectivo', nombre: 'Efectivo', moneda: 'ARS' }]; CTA_MON = { efectivo: 'ARS' }; CTA_NOMBRE = { efectivo: 'Efectivo' }
      TX = [{ id: 't1', fecha: hoy, tipo: 'gasto', monto: 12300, categoria: 'Súper', descripcion: 'Coto', cuenta: 'efectivo', created_at: hoy + 'T10:00:00Z' },
            { id: 't2', fecha: hoy, tipo: 'ingreso', monto: 500000, categoria: 'Sueldo', descripcion: '', cuenta: 'efectivo', created_at: hoy + 'T09:00:00Z' }]
      show('app'); renderTodo() })
    await p.waitForTimeout(300)
    const r = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'resumen').pop())
    ok('manda el resumen con disponible, gastado e ingresado escritos', r && /\$/.test(r.datos.disponible) && /12\.300/.test(r.datos.gastado) && /500\.000/.test(r.datos.ingresado), JSON.stringify(r && r.datos))
    ok('manda los últimos movimientos, el más nuevo primero', r && r.datos.movimientos.length === 2 && r.datos.movimientos[0].titulo === 'Coto' && r.datos.movimientos[1].ingreso === true, JSON.stringify(r && r.datos.movimientos))
    ok('manda el nombre', r && r.datos.nombre === 'Lu Pérez')
    const sec = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'seccion').pop())
    ok('avisa en qué pantalla está', sec && sec.datos.w === 'app' && sec.datos.dentro === true, JSON.stringify(sec))
    await p.evaluate(() => window.__irA('movs')); await p.waitForTimeout(200)
    ok('__irA cambia de pantalla', (await p.evaluate(() => window.__msgs.filter((m) => m.type === 'seccion').pop().datos.w)) === 'movs')
    // Movimientos nativo
    const movs = () => p.evaluate(() => window.__msgs.filter((m) => m.type === 'movs').pop()?.datos)
    const pedir = async (q) => { await p.evaluate((q) => window.__movsDesdeApp(q), q); await p.waitForTimeout(150); return movs() }
    let mv = await pedir({ filtro: 'gasto' })
    ok('Movimientos: manda las filas del mes ya escritas (gastos, como la web)', mv && mv.filtro === 'gasto' && mv.filas.length === 1 && mv.filas[0].titulo === 'Coto'
      && mv.filas[0].clase === 'gasto' && /^− \$/.test(mv.filas[0].monto) && / Súper · Efectivo$/.test(mv.filas[0].sub), JSON.stringify(mv))
    ok('Movimientos: título, total y conteo son los de la pantalla de la web', mv && await p.evaluate((d) => d.total === document.getElementById('mv-total').textContent
      && d.titulo === document.getElementById('mv-title').textContent && d.conteo === document.getElementById('mv-count').textContent, mv) && mv.chips.length === 5, JSON.stringify(mv))
    ok('Movimientos: la fila de la web no cambió', await p.evaluate(() => /Coto/.test(document.getElementById('mov-list').textContent) && /Súper · Efectivo/.test(document.getElementById('mov-list').textContent)))
    mv = await pedir({ filtro: 'todos' })
    ok('Movimientos: el chip «Todos» trae gasto e ingreso del mismo día', mv.filtro === 'todos' && mv.filas.length === 2 && mv.filas.some((f) => f.clase === 'ingreso' && /^\+ /.test(f.monto)) && mv.filas[0].dia === mv.filas[1].dia, JSON.stringify(mv.filas))
    mv = await pedir({ q: 'sueldo' })
    ok('Movimientos: busca en toda la historia', mv.busqueda === 'sueldo' && mv.filas.length === 1 && mv.filas[0].clase === 'ingreso', JSON.stringify(mv))
    mv = await pedir({ q: '' })
    const mesActual = mv.mes
    mv = await pedir({ mes: -1 })
    ok('Movimientos: mes anterior', mv.mes !== mesActual && mv.esteMes === false && mv.filas.length === 0, JSON.stringify(mv))
    mv = await pedir({ mes: 1 })
    ok('Movimientos: vuelve al mes actual', mv.mes === mesActual && mv.esteMes === true && mv.filas.length === 2)
    await p.evaluate(() => { const o = document.createElement('option'); o.value = o.textContent = 'Sueldo'; document.getElementById('f-cat').append(o) })
    mv = await pedir({ categoria: 'Sueldo' })
    ok('Movimientos: filtra por categoría', mv.categoria === 'Sueldo' && mv.filas.length === 1 && mv.filas[0].titulo === 'Sueldo', JSON.stringify(mv))
    mv = await pedir({ categoria: '' })
    await p.evaluate(() => window.__abrirMovDesdeApp('tx', 't1')); await p.waitForTimeout(200)
    ok('Movimientos: tocar una fila abre el detalle de la web', (await p.evaluate(() => window.__msgs.filter((m) => m.type === 'seccion').pop().datos)).w === 'det')
    await p.evaluate(() => window.__irA('movs')); await p.waitForTimeout(200)

    // Plan nativo
    await p.evaluate(() => {
      BUD = [{ categoria: 'Súper', monto: 20000 }]
      GOALS = [{ id: 'g1', nombre: 'Vacaciones', objetivo: 100000, moneda: 'ARS' }]; SENT = [{ id: 's1', goal_id: 'g1', monto: 25000, cuenta: 'efectivo', fecha: todayISO() }]
      REC = [{ id: 'r1', tipo: 'gasto', monto: 8000, descripcion: 'Gimnasio', categoria: 'Salud', cuenta: 'efectivo' }]
      renderTodo() })
    await p.waitForTimeout(200)
    const pl = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'plan').pop()?.datos)
    ok('Plan: manda lo que viene con el fijo sin registrar', pl && pl.viene.some((x) => x.titulo === 'Gimnasio' && /^− \$/.test(x.monto) && x.cuando === 'sin día'), JSON.stringify(pl))
    ok('Plan: manda el presupuesto con su porcentaje', pl && pl.presupuestos.length === 1 && pl.presupuestos[0].cat === 'Súper' && pl.presupuestos[0].pct === 62, JSON.stringify(pl && pl.presupuestos))
    ok('Plan: manda la meta con lo juntado y el porcentaje', pl && pl.metas.length === 1 && pl.metas[0].pct === 25 && /25\.000/.test(pl.metas[0].juntado), JSON.stringify(pl && pl.metas))
    await p.evaluate(() => window.__planDesdeApp({ ir: 'presu' })); await p.waitForTimeout(200)
    ok('Plan: «Ver todo» de presupuestos abre esa pantalla de la web', await p.evaluate(() => vista === 'sub' && subView === 'presu'))
    await p.evaluate(() => window.__planDesdeApp({ meta: 'g1' })); await p.waitForTimeout(200)
    ok('Plan: tocar una meta abre su detalle', await p.evaluate(() => vista === 'meta' && activeGoalId === 'g1'))
    const iv = pl.viene.find((x) => x.titulo === 'Gimnasio').i
    await p.evaluate((i) => window.__planDesdeApp({ viene: i }), iv); await p.waitForTimeout(200)
    ok('Plan: tocar un fijo pendiente abre Fijos', await p.evaluate(() => vista === 'sub' && subView === 'fijos'))
    // Más nativo
    const ms = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'mas').pop()?.datos)
    ok('Más: manda perfil, herramientas, ajustes (sin «Instalar») y otras apps', ms && ms.nombre === 'Lu Pérez' && ms.herramientas.length > 5
      && !ms.ajustes.some((a) => a.k === 'instalar') && ms.otras.length > 0, JSON.stringify(ms))
    await p.evaluate(() => window.__masDesdeApp({ k: 'tema' })); await p.waitForTimeout(200)
    ok('Más: tocar un ajuste abre su pantalla', await p.evaluate(() => vista === 'sub' && subView === 'tema'))
    await p.evaluate(() => window.__masDesdeApp({ k: 'cal' })); await p.waitForTimeout(200)
    ok('Más: tocar una herramienta con acción propia la corre', await p.evaluate(() => vista === 'cal'))
    ok('arranca sin hojas abiertas', await p.evaluate(() => window.__msgs.filter((m) => m.type === 'hoja').every((m) => m.datos === false)))
    await p.evaluate(() => window.__masDesdeApp({ perfil: true })); await p.waitForTimeout(300)
    ok('abrir la cuenta avisa que hay una hoja abierta', await p.evaluate(() => window.__msgs.filter((m) => m.type === 'hoja').pop()?.datos === true))
    await p.evaluate(() => window.__irA('movs')); await p.waitForTimeout(300)
    ok('al cambiar de pantalla avisa que se cerró', await p.evaluate(() => window.__msgs.filter((m) => m.type === 'hoja').pop()?.datos === false))

    await p.evaluate(() => window.__ocultarDesdeApp()); await p.waitForTimeout(200)
    ok('Plan: «ocultar montos» también tapa el Plan', await p.evaluate(() => { const d = window.__msgs.filter((m) => m.type === 'plan').pop().datos; return d.oculto && d.queda === '•••••' && d.metas[0].juntado === '•••••' }))
    ok('Movimientos: «ocultar montos» también tapa las filas', (await movs()).filas.every((f) => /•••••/.test(f.monto)), JSON.stringify((await movs()).filas))
    const o = await p.evaluate(() => window.__msgs.filter((m) => m.type === 'resumen').pop())
    ok('«ocultar montos» desde la app manda •••••', o.datos.oculto && o.datos.disponible === '•••••' && o.datos.movimientos[0].monto === '•••••', JSON.stringify(o.datos))
    await p.evaluate(() => window.__accionDesdeApp('nuevo')); await p.waitForTimeout(200)
    ok('«+» abre el formulario y avisa que salió de las pantallas con barra', (await p.evaluate(() => window.__msgs.filter((m) => m.type === 'seccion').pop().datos.dentro)) === false)
    await p.evaluate(() => window.__refrescarDesdeApp()); await p.waitForTimeout(800)
    ok('tirar para actualizar avisa al terminar', await p.evaluate(() => window.__msgs.some((m) => m.type === 'refrescado')))
    ok('app nueva: sin errores', errs.length === 0, errs); await ctx.close() }

  // Iniciar sesión con Apple
  { const { p, ctx } = await pagina(b, { shell: true, iphone: true, apple: true })
    ok('iPhone con Apple activo: muestra «Continuar con Apple»', await p.evaluate(() => !document.getElementById('au-apple-wrap').classList.contains('hidden')))
    await p.evaluate(() => document.getElementById('au-apple').click())
    ok('tocarlo le pide el ingreso a la app', await p.evaluate(() => window.__msgs.some((m) => m.type === 'apple')))
    await ctx.close() }
  { const { p, ctx } = await pagina(b, { shell: true, iphone: true, apple: false })
    ok('sin Apple activo en Supabase: no lo muestra', await p.evaluate(() => document.getElementById('au-apple-wrap').classList.contains('hidden'))); await ctx.close() }
  { const { p, ctx } = await pagina(b, { shell: true, iphone: false, apple: true })
    ok('fuera del iPhone: no lo muestra', await p.evaluate(() => document.getElementById('au-apple-wrap').classList.contains('hidden'))); await ctx.close() }

  console.log(fallas ? fallas + ' FALLAS' : 'todo bien'); await b.close(); srv.close(); process.exit(fallas ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
