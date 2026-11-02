// Mini PostgREST: lo justo que usan index.html (grupos) y evento.html, sobre el Postgres local.
const http = require('http'), { Pool } = require('pg')
const pool = new Pool({ host: '/tmp/pgtest', port: 5499, user: 'postgres', database: 'postgres' })
const id = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('ident ' + s); return '"' + s + '"' }
async function run(token, fn) {
  const c = await pool.connect()
  try {
    await c.query('begin')
    const m = /^user:([0-9a-f-]{36})$/.exec(token || '')
    await c.query(`set local role ${m ? 'authenticated' : 'anon'}`)
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [m ? m[1] : ''])
    const r = await fn(c)
    await c.query('commit'); return r
  } catch (e) { await c.query('rollback'); throw e } finally { c.release() }
}
function filtros(q) {
  const w = [], v = []
  for (const [k, val] of q) { if (['select', 'order', 'limit', 'columns'].includes(k)) continue
    if (!val.startsWith('eq.')) throw new Error('filtro ' + val); v.push(val.slice(3)); w.push(`${id(k)}::text = $${v.length}`) }
  return { where: w.length ? ' where ' + w.join(' and ') : '', v }
}
http.createServer((req, res) => {
  let body = ''; req.on('data', (d) => (body += d)); req.on('end', async () => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' }
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
    const u = new URL(req.url, 'http://x'), token = (req.headers.authorization || '').replace(/^Bearer /, '')
    const uno = (req.headers.accept || '').includes('vnd.pgrst.object')
    try {
      if (u.pathname.startsWith('/auth/')) { res.writeHead(200, cors); return res.end('{}') }
      const p = u.pathname.replace('/rest/v1/', '').split('/')
      const out = await run(token, async (c) => {
        if (p[0] === 'rpc') {
          const args = JSON.parse(body || '{}'), ks = Object.keys(args)
          const r = await c.query(`select to_json(${id(p[1])}(${ks.map((k, i) => `${id(k)} => $${i + 1}`).join(', ')})) as r`, ks.map((k) => args[k]))
          return r.rows[0].r
        }
        const t = id(p[0]), q = [...u.searchParams], { where, v } = filtros(q)
        const sel = (u.searchParams.get('select') || '*').split(',').map((s) => (s === '*' ? '*' : id(s))).join(',')
        if (req.method === 'GET') {
          let sql = `select ${sel} from ${t}${where}`
          const o = u.searchParams.get('order'); if (o) { const [col, dir] = o.split('.'); sql += ` order by ${id(col)} ${dir === 'desc' ? 'desc' : 'asc'}` }
          const l = u.searchParams.get('limit'); if (l) sql += ` limit ${Number(l)}`
          return (await c.query(sql, v)).rows
        }
        if (req.method === 'POST') { const f = JSON.parse(body), ks = Object.keys(f).map(id).join(',')
          return (await c.query(`insert into ${t} (${ks}) select ${ks} from json_populate_record(null::${t}, $1) returning *`, [JSON.stringify(f)])).rows }
        if (req.method === 'PATCH') { const f = JSON.parse(body), ks = Object.keys(f).map(id).join(','), n = v.length + 1
          return (await c.query(`update ${t} set (${ks}) = (select ${ks} from json_populate_record(null::${t}, $${n}))${where} returning *`, [...v, JSON.stringify(f)])).rows }
        if (req.method === 'DELETE') return (await c.query(`delete from ${t}${where} returning *`, v)).rows
      })
      res.writeHead(200, cors); res.end(JSON.stringify(uno && Array.isArray(out) ? out[0] : out))
    } catch (e) { res.writeHead(400, cors); res.end(JSON.stringify({ message: e.message, code: e.code || 'XX' })) }
  })
}).listen(8766, () => console.log('rest en 8766'))
