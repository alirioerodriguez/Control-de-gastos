// Intérprete local de frases ("42.300 en Coto con Visa en 3 cuotas"), copiado del de la app (index.html,
// sección "intérprete local") para que WhatsApp entienda lo mismo que el dictado. Si se cambia allá, cambiarlo acá.
// Diferencias con la app: no usa variables globales (recibe los datos del usuario en Contexto), "hoy" es el día de
// Argentina, y no lee personas (los gastos compartidos se cargan desde la app).
// deno-lint-ignore-file no-explicit-any

export type Cuenta = { key: string; nombre: string; moneda: string | null }
export type Tarjeta = { id: string; alias: string | null; banco: string | null; marca: string; cierre_dia: number | null }
export type Categoria = { nombre: string }
export type Historial = { comercio: string | null; categoria: string | null; tipo: string; cuenta: string | null }
export type Contexto = { hoy: string; cuentas: Cuenta[]; tarjetas: Tarjeta[]; categorias: Categoria[]; historial: Historial[] }

export type Resultado = {
  texto: string
  tipo: 'gasto' | 'ingreso' | 'tarjeta' | 'ahorro' | 'compartido'
  monto: number
  cuenta: string | null
  card: string | null
  cuotas: number
  fecha: string
  comercio: string | null
  categoria: string | null
  descripcion: string | null
}

let C: Contexto

