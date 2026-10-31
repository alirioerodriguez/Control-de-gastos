// Gastos de grupo (viajes, salidas): reparto, saldos y cómo saldar cuentas. Uso:  node tests/grupo.test.js
const G = require('../grupo.js')

let total = 0
let fallas = 0
const ok = (nombre, cond, detalle) => {
  total++
  if (cond) console.log('✓', nombre)
  else { fallas++; console.log('✗', nombre, detalle !== undefined ? '\n   ' + JSON.stringify(detalle) : '') }
}
const eq = (nombre, a, b) => ok(nombre, JSON.stringify(a) === JSON.stringify(b), { obtuve: a, esperaba: b })
const lanza = (nombre, f, texto) => {
  try { f(); ok(nombre, false, 'no lanzó') } catch (e) { ok(nombre, texto.test(e.message), e.message) }
}
const suma = (o) => Object.values(o).reduce((t, c) => t + c, 0)

const viaje = [{ id: 'ana', nombre: 'Ana' }, { id: 'beto', nombre: 'Beto' }, { id: 'cami', nombre: 'Cami' }, { id: 'dani', nombre: 'Dani' }]
const todos = viaje.map((m) => m.id)

console.log('\n— Reparto de un gasto')
eq('entre 4, partes iguales', G.repartir({ id: 'g1', monto: 100000, participantes: todos }), { ana: 2500000, beto: 2500000, cami: 2500000, dani: 2500000 })
{
  const r = G.repartir({ id: 'g2', monto: 100, participantes: ['ana', 'beto', 'cami'] })
  ok('entre 3 un gasto de $ 100: los centavos sobrantes se reparten y la suma es exacta', suma(r) === 10000 && Math.max(...Object.values(r)) - Math.min(...Object.values(r)) <= 1, r)
}
{
  const r = G.repartir({ id: 'g3', monto: 90000, participantes: ['ana', 'beto', 'cami'], reparto: 'partes', detalle: { ana: 2, beto: 1, cami: 1 } })
  eq('por partes (la pareja cuenta doble)', r, { ana: 4500000, beto: 2250000, cami: 2250000 })
}
eq('por porcentajes', G.repartir({ id: 'g4', monto: 1000, participantes: ['ana', 'beto'], reparto: 'porcentajes', detalle: { ana: 70, beto: 30 } }), { ana: 70000, beto: 30000 })
eq('por montos exactos', G.repartir({ id: 'g5', monto: 1000, participantes: ['ana', 'beto'], reparto: 'montos', detalle: { ana: 400, beto: 600 } }), { ana: 40000, beto: 60000 })
eq('solo algunos participan (el que no come no paga la cena)', Object.keys(G.repartir({ id: 'g6', monto: 3000, participantes: ['ana', 'beto'] })), ['ana', 'beto'])

console.log('\n— Errores claros (nada falla en silencio)')
lanza('monto 0', () => G.repartir({ id: 'x', monto: 0, participantes: todos }), /mayor a 0/)
lanza('sin participantes', () => G.repartir({ id: 'x', monto: 10, participantes: [] }), /entre quiénes/)
lanza('persona repetida', () => G.repartir({ id: 'x', monto: 10, participantes: ['ana', 'ana'] }), /repetida/)
lanza('porcentajes que no suman 100', () => G.repartir({ id: 'x', monto: 10, participantes: ['ana', 'beto'], reparto: 'porcentajes', detalle: { ana: 50, beto: 40 } }), /suman 90/)
lanza('montos que no suman el gasto', () => G.repartir({ id: 'x', monto: 1000, participantes: ['ana', 'beto'], reparto: 'montos', detalle: { ana: 400, beto: 500 } }), /suman 900/)
lanza('sin pagador', () => G.aportes({ id: 'x', monto: 10, participantes: ['ana'] }), /quién pagó/)
eq('problema(): alguien que no es del grupo', G.problema({ id: 'x', monto: 10, pagador: 'zoe', participantes: ['ana'] }, viaje), 'Hay alguien que no es del grupo.')
eq('problema(): gasto bien cargado', G.problema({ id: 'x', monto: 10, pagador: 'ana', participantes: ['ana', 'beto'] }, viaje), null)

console.log('\n— Un viaje de verdad: 4 amigos')
// Ana pagó el alquiler de la casa ($ 400.000, entre todos); Beto el súper ($ 80.000, entre todos); Cami la nafta ($ 60.000,
// solo entre ella, Ana y Beto: Dani llegó en bus); Dani la cena ($ 52.000, entre todos).
const gastos = [
  { id: 'casa', monto: 400000, pagador: 'ana', participantes: todos },
  { id: 'super', monto: 80000, pagador: 'beto', participantes: todos },
  { id: 'nafta', monto: 60000, pagador: 'cami', participantes: ['ana', 'beto', 'cami'] },
  { id: 'cena', monto: 52000, pagador: 'dani', participantes: todos },
]
{
  const s = G.saldos(viaje, gastos).ARS
  eq('los saldos suman cero', suma(s), 0)
  // Ana: pagó 400.000; le tocó 100.000 + 20.000 + 20.000 + 13.000 = 153.000 → +247.000
  eq('saldo de Ana', s.ana, 24700000)
  eq('saldo de Beto', s.beto, 8000000 - 15300000 + 0) // pagó 80.000; le tocó 153.000 → -73.000
  eq('saldo de Cami', s.cami, 6000000 - 15300000) // pagó 60.000; le tocó 153.000 → -93.000
  eq('saldo de Dani', s.dani, 5200000 - (10000000 + 2000000 + 1300000)) // pagó 52.000; le tocó 133.000 → -81.000
  const t = G.simplificar(s)
  ok('se salda con a lo sumo 3 transferencias (personas − 1)', t.length <= 3, t)
  ok('todas las transferencias van a Ana (la única que puso de más)', t.every((x) => x.a === 'ana'), t)
  eq('lo que se transfiere es lo que Ana puso de más', t.reduce((a, x) => a + x.monto, 0), 247000)
}
{
  const frases = G.frases(viaje, gastos)
  eq('frases para WhatsApp', frases, ['Cami le paga $ 93.000,00 a Ana.', 'Dani le paga $ 81.000,00 a Ana.', 'Beto le paga $ 73.000,00 a Ana.'])
}

