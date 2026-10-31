// Gastos de grupo (un viaje, una casa, una salida de amigos): varias personas, quién pagó, entre quiénes se reparte y
// cómo saldar las cuentas con la menor cantidad de transferencias. Funciones puras, sin pantalla ni base de datos.
//
// Los miembros se identifican por un id propio del grupo y NO necesitan tener la app: una persona es un nombre.
// Todo se calcula en centavos enteros (sin errores de coma flotante) y cada moneda va por separado: nunca se mezclan.
// Uso en el navegador: <script src="grupo.js"></script> → window.Grupo. En node: require('./grupo.js').
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Grupo = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  const aC = (n) => Math.round(n * 100)
  const aP = (c) => c / 100

  /** Número estable a partir de un texto, para repartir los centavos sobrantes sin favorecer siempre al primero. */
  function hash(s) {
    let h = 0
    for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return h
  }

  /**
   * Reparte `total` (centavos) según pesos enteros o decimales. Método del resto mayor: la suma da exactamente `total`.
   * `pesos`: [[id, peso], …] en un orden fijo. `semilla` rota a quién le toca el centavo que sobra.
   */
  function prorratear(total, pesos, semilla) {
    const suma = pesos.reduce((t, [, p]) => t + p, 0)
    if (!(suma > 0)) throw new Error('No hay a quién repartirle el gasto.')
    const base = pesos.map(([id, p]) => {
      const exacto = (total * p) / suma
      return { id, c: Math.floor(exacto), resto: exacto - Math.floor(exacto) }
    })
    let faltan = total - base.reduce((t, x) => t + x.c, 0)
    const n = base.length
    const orden = base
      .map((x, i) => ({ x, i, rot: (i + hash(semilla)) % n }))
      .sort((a, b) => b.x.resto - a.x.resto || a.rot - b.rot)
    for (let k = 0; faltan > 0; k++, faltan--) orden[k % n].x.c += 1
    return Object.fromEntries(base.map((x) => [x.id, x.c]))
  }

  /**
   * Cuánto le toca a cada uno de un gasto, en centavos: { idMiembro: centavos }.
   * gasto: { id, monto, participantes: [ids], reparto?: 'igual' | 'partes' | 'porcentajes' | 'montos', detalle?: { id: número } }
   *  - 'igual' (por defecto): partes iguales entre los participantes.
   *  - 'partes': detalle = partes por persona (una pareja que cuenta doble: { ana: 2, luis: 1 }).
   *  - 'porcentajes': detalle = porcentaje por persona; tiene que sumar 100.
   *  - 'montos': detalle = lo que le toca a cada uno en plata; tiene que sumar el monto.
   */
  function repartir(gasto) {
    const total = aC(gasto.monto)
    const ids = gasto.participantes || []
    if (!(total > 0)) throw new Error('El monto tiene que ser mayor a 0.')
    if (ids.length === 0) throw new Error('Elegí entre quiénes se reparte.')
    if (new Set(ids).size !== ids.length) throw new Error('Hay una persona repetida en el reparto.')
    const modo = gasto.reparto || 'igual'
    const d = gasto.detalle || {}
    if (modo === 'igual') return prorratear(total, ids.map((id) => [id, 1]), gasto.id)
    if (modo === 'partes') return prorratear(total, ids.map((id) => [id, Number(d[id]) > 0 ? Number(d[id]) : 0]), gasto.id)
    if (modo === 'porcentajes') {
      const suma = ids.reduce((t, id) => t + (Number(d[id]) || 0), 0)
      if (Math.abs(suma - 100) > 0.001) throw new Error(`Los porcentajes suman ${suma}, tienen que sumar 100.`)
      return prorratear(total, ids.map((id) => [id, Number(d[id]) || 0]), gasto.id)
    }
    if (modo === 'montos') {
      const out = Object.fromEntries(ids.map((id) => [id, aC(Number(d[id]) || 0)]))
      const suma = Object.values(out).reduce((t, c) => t + c, 0)
      if (suma !== total) throw new Error(`Los montos suman ${aP(suma)} y el gasto es ${aP(total)}.`)
      return out
    }
    throw new Error(`Reparto desconocido: ${modo}`)
  }

  /** Lo que puso cada uno, en centavos. `pagador` (uno solo) o `pagadores` { id: monto } si pagaron varios. */
  function aportes(gasto) {
    const total = aC(gasto.monto)
    if (gasto.pagadores) {
      const out = Object.fromEntries(Object.entries(gasto.pagadores).map(([id, m]) => [id, aC(m)]))
      const suma = Object.values(out).reduce((t, c) => t + c, 0)
      if (suma !== total) throw new Error(`Entre los que pagaron suman ${aP(suma)} y el gasto es ${aP(total)}.`)
      return out
    }
    if (!gasto.pagador) throw new Error('Falta decir quién pagó.')
    return { [gasto.pagador]: total }
  }

  /** Revisa un gasto sin lanzar error: devuelve un texto con el problema o null si está bien. */
  function problema(gasto, miembros) {
    try {
      const ids = new Set(miembros.map((m) => m.id))
      const r = repartir(gasto)
      const a = aportes(gasto)
      for (const id of [...Object.keys(r), ...Object.keys(a)]) if (!ids.has(id)) return 'Hay alguien que no es del grupo.'
      return null
    } catch (e) {
      return e.message
    }
  }

  /**
   * Saldo de cada miembro, por moneda y en centavos: { ARS: { ana: 5000, luis: -5000 }, … }.
   * Positivo = le deben; negativo = debe. `liquidaciones`: [{ de, a, monto, moneda }] pagos ya hechos entre ellos.
   */
  function saldos(miembros, gastos, liquidaciones = []) {
    const out = {}
    const de = (moneda) => (out[moneda] = out[moneda] || Object.fromEntries(miembros.map((m) => [m.id, 0])))
    for (const g of gastos) {
      const s = de(g.moneda || 'ARS')
      for (const [id, c] of Object.entries(aportes(g))) s[id] += c
      for (const [id, c] of Object.entries(repartir(g))) s[id] -= c
    }
    for (const l of liquidaciones) {
      const s = de(l.moneda || 'ARS')
      s[l.de] += aC(l.monto)
      s[l.a] -= aC(l.monto)
    }
    return out
  }

  /**
   * Las transferencias que dejan a todos en cero, con la menor cantidad posible (a lo sumo personas − 1).
   * saldo: { id: centavos } de una moneda. Devuelve [{ de, a, monto }] con el monto en pesos.
   */
  function simplificar(saldo) {
    const deben = Object.entries(saldo).filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c }))
    const cobran = Object.entries(saldo).filter(([, c]) => c > 0).map(([id, c]) => ({ id, c }))
    const porMonto = (a, b) => b.c - a.c || a.id.localeCompare(b.id)
    const out = []
    deben.sort(porMonto)
    cobran.sort(porMonto)
    while (deben.length && cobran.length) {
      const d = deben[0]
      const c = cobran[0]
      const m = Math.min(d.c, c.c)
      out.push({ de: d.id, a: c.id, monto: aP(m) })
      d.c -= m
      c.c -= m
      if (d.c === 0) deben.shift()
      if (c.c === 0) cobran.shift()
      deben.sort(porMonto)
      cobran.sort(porMonto)
    }
    return out
  }

  /** "$ 25.000,00" / "US$ 50,00" */
  function monto(n, moneda) {
    const [ent, dec] = Math.abs(n).toFixed(2).split('.')
    return `${n < 0 ? '-' : ''}${moneda === 'USD' ? 'US$' : '$'} ${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`
  }

  /** Cuánto pagó y cuánto le tocó a cada uno (en pesos), por moneda. Sirve para la tabla del resumen. */
  function resumen(miembros, gastos, liquidaciones = []) {
    const porMoneda = {}
    const s = saldos(miembros, gastos, liquidaciones)
    for (const moneda of Object.keys(s)) {
      const filas = Object.fromEntries(miembros.map((m) => [m.id, { id: m.id, nombre: m.nombre, pago: 0, leTocaba: 0, saldo: aP(s[moneda][m.id]) }]))
      let total = 0
      for (const g of gastos.filter((x) => (x.moneda || 'ARS') === moneda)) {
        total += aC(g.monto)
        for (const [id, c] of Object.entries(aportes(g))) filas[id].pago += c
        for (const [id, c] of Object.entries(repartir(g))) filas[id].leTocaba += c
      }
      for (const f of Object.values(filas)) {
        f.pago = aP(f.pago)
        f.leTocaba = aP(f.leTocaba)
      }
      porMoneda[moneda] = { total: aP(total), filas: Object.values(filas), transferencias: simplificar(s[moneda]) }
    }
    return porMoneda
  }

  /**
   * Mientras se completa un reparto por porcentajes o por montos: cuánto suman los valores cargados y cuánto falta.
   * Devuelve null para 'igual' y 'partes' (no hay nada que cuadrar). Los montos se cuentan en centavos para no fallar
   * por la coma flotante, pero se devuelven en pesos. `falta` negativo: se pasaron.
   */
  function cuantoFalta(gasto) {
    const modo = gasto.reparto || 'igual'
    const ids = gasto.participantes || []
    const d = gasto.detalle || {}
    if (modo === 'porcentajes') {
      const suma = Math.round(ids.reduce((t, id) => t + (Number(d[id]) || 0), 0) * 1000) / 1000
      return { suma, objetivo: 100, falta: Math.round((100 - suma) * 1000) / 1000, unidad: '%' }
    }
    if (modo === 'montos') {
      const suma = ids.reduce((t, id) => t + aC(Number(d[id]) || 0), 0)
      const objetivo = aC(Number(gasto.monto) || 0)
      return { suma: aP(suma), objetivo: aP(objetivo), falta: aP(objetivo - suma), unidad: '$' }
    }
    return null
  }

  /** Las frases para compartir por WhatsApp: «Fede le paga $ 12.000,00 a Sofi». Sin deudas: «Están a mano». */
  function frases(miembros, gastos, liquidaciones = []) {
    const nombre = Object.fromEntries(miembros.map((m) => [m.id, m.nombre]))
    const r = resumen(miembros, gastos, liquidaciones)
    const out = []
    for (const [moneda, x] of Object.entries(r)) {
      const sufijo = Object.keys(r).length > 1 ? ` (${moneda})` : ''
      if (x.transferencias.length === 0) out.push(`Están a mano${sufijo}.`)
      for (const t of x.transferencias) out.push(`${nombre[t.de]} le paga ${monto(t.monto, moneda)} a ${nombre[t.a]}${sufijo}.`)
    }
    return out
  }

  return { repartir, aportes, problema, saldos, simplificar, resumen, frases, monto, cuantoFalta }
})