const p2 = (n: number) => String(n).padStart(2, '0')
export const round2 = (n: number) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
const isoDe = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
function hoyD() {
  const [y, m, d] = C.hoy.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
const todayISO = () => C.hoy
function diasAtras(k: number) {
  const d = hoyD()
  d.setDate(d.getDate() - k)
  return isoDe(d)
}
function lunesDe(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
function diaDeSemana(dow: number, semanasAtras: number) {
  const lun = lunesDe(hoyD())
  lun.setDate(lun.getDate() - 7 * (semanasAtras || 0) + ((dow + 6) % 7))
  return lun
}
function ultimoDiaSemana(dow: number, forzarAnterior: boolean) {
  const d = hoyD()
  let resta = (d.getDay() - dow + 7) % 7
  if (resta === 0 && forzarAnterior) resta = 7
  d.setDate(d.getDate() - resta)
  return d
}

export function parseMonto(v: unknown): number {
  if (typeof v === 'number') return v
  let s = String(v == null ? '' : v).trim().replace(/\s| |\$|₿|Ξ/g, '').replace(/USDT|USDC/gi, '')
  if (!s) return NaN
  const hasC = s.includes(','), hasD = s.includes('.')
  if (hasC && hasD) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  else if (hasC) s = s.replace(/\./g, '').replace(',', '.')
  else if (hasD && /^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  return parseFloat(s)
}

const NUM_PAL: Record<string, number> = {cero:0,un:1,una:1,uno:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,
  nueve:9,diez:10,once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,
  dieciocho:18,diecinueve:19,veinte:20,veintiuno:21,veintidos:22,veintitres:23,veinticuatro:24,
  veinticinco:25,veintiseis:26,veintisiete:27,veintiocho:28,veintinueve:29,
  treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90,
  cien:100,ciento:100,doscientos:200,trescientos:300,cuatrocientos:400,quinientos:500,
  seiscientos:600,setecientos:700,ochocientos:800,novecientos:900}
const MULT_PAL: Record<string, number> = {millones:1e6,millon:1e6,palos:1e6,palo:1e6,lucas:1000,luca:1000,mil:1000,miles:1000}
const MESES_TXT = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MESES_ALT: Record<string, number> = {setiembre:8, sept:8, sep:8, ene:0, feb:1, mar:2, abr:3, may:4, jun:5, jul:6, ago:7, oct:9, nov:10, dic:11}
const DIAS_SEM: Record<string, number> = {domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6}

const VACIAS = new Set(('el la los las un una unos unas de del al a en con por para y o que mi mis su sus '
 + 'lo le me se es fue son era esta este esa ese eso esto aca alla ahi muy mas menos tambien pero si no '
 + 'pesos peso plata guita mangos dolares dolar usd ars gaste gasto pague pago compre compra cobre cobro '
 + 'puse saque guarde ahorre transferi mande pagar comprar gastar total cuesta salio vale sale fue '
 + 'tarjeta credito debito efectivo cash cuota cuotas pagos hoy ayer anteayer manana semana mes ano dia dias '
 + 'centavos centavo centimos centimo decimal decimales coma punto '
 + 'ultimo ultima proximo proxima pasado pasada equivoque perdon corrijo digo realidad mejor dicho').split(' '))

export function normV(t: unknown) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }
function esVacia(w: string) {
  const n = normV(w).replace(/[^a-z0-9ñ]/g, '')
  return !n || n.length < 3 || VACIAS.has(n) || NUM_PAL[n] !== undefined || MULT_PAL[n] !== undefined
    || MESES_TXT.includes(n) || MESES_ALT[n] !== undefined || DIAS_SEM[n] !== undefined
}

type Lienzo = { orig: string; libre: string }
const nuevoLienzo = (txt: string): Lienzo => ({ orig: String(txt || ''), libre: normV(txt) })
function tachar(L: Lienzo, i: number, len: number) {
  if (i < 0 || !len || len < 0) return
  L.libre = L.libre.slice(0, i) + ' '.repeat(len) + L.libre.slice(i + len)
}
function buscar(L: Lienzo, re: RegExp) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  let m, ultimo: RegExpExecArray | null = null
  while ((m = g.exec(L.libre))) { ultimo = m; if (m.index === g.lastIndex) g.lastIndex++ }
  return ultimo
}

const CORRECCION = /\b(no,?\s*(?:me\s+)?equivoqu[ei]|no\s+era\s+asi|mejor\s+dicho|en\s+realidad|perdon|corrijo|correccion|no,?\s*digo|no,?\s*(?:son|fue|fueron|era|es|eran)\b|borra\s+eso|olvidat?e?\s+de\s+eso|empiezo\s+de\s+nuevo|a\s+ver\s+no)\b/g
function hayNumero(s: string) { return /\d/.test(s) || s.split(/[^a-zñ]+/).some((w) => NUM_PAL[w] !== undefined) }
function recortarCorreccion(L: Lienzo) {
  CORRECCION.lastIndex = 0
  let m, corte = -1
  while ((m = CORRECCION.exec(L.libre))) corte = m.index + m[0].length
  if (corte < 0) return null
  if (!hayNumero(L.libre.slice(corte))) return null
  tachar(L, 0, corte)
  return corte
}

function fichas(str: string) {
  const out: { w: string; i: number; len: number }[] = []
  const re = /[a-zñ0-9][a-zñ0-9.,]*/g
  let m
  while ((m = re.exec(str))) out.push({ w: m[0].replace(/[.,]+$/, ''), i: m.index, len: m[0].replace(/[.,]+$/, '').length })
  return out.filter((x) => x.w)
}
function valorFicha(w: string): number | null {
  if (/^\d[\d.]*(?:,\d{1,2})?$/.test(w)) { const v = parseMonto(w); return (isNaN(v) || v < 0) ? null : v }
  if (NUM_PAL[w] !== undefined) return NUM_PAL[w]
  if (/^medi[oa]$/.test(w)) return 0.5
  return null
}
function leerCentavos(L: Lienzo, desde: number) {
  const resto = L.libre.slice(desde)
  const m = resto.match(/^\s*(?:pesos?|mangos?)?\s*(?:con|y|coma|punto)\s+(\d{1,2}|[a-zñ]+)\s*(centavos?|centimos?|decimales?|decimal)?\b/)
         || resto.match(/^\s*(?:pesos?|mangos?)?\s*(\d{1,2}|[a-zñ]+)\s+(centavos?|centimos?|decimales?|decimal)\b/)
  if (!m) return null
  const sig = resto.slice(m[0].length, m[0].length + 14)
  if (/^\s*(cuotas?|pagos)\b/.test(sig)) return null
  const conPalabra = !!(m[2] || '').match(/cent|decim/)
  let c: number | null = null
  if (/^\d+$/.test(m[1])) {
    const n = parseInt(m[1], 10)
    if (n > 99) return null
    c = (m[1].length === 1 && !conPalabra) ? n * 10 : n
  } else if (/^medi[oa]$/.test(m[1])) c = 50
  else if (NUM_PAL[m[1]] !== undefined && NUM_PAL[m[1]] <= 99) c = NUM_PAL[m[1]]
  if (c === null) return null
  return { cent: c, len: m[0].length }
}
function leerMonto(L: Lienzo) {
  const tk = fichas(L.libre)
  let mejor: { valor: number; ini: number; fin: number } | null = null, hasta = -1
  for (let i = 0; i < tk.length; i++) {
    if (tk[i].i < hasta) continue
    if (valorFicha(tk[i].w) === null) continue
    let total = 0, j = i, ultimo = i, hubo = false
    while (j < tk.length) {
      const v = valorFicha(tk[j].w); if (v === null) break
      const mult = MULT_PAL[(tk[j + 1] || {} as any).w]
      if (mult) { total += v * mult; ultimo = j + 1; j += 2; hubo = true }
      else { total += v; ultimo = j; hubo = true; break }
    }
    if (!hubo || !(total > 0)) continue
    let fin = tk[ultimo].i + tk[ultimo].len
    if (Number.isInteger(total)) {
      const cv = leerCentavos(L, fin)
      if (cv) { total = round2(total + cv.cent / 100); fin += cv.len }
    }
    mejor = { valor: round2(total), ini: tk[i].i, fin }
    hasta = fin
  }
  if (!mejor) return null
  const texto = L.libre.slice(mejor.ini, mejor.fin).trim()
  tachar(L, mejor.ini, mejor.fin - mejor.ini)
  return { valor: mejor.valor, texto, ini: mejor.ini }
}

function leerCuotas(L: Lienzo) {
  let m = buscar(L, /\b(?:en\s+)?(\d{1,2})\s*(?:cuotas?|pagos)\b/)
  if (m) { tachar(L, m.index, m[0].length); return { valor: Math.max(1, parseInt(m[1], 10)), texto: m[0] } }
  m = buscar(L, /\b(?:en\s+)?([a-zñ]+)\s+(?:cuotas?|pagos)\b/)
  if (m && NUM_PAL[m[1]] !== undefined) { tachar(L, m.index, m[0].length); return { valor: Math.max(1, NUM_PAL[m[1]]), texto: m[0] } }
  m = buscar(L, /\b(\d{1,2})\s*x\b/)
  if (m) { tachar(L, m.index, m[0].length); return { valor: Math.max(1, parseInt(m[1], 10)), texto: m[0] } }
  m = buscar(L, /\b(un\s+pago|1\s*pago|contado|un\s+solo\s+pago)\b/)
  if (m) { tachar(L, m.index, m[0].length); return { valor: 1, texto: m[0] } }
  return null
}

function mesPorNombre(w: string) {
  if (!w) return null
  const i = MESES_TXT.indexOf(w); if (i >= 0) return i
  if (MESES_ALT[w] !== undefined) return MESES_ALT[w]
  return null
}
function leerFecha(L: Lienzo) {
  const cands: { valor: string; texto: string; i: number; len: number }[] = []
  const probar = (re: RegExp, armar: (m: RegExpExecArray) => string | null) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m
    while ((m = g.exec(L.libre))) {
      const v = armar(m)
      if (v) cands.push({ valor: v, texto: m[0], i: m.index, len: m[0].length })
      if (m.index === g.lastIndex) g.lastIndex++
    }
  }
  probar(/\b(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\s+(?:de\s+)?la\s+semana\s+(pasada|anterior|que\s+paso|esta|actual)\b/,
    (m) => isoDe(diaDeSemana(DIAS_SEM[m[1]], /esta|actual/.test(m[2]) ? 0 : 1)))
  probar(/\bla\s+semana\s+(?:pasada|anterior)\s+(?:el\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/,
    (m) => isoDe(diaDeSemana(DIAS_SEM[m[1]], 1)))
  probar(/\b(anteayer|antes de ayer)\b/, () => diasAtras(2))
  probar(/\bayer\b/, () => diasAtras(1))
  probar(/\bhoy\b/, () => diasAtras(0))
  probar(/\bhace\s+(\d{1,3}|[a-zñ]+)\s*(d[ií]as?|semanas?|mes(?:es)?)\b/, (m) => {
    const n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : NUM_PAL[m[1]]
    if (n === undefined || n === null) return null
    const d = hoyD()
    if (/^d/.test(m[2])) d.setDate(d.getDate() - n)
    else if (/^s/.test(m[2])) d.setDate(d.getDate() - n * 7)
    else d.setMonth(d.getMonth() - n)
    return isoDe(d)
  })
  probar(/\b(la\s+semana\s+pasada|el\s+mes\s+pasado|el\s+finde|el\s+fin\s+de\s+semana)\b/, (m) => {
    if (/finde|fin\s+de\s+semana/.test(m[0])) return isoDe(ultimoDiaSemana(6, true))
    const d = hoyD()
    if (/mes/.test(m[0])) d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 7)
    return isoDe(d)
  })
  probar(/\b(?:el\s+|este\s+)?(domingo|lunes|martes|miercoles|jueves|viernes|sabado)(\s+pasado)?\b/,
    (m) => isoDe(ultimoDiaSemana(DIAS_SEM[m[1]], !!m[2])))
  probar(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/, (m) => {
    const dia = parseInt(m[1], 10), mes = parseInt(m[2], 10)
    let y = m[3] ? parseInt(m[3], 10) : hoyD().getFullYear(); if (y < 100) y += 2000
    return (dia <= 31 && mes >= 1 && mes <= 12) ? `${y}-${p2(mes)}-${p2(dia)}` : null
  })
  probar(/\b(?:el\s+)?(\d{1,2}|primero|primer)\s+de\s+([a-zñ]+)\b/, (m) => {
    const mes = mesPorNombre(m[2]); if (mes === null) return null
    const dia = /^p/.test(m[1]) ? 1 : parseInt(m[1], 10)
    if (!(dia >= 1 && dia <= 31)) return null
    const y = hoyD().getFullYear()
    let f = `${y}-${p2(mes + 1)}-${p2(dia)}`
    if (f > todayISO()) f = `${y - 1}-${p2(mes + 1)}-${p2(dia)}`
    return f
  })
  probar(/\bel\s+(\d{1,2})\b/, (m) => {
    const dia = parseInt(m[1], 10); if (!(dia >= 1 && dia <= 31)) return null
    const h = hoyD(); const d = new Date(h.getFullYear(), h.getMonth(), dia, 12)
    if (dia > h.getDate()) d.setMonth(d.getMonth() - 1)
    return isoDe(d)
  })
  if (!cands.length) return null
  const enteros = cands.filter((x) => !cands.some((y) => y !== x && y.i <= x.i && (y.i + y.len) >= (x.i + x.len) && y.len > x.len))
  enteros.sort((x, y) => (x.i - y.i) || (x.len - y.len))
  const g = enteros[enteros.length - 1]
  tachar(L, g.i, g.len)
  return { valor: g.valor, texto: g.texto }
}

export function cardMarca(c: Tarjeta | null) { return !c ? 'Tarjeta' : (c.marca === 'visa' ? 'Visa' : c.marca === 'mastercard' ? 'Mastercard' : c.marca === 'amex' ? 'Amex' : 'Tarjeta') }
export function cardTitulo(c: Tarjeta | null) { if (!c) return 'Otra'; return c.alias ? c.alias : cardMarca(c) + (c.banco ? ' ' + c.banco : '') }
export function cardLabel(c: Tarjeta | null) { if (!c) return 'Otra'; return cardMarca(c) + (c.banco ? ' ' + c.banco : '') + (c.alias ? ' · ' + c.alias : '') }
const catsAlfa = () => C.categorias.slice().sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' }))

function buscarNombre(L: Lienzo, nombre: string) {
  const n = normV(nombre).trim(); if (n.length < 3) return -1
  const re = new RegExp('(?:^|[^a-z0-9ñ])(' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![a-z0-9ñ])', 'g')
  let m, ult = -1
  while ((m = re.exec(L.libre))) { ult = m.index + m[0].length - n.length; if (m.index === re.lastIndex) re.lastIndex++ }
  return ult
}
function leerTarjeta(L: Lienzo) {
  let best: { valor: string; texto: string; i: number } | null = null
  C.tarjetas.forEach((c) => { [c.alias, c.banco, c.marca, cardTitulo(c)].filter(Boolean).forEach((w) => {
    const i = buscarNombre(L, w as string)
    if (i >= 0 && (!best || i > best.i || normV(w).length > best.texto.length)) best = { valor: c.id, texto: normV(w), i } }) })
  if (best) { const b = best as { valor: string; texto: string; i: number }; tachar(L, b.i, b.texto.length); return b }
  const m = buscar(L, /\b(tarjeta|credito)\b/)
  if (m && C.tarjetas.length) { tachar(L, m.index, m[0].length); return { valor: C.tarjetas[0].id, texto: m[0] } }
  return null
}
function leerCuenta(L: Lienzo) {
  let best: { valor: string; texto: string; i: number } | null = null
  C.cuentas.forEach((a) => { const i = buscarNombre(L, a.nombre)
    if (i >= 0 && (!best || i > best.i)) best = { valor: a.key, texto: normV(a.nombre), i } })
  if (best) { const b = best as { valor: string; texto: string; i: number }; tachar(L, b.i, b.texto.length); return b }
  const m = buscar(L, /\b(efectivo|cash|en mano)\b/)
  if (m) { const a = C.cuentas.find((x) => /efectivo/i.test(x.nombre))
    if (a) { tachar(L, m.index, m[0].length); return { valor: a.key, texto: m[0] } } }
  return null
}

const MARCAS = ('coto carrefour jumbo disco vea dia changomas walmart makro vital maxiconsumo '
 + 'farmacity farmaonline ypf shell axion refsol mercadolibre rappi pedidosya glovo '
 + 'uber cabify didi netflix spotify disney hbo amazon apple google steam playstation xbox '
 + 'starbucks mcdonalds burgerking mostaza subway havanna freddo grido kansas kentucky '
 + 'fravega garbarino musimundo easy sodimac dexter adidas nike zara uniqlo dafiti '
 + 'despegar aerolineas flybondi jetsmart booking airbnb '
 + 'edenor edesur metrogas camuzzi naturgy aysa personal claro movistar fibertel telecentro flow directv '
 + 'osde swissmedical galeno sancor medife '
 + 'decathlon ikea openfarma pigmento juleriaque cetrogar').split(' ')

function comerciosUsados() {
  const s = new Set<string>()
  C.historial.forEach((t) => { if (t.comercio) s.add(t.comercio.trim()) })
  return [...s].sort((a, b) => b.length - a.length)
}
function nombreOcupado(w: string) {
  const n = normV(w)
  if (C.cuentas.some((a) => normV(a.nombre) === n)) return true
  if (C.tarjetas.some((c) => [c.alias, c.banco, c.marca].filter(Boolean).some((x) => normV(x) === n))) return true
  if (catsAlfa().some((c) => normV(c.nombre) === n)) return true
  return false
}
function leerComercio(L: Lienzo) {
  for (const c of comerciosUsados()) {
    const i = buscarNombre(L, c)
    if (i >= 0) { tachar(L, i, normV(c).length); return { valor: c, texto: normV(c) } }
  }
  for (const c of MARCAS) {
    const i = buscarNombre(L, c)
    if (i >= 0) { const bonito = L.orig.substr(i, c.length)
      tachar(L, i, c.length)
      return { valor: /^[A-ZÁÉÍÓÚÑ]/.test(bonito) ? bonito : c.charAt(0).toUpperCase() + c.slice(1), texto: c } }
  }
  const re = /\b(?:en|de|a|del)\s+((?:(?:el|la|los|las)\s+)?[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'.\-]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'.\-]{1,})?)/g
  let m, elegido: { j: number; limpio: string } | null = null
  while ((m = re.exec(L.orig))) {
    const i = m.index + m[0].length - m[1].length
    if (L.libre.slice(i, i + m[1].length).trim() === '') continue
    const limpio = m[1].replace(/^(el|la|los|las)\s+/i, '').trim()
    if (esVacia(limpio) || nombreOcupado(limpio)) continue
    elegido = { j: i + (m[1].length - limpio.length), limpio }
  }
  if (elegido) { tachar(L, elegido.j, elegido.limpio.length); return { valor: elegido.limpio, texto: normV(elegido.limpio) } }
  return null
}