console.log('\n— Pagos ya hechos y varias monedas')
{
  const liq = [{ de: 'cami', a: 'ana', monto: 93000, moneda: 'ARS' }]
  const s = G.saldos(viaje, gastos, liq).ARS
  eq('después de que Cami le pagó a Ana, Cami queda a mano', s.cami, 0)
  eq('y Ana sigue esperando lo de los otros', G.simplificar(s).reduce((a, x) => a + x.monto, 0), 154000)
}
{
  const mixtos = [...gastos, { id: 'museo', monto: 120, moneda: 'USD', pagador: 'dani', participantes: ['ana', 'dani'] }]
  const r = G.resumen(viaje, mixtos)
  eq('las monedas no se mezclan', Object.keys(r).sort(), ['ARS', 'USD'])
  eq('el total en USD es solo lo de USD', r.USD.total, 120)
  eq('el total en ARS no incluye los dólares', r.ARS.total, 592000)
  ok('las frases aclaran la moneda cuando hay dos', G.frases(viaje, mixtos).some((f) => f.endsWith('(USD).')), G.frases(viaje, mixtos))
}
eq('sin gastos: están a mano', G.frases(viaje, []), [])
eq('si todo se pagó entre todos y cada uno puso lo suyo: a mano', G.frases([{ id: 'a', nombre: 'A' }, { id: 'b', nombre: 'B' }], [
  { id: '1', monto: 100, pagador: 'a', participantes: ['a', 'b'] },
  { id: '2', monto: 100, pagador: 'b', participantes: ['a', 'b'] },
]), ['Están a mano.'])
eq('dos pagaron un mismo gasto', G.saldos(viaje, [{ id: 'k', monto: 100, pagadores: { ana: 60, beto: 40 }, participantes: todos }]).ARS, { ana: 3500, beto: 1500, cami: -2500, dani: -2500 })

console.log('\n— Formato')
eq('monto en pesos', G.monto(25000, 'ARS'), '$ 25.000,00')
eq('monto en dólares', G.monto(1234567.5, 'USD'), 'US$ 1.234.567,50')

console.log('\n— Al azar: 300 viajes con gastos inventados (siempre cierran al centavo)')
{
  let semilla = 12345
  const azar = () => { semilla = (semilla * 1664525 + 1013904223) >>> 0; return semilla / 4294967296 }
  let malos = 0
  let peorTransferencias = 0
  for (let v = 0; v < 300; v++) {
    const n = 2 + Math.floor(azar() * 8)
    const miembros = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, nombre: 'P' + i }))
    const gs = []
    for (let k = 0; k < 1 + Math.floor(azar() * 15); k++) {
      const cuantos = 1 + Math.floor(azar() * n)
      const part = miembros.map((m) => m.id).sort(() => azar() - 0.5).slice(0, cuantos)
      const modos = ['igual', 'partes']
      const reparto = modos[Math.floor(azar() * 2)]
      gs.push({
        id: `g${v}-${k}`,
        monto: Math.round(azar() * 1000000) / 100 + 0.01,
        moneda: azar() < 0.2 ? 'USD' : 'ARS',
        pagador: miembros[Math.floor(azar() * n)].id,
        participantes: part,
        reparto,
        detalle: reparto === 'partes' ? Object.fromEntries(part.map((id) => [id, 1 + Math.floor(azar() * 3)])) : undefined,
      })
    }
    const s = G.saldos(miembros, gs)
    for (const moneda of Object.keys(s)) {
      const t = G.simplificar(s[moneda])
      const despues = { ...s[moneda] }
      for (const x of t) { despues[x.de] += Math.round(x.monto * 100); despues[x.a] -= Math.round(x.monto * 100) }
      const cierra = suma(s[moneda]) === 0 && Object.values(despues).every((c) => c === 0)
      peorTransferencias = Math.max(peorTransferencias, t.length - (n - 1))
      if (!cierra || t.length > n - 1) malos++
    }
  }
  ok('los saldos suman cero, las transferencias dejan a todos en cero y nunca hay más de personas − 1', malos === 0, { malos })
  ok('(control) ningún viaje necesitó más transferencias que personas − 1', peorTransferencias <= 0, peorTransferencias)
}

console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