const CAT_PISTAS: { re: RegExp; cats: string[] }[] = [
  {re:/\b(luz|electricidad|electrico|electrica|energia|edenor|edesur|edelap|epec|epe|edea)\b/,
   cats:['Luz','Electricidad','Energía','Servicios','Casa','Hogar']},
  {re:/\b(gas|metrogas|camuzzi|naturgy|garrafa)\b/, cats:['Gas','Servicios','Casa','Hogar']},
  {re:/\b(agua|aysa|absa|aguas)\b/, cats:['Agua','Servicios','Casa','Hogar']},
  {re:/\b(internet|wifi|fibertel|telecentro|flow|fibra|banda ancha)\b/, cats:['Internet','Servicios','Casa']},
  {re:/\b(telefono|celular|linea|recarga|personal|claro|movistar|tuenti)\b/, cats:['Teléfono','Celular','Servicios']},
  {re:/\b(expensas|abl|arba|rentas|impuesto|impuestos|patente|patentes|monotributo|afip|arca|tasa|tasas)\b/,
   cats:['Impuestos','Expensas','Servicios','Casa']},
  {re:/\b(alquiler|renta|inmobiliaria|garantia)\b/, cats:['Alquiler','Casa','Hogar','Servicios']},
  {re:/\b(super|supermercado|almacen|verduleria|verdura|verduras|carniceria|carne|pollo|panaderia|fiambreria|dietetica|kiosco|chino|drugstore|mandado|mandados|comida|comidas|almuerzo|cena|cenas|desayuno|merienda|vianda|mercado|coto|carrefour|jumbo|disco|changomas|walmart)\b/,
   cats:['Comida','Supermercado','Súper','Alimentos','Comestibles']},
  {re:/\b(delivery|resto|restaurante|restoran|bar|birra|cerveza|vino|cafe|hamburguesa|pizza|sushi|helado|rappi|pedidosya|mostaza|starbucks|mcdonalds)\b/,
   cats:['Salidas','Restaurantes','Ocio','Comida']},
  {re:/\b(nafta|combustible|gasoil|surtidor|peaje|peajes|estacionamiento|cochera|taller|mecanico|neumatico|neumaticos|cubiertas|vtv|seguro del auto|auto|camioneta|moto|ypf|shell|axion|puma)\b/,
   cats:['Auto','Nafta','Transporte','Vehículo']},
  {re:/\b(sube|colectivo|colectivos|bondi|subte|tren|trenes|taxi|remis|pasaje|pasajes|micro|transporte|uber|cabify|didi)\b/,
   cats:['Transporte','Viajes']},
  {re:/\b(farmacia|farmacias|remedio|remedios|medicamento|medicamentos|medico|medica|doctor|doctora|dentista|odontologo|psicologo|psicologa|analisis|prepaga|obra social|kinesio|kinesiologo|oculista|salud|turno medico)\b/,
   cats:['Salud','Medicina','Farmacia']},
  {re:/\b(gimnasio|gym|pilates|yoga|natacion|padel|entrenador|crossfit|futbol|deporte)\b/, cats:['Gimnasio','Deporte','Salud','Ocio']},
  {re:/\b(cine|teatro|recital|recitales|show|concierto|streaming|suscripcion|suscripciones|juego|juegos|boliche|fiesta|salida|salidas|ocio)\b/,
   cats:['Ocio','Entretenimiento','Salidas','Suscripciones']},
  {re:/\b(ropa|remera|remeras|pantalon|pantalones|campera|camperas|zapatilla|zapatillas|zapato|zapatos|calzado|indumentaria|shopping|vestido|vestidos|medias|buzo|buzos)\b/,
   cats:['Ropa','Indumentaria','Compras']},
  {re:/\b(veterinario|veterinaria|veterinarios|balanceado|alimento para|mascota|mascotas|gato|gatos|perro|perros|paseador)\b/, cats:['Mascotas','Mascota']},
  {re:/\b(peluqueria|barberia|manicura|corte de pelo|cosmetica|perfume|perfumes|maquillaje|depilacion|shampoo)\b/,
   cats:['Cuidado personal','Belleza','Compras']},
  {re:/\b(colegio|escuela|universidad|facultad|curso|cursos|clase|clases|libro|libros|utiles|matricula|educacion|apuntes)\b/,
   cats:['Educación','Estudio','Cursos','Colegio']},
  {re:/\b(regalo|regalos|cumpleanos|navidad|reyes|dia de la madre|dia del padre)\b/, cats:['Regalos','Compras','Ocio']},
  {re:/\b(hotel|hoteles|vuelo|vuelos|avion|vacaciones|viaje|viajes|excursion|hospedaje|airbnb|despegar)\b/, cats:['Viajes','Vacaciones','Ocio']},
  {re:/\b(sueldo|salario|aguinaldo|honorarios|liquidacion|quincena)\b/, cats:['Sueldo','Ingresos','Trabajo']},
  {re:/\b(venta|vendi|factura|facture|freelance|changa|comision)\b/, cats:['Ventas','Freelance','Ingresos','Trabajo']},
  {re:/\b(interes|intereses|plazo fijo|dividendo|renta financiera|inversion)\b/, cats:['Intereses','Inversiones','Ingresos']},
  {re:/\b(nino|ninos|nina|ninas|bebe|panales|jardin|guarderia|chicos)\b/, cats:['Chicos','Bebé','Familia','Casa']},
]
function catExistente(nombres: string[]) {
  const lista = catsAlfa()
  for (const n of nombres) { const c = lista.find((x) => normV(x.nombre) === normV(n)); if (c) return c.nombre }
  for (const n of nombres) {
    const c = lista.find((x) => normV(x.nombre).startsWith(normV(n)) || normV(n).startsWith(normV(x.nombre)))
    if (c) return c.nombre
  }
  return null
}
function leerCategoria(L: Lienzo, comercio: string | null, textoEntero: string) {
  let best: { valor: string; texto: string } | null = null
  catsAlfa().forEach((c) => { const i = buscarNombre(L, c.nombre)
    if (i >= 0 && (!best || c.nombre.length > best.valor.length)) best = { valor: c.nombre, texto: normV(c.nombre) } })
  if (best) return (best as { valor: string }).valor
  const palabras = L.libre.split(/[^a-z0-9ñ]+/).filter((w) => w.length >= 4)
  catsAlfa().forEach((c) => { const n = normV(c.nombre); if (n.length < 4) return
    palabras.forEach((w) => { if ((n.startsWith(w) || w.startsWith(n)) && (!best || w.length > best.texto.length))
      best = { valor: c.nombre, texto: w } }) })
  if (best) return (best as { valor: string }).valor
  if (comercio) {
    const prev = C.historial.find((x) => normV(x.comercio || '') === normV(comercio) && x.categoria)
    if (prev) return prev.categoria
  }
  const todo = normV(textoEntero || L.libre)
  for (const p of CAT_PISTAS) {
    const m = p.re.exec(todo)
    if (m) { const c = catExistente(p.cats); if (c) return c }
  }
  return null
}

function leerTipo(txt: string): Resultado['tipo'] {
  const t = normV(txt)
  if (/\b(cobre|me pagaron|me deposit|ingreso|entro|entraron|sueldo|aguinaldo|vendi|facture|honorarios)\b/.test(t)) return 'ingreso'
  if (/\b(guarde|ahorre|para la meta|al ahorro|aparte para)\b/.test(t)) return 'ahorro'
  if (/\b(a medias|mitad y mitad|compartido|dividimos|dividido|entre los dos)\b/.test(t)) return 'compartido'
  return 'gasto'
}

function leerDescripcion(L: Lienzo) {
  const trozos = L.libre.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean)
  const limpios = trozos.map((tr) => {
    const ws = tr.split(/\s+/)
    while (ws.length && esVacia(ws[0])) ws.shift()
    while (ws.length && esVacia(ws[ws.length - 1])) ws.pop()
    return ws.join(' ')
  }).filter((s) => s && s.split(/\s+/).some((w) => !esVacia(w)))
  if (!limpios.length) return null
  const mejor = limpios.sort((a, b) => b.length - a.length)[0]
  return mejor.charAt(0).toUpperCase() + mejor.slice(1)
}

/** La última categoría usada de ese tipo; si no hay, la primera por orden alfabético (catsRecientes de la app). */
export function categoriaReciente(ctx: Contexto, tipo: string) {
  const t = tipo === 'ingreso' ? 'ingreso' : 'gasto'
  const nombres = ctx.categorias.map((c) => c.nombre)
  const usada = ctx.historial.find((h) => (tipo === 'tarjeta' ? h.tipo !== 'ingreso' : h.tipo === t) && h.categoria && nombres.includes(h.categoria))
  if (usada) return usada.categoria
  C = ctx
  return catsAlfa()[0]?.nombre ?? null
}

export function interpretar(texto: string, ctx: Contexto): Resultado {
  C = ctx
  const L = nuevoLienzo(texto)
  recortarCorreccion(L)
  const util = L.libre
  const V: Resultado = { texto, tipo: leerTipo(util), monto: 0, cuenta: null, card: null, cuotas: 1, fecha: todayISO(),
    comercio: null, categoria: null, descripcion: null }

  const cu = leerCuotas(L); if (cu) V.cuotas = cu.valor
  const fe = leerFecha(L); if (fe) V.fecha = fe.valor
  const mo = leerMonto(L)
  if (mo) {
    V.monto = mo.valor
    // Igual que la app: "12 cuotas de 10 lucas" o "10 mil por mes en 12 cuotas" es el valor de cada cuota
    const porCuota = /\b(por mes|cada mes|cada cuota|por cuota|mensual(?:es)?|la cuota es de|pago de cuota)\b/.test(util)
    if (V.cuotas > 1 && (porCuota || /cuotas?\s+(?:fijas\s+|sin\s+interes\s+)?de\s*\$?\s*$/.test(util.slice(0, mo.ini)))) V.monto = round2(mo.valor * V.cuotas)
  }
  const ta = leerTarjeta(L); if (ta) V.card = ta.valor
  const cc = leerCuenta(L); if (cc && !ta) V.cuenta = cc.valor
  const co = leerComercio(L); if (co) V.comercio = co.valor

  if (ta || (cu && cu.valor > 1)) { if (V.tipo === 'gasto') V.tipo = 'tarjeta' }
  if (V.tipo === 'tarjeta' && !V.card && C.tarjetas.length) V.card = C.tarjetas[0].id
  const mm = buscar(L, /\b(a medias|mitad y mitad|entre los dos|lo debe entero|me lo debe)(\s+con)?\b/)
  if (mm) tachar(L, mm.index, mm[0].length)

  V.categoria = leerCategoria(L, V.comercio, util)
  if (!V.categoria && V.tipo !== 'ahorro') V.categoria = categoriaReciente(ctx, V.tipo)
  V.descripcion = leerDescripcion(L)
  return V
}
