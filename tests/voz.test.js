// Pruebas del intérprete local de "Contame el gasto" (sin IA, sin internet).
// Saca el código directamente de index.html, así prueba lo mismo que corre en la app.
// Uso:  node tests/voz.test.js
const fs = require('fs')
const path = require('path')

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
const codigo = [
  html.match(/function diasAtras\(.*?\n/)[0],
  tramo('const round2 =', '/* ---------- fechas locales'),
  tramo('const p2 =', 'function mesSuma'),
  html.match(/function mesSuma\(.*?\n/)[0],
  tramo('function primeraCuotaMes', 'function cuotasDeTarjetaMes'),
  tramo('const NUM_PAL=', '/* ---------------- Gemini'),
].join('\n')

// lo mínimo de la app que el intérprete necesita
global.CATS = ['Supermercado', 'Auto', 'Salidas', 'Salud', 'Sueldo', 'Servicios', 'Nafta', 'Comida', 'Cigarrillos', 'Transporte',
  'Suscripciones', 'Ropa', 'Mascotas', 'Regalos', 'Alquiler', 'Gimnasio', 'Cuidado personal', 'Luz', 'Gas', 'Internet', 'Celular', 'Ventas'].map((nombre) => ({ nombre }))
global.ACCOUNTS = [{ key: 'ef', nombre: 'Efectivo' }, { key: 'mp', nombre: 'Mercado Pago' }, { key: 'gal', nombre: 'Banco Galicia' }, { key: 'uala', nombre: 'Ualá' }]
global.CARDS = [{ id: 'v1', alias: '', banco: 'Galicia', marca: 'Visa' }, { id: 'm1', alias: '', banco: 'Santander', marca: 'Mastercard' }]
global.PAIRS = [{ id: 'p1' }]; global.TX = []; global.PURCH = []; global.STXN = []; global.user = { id: 'u' }
global.catsAlfa = () => CATS
global.cardTitulo = (c) => c.marca + ' ' + c.banco
global.otherProf = () => ({ apodo: 'Sofi' }); global.otherId = () => 'u2'
eval(codigo + ';global.planCuotas=planCuotas;global.mesSuma=mesSuma;global.interpretarLocal=interpretarLocal;global.movimientos=()=>VS;global.resetVoz=()=>{VS=[];vozSel=0;APRENDE={categoria:{},comercio:{}};};global.aprender=(a)=>{APRENDE=a;};')

const hoy = diasAtras(0), ayer = diasAtras(1), anteayer = diasAtras(2)
// frase → lo que tiene que salir (uno por movimiento; sólo se comparan los campos que se ponen)
const CASOS = [
  'Montos',
  ['$12.300 en el super', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['12.300,50 en el super', [{ monto: 12300.5 }]],
  ['doce mil trescientos en el super', [{ monto: 12300 }]],
  ['12 mil 300 en el super', [{ monto: 12300 }]],
  ['quince mil en el súper', [{ monto: 15000, categoria: 'Supermercado' }]],
  ['15 000 en el super', [{ monto: 15000 }]],
  ['1,500 en la verdulería', [{ monto: 1500 }]],
  ['15k de nafta', [{ monto: 15000, categoria: 'Nafta' }]],
  ['un millón y medio de la moto', [{ monto: 1500000 }]],
  ['dos millones y medio del auto', [{ monto: 2500000 }]],
  ['medio palo de la moto', [{ monto: 500000 }]],
  ['2 lucas y media de pan', [{ monto: 2500 }]],
  ['ciento cincuenta pesos de pan', [{ monto: 150 }]],
  ['mil quinientos en el kiosco', [{ monto: 1500 }]],
  ['mil doscientos cincuenta de pan', [{ monto: 1250 }]],
  ['novecientos noventa y nueve en el kiosco', [{ monto: 999 }]],
  ['trescientos cincuenta mil de alquiler', [{ monto: 350000, categoria: 'Alquiler' }]],
  ['un millón trescientos cuarenta y cinco mil seiscientos setenta y ocho de la moto', [{ monto: 1345678 }]],
  ['12 millones 533 mil 422 con 21', [{ monto: 12533422.21 }]],
  ['350 con 50 centavos', [{ monto: 350.5 }]],
  ['3,50 de un chicle', [{ monto: 3.5 }]],
  ['$ 5.000,00', [{ monto: 5000 }]],
  ['pagué 15,000 de nafta en YPF', [{ monto: 15000, comercio: 'YPF' }]],
  ['3500 por 2 medialunas', [{ monto: 3500 }]],
  ['2 cafés y 2 medialunas, 9.000', [{ monto: 9000 }]],
  ['pagué el 50% de la cena 10000', [{ monto: 10000 }]],
  ['el colectivo línea 60 1200', [{ monto: 1200, categoria: 'Transporte' }]],
  ['compré pan', [{ monto: 0 }]],                                   // sin monto: la app lo pide

  'Montos grandes con centavos (como los escriba el dictado)',
  ['1.345.342,25', [{ monto: 1345342.25 }]],
  ['1.345.342.25 centavos', [{ monto: 1345342.25 }]],
  ['gasté 1.345.342.25 centavos en el coto', [{ monto: 1345342.25, comercio: 'Coto' }]],
  ['1.345.342. 25 centavos', [{ monto: 1345342.25 }]],
  ['$1,345,342.25 en el coto', [{ monto: 1345342.25 }]],
  ['1345342.25 en el coto', [{ monto: 1345342.25 }]],
  ['1 345 342,25', [{ monto: 1345342.25 }]],
  ['1345342 25 centavos', [{ monto: 1345342.25 }]],
  ['1.345.342 y 25 centavos', [{ monto: 1345342.25 }]],     // uno solo, no dos gastos
  ['1.345.342 coma 25', [{ monto: 1345342.25 }]],
  ['1.345.342 pesos con 25 centavos', [{ monto: 1345342.25 }]],
  ['un millón trescientos cuarenta y cinco mil trescientos cuarenta y dos pesos con veinticinco centavos', [{ monto: 1345342.25 }]],
  ['1 millón 345 mil 342 con 25', [{ monto: 1345342.25 }]],
  ['12.300.50 en el super', [{ monto: 12300.5 }]],
  ['pagué 5.000.000 del auto', [{ monto: 5000000 }]],
  ['Acabo de hacer una compra de 1 millón 345,345 con 45 pesos', [{ monto: 1345345.45, descripcion: null }]],   // dictado real, mezcla palabras y números
  ['1 millón 345.345,45', [{ monto: 1345345.45 }]],
  ['2 millones 500,000', [{ monto: 2500000 }]],
  ['5 mil 3000', [{ monto: 5000 }]],
  ['2.5 millones', [{ monto: 2500000 }]],

  'Jerga argentina: palos, lucas, gambas y mangos',
  ['2 palos del auto', [{ monto: 2000000 }]],
  ['un palo y medio de la moto', [{ monto: 1500000, descripcion: 'Moto' }]],
  ['medio palo de la heladera', [{ monto: 500000 }]],
  ['dos palos y medio', [{ monto: 2500000 }]],
  ['3 palos 200 lucas', [{ monto: 3200000 }]],
  ['1 palo 345 lucas con 45 mangos', [{ monto: 1345045 }]],      // los mangos que faltan son pesos
  ['2 lucas con 500', [{ monto: 2500 }]],
  ['500 mangos de chicles', [{ monto: 500, descripcion: 'Chicles' }]],
  ['20 mil mangos en el super', [{ monto: 20000 }]],
  ['2 palos de mangos', [{ monto: 2000000 }]],
  ['2 gambas de pan', [{ monto: 200, descripcion: 'Pan' }]],
  ['una gamba de propina', [{ monto: 100 }]],
  ['3 lucas y media', [{ monto: 3500 }]],
  ['me salió 1 palo y pico', [{ monto: 1000000, descripcion: null }]],
  ['50 verdes de spotify', [{ monto: 50, descripcion: null }]],

  'Casos del día a día (v6.6)',
  ['Me depositaron el sueldo, un palo 850.', [{ monto: 1850000, tipo: 'ingreso' }]],
  ['un millón quinientos de la moto', [{ monto: 1500000 }]],
  ['Pagué la expensa, 180.000 por transferencia del Galicia.', [{ monto: 180000, cuenta: 'gal', tipo: 'gasto', descripcion: 'Expensa' }]],
  ['Pagué 1.200.000 del aguinaldo a la empleada', [{ monto: 1200000, tipo: 'gasto' }]],
  ['cena con Sofi 36 mil, la pagué yo, me debe la mitad', [{ tipo: 'compartido', split: 'ambos' }]],
  ['Sofi pagó el súper, 48.000, a medias', [{ tipo: 'compartido', pagador: 'u2', cuenta: 'ef' }]],
  ['Fuimos al cine, 2 entradas a 9 mil cada una', [{ monto: 18000, categoria: 'Salidas' }]],
  ['pasé 200 mil del Galicia a Mercado Pago', [{ especial: 'transferencia_propia', tipo: 'gasto' }]],
  ['compré 200 dólares, me salieron 250 mil pesos', [{ especial: 'cambio_moneda' }]],
  ['Préstamo: le presté 50 lucas a mi hermano', [{ monto: 50000, especial: 'prestamo' }]],
  ['Me prestaron 100 mil', [{ tipo: 'ingreso', especial: 'prestamo' }]],
  ['Gasté 8.500 en la verdu y 12.300 en la carnicería.', [{ monto: 8500, categoria: 'Supermercado' }, { monto: 12300, categoria: 'Supermercado' }]],
  ['Pague la cuota del gimnasio, 35 lucas con Ualá', [{ monto: 35000, cuenta: 'uala', categoria: 'Gimnasio' }]],
  ['Hoy cargué nafta por 45.000 en la Shell con la Visa.', [{ monto: 45000, card: 'v1', comercio: 'Shell' }]],
  ['Netflix 15.990 con la Master.', [{ monto: 15990, card: 'm1', categoria: 'Suscripciones' }]],
  ['televisor de 900 lucas en 12 cuotas, ya pagué 4', [{ monto: 900000, cuotas: 12, pagadas: 4 }]],
  ['El 3 de octubre pagué el seguro del auto, 89.000', [{ monto: 89000, categoria: 'Auto' }]],
  ['Gasté 2.000 en el estacionamiento y 1.500 en el peaje', [{ monto: 2000 }, { monto: 1500 }]],
  ['compre remedios en la farmacia por 27.640 con 50 centavos', [{ monto: 27640.5, categoria: 'Salud' }]],
  ['Doce mil trescientos cuarenta y cinco con cincuenta en el súper', [{ monto: 12345.5 }]],

  'Lo que la app aprendió de las correcciones (v6.8)',
  ['gasté 7000 en lo de Pepe', [{ _aprendido: { categoria: { pepe: 'Salidas' }, comercio: {} }, monto: 7000, categoria: 'Salidas' }]],
  ['4500 en la verdulería', [{ _aprendido: { categoria: { verduleria: 'Comida' }, comercio: {} }, categoria: 'Comida' }]],   // le gana a la regla general
  ['compré en el Jumbito 12 mil', [{ _aprendido: { categoria: {}, comercio: { jumbito: 'Jumbo' } }, comercio: 'Jumbo', categoria: 'Supermercado' }]],
  ['4500 en la verdulería', [{ categoria: 'Supermercado' }]],    // sin nada aprendido, la regla general

  'Orden libre y etiquetas',
  ['supermercado 12.300', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['12.300 supermercado', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['categoría comida, monto 5000, descripción almuerzo con Juan', [{ monto: 5000, categoria: 'Comida', descripcion: 'Almuerzo con Juan' }]],
  ['descripción almuerzo con Juan 5000 comida', [{ monto: 5000, categoria: 'Comida', descripcion: 'Almuerzo con Juan' }]],
  ['monto: 5000; comercio: La Parolaccia; categoría: salidas', [{ monto: 5000, categoria: 'Salidas', comercio: 'La Parolaccia' }]],
  ['comercio La Parolaccia salidas 5000 ayer', [{ monto: 5000, categoria: 'Salidas', comercio: 'La Parolaccia', fecha: ayer }]],
  ['la categoría es supermercado y el monto 12.300', [{ monto: 12300, categoria: 'Supermercado' }]],
  ['Pagué la luz. 35.000. Con mercado pago. Ayer.', [{ monto: 35000, categoria: 'Luz', cuenta: 'mp', fecha: ayer }]],

  'Fechas',
  ['5000 de pan ayer', [{ fecha: ayer }]],
  ['5000 de pan anteayer', [{ fecha: anteayer }]],
  ['5000 de pan antes de ayer', [{ fecha: anteayer }]],
  ['anoche 20 mil de cena', [{ fecha: ayer, categoria: 'Comida' }]],
  ['hace 3 días 5000 de pan', [{ fecha: diasAtras(3) }]],
  ['hace una semana 5000 de pan', [{ fecha: diasAtras(7) }]],
  ['coto de 9 de julio 20 mil', [{ fecha: hoy, comercio: 'Coto' }]],   // es la avenida, no una fecha
  ['15.000 en el coto ayer, no, fue hoy', [{ fecha: hoy }]],

  'Cuentas y tarjetas',
  ['5000 de pan en efectivo', [{ cuenta: 'ef' }]],
  ['5000 de pan con mercado pago', [{ cuenta: 'mp' }]],
  ['5000 de pan con mercadopago', [{ cuenta: 'mp' }]],
  ['40 mil de zapatillas con la visa', [{ tipo: 'tarjeta', card: 'v1', categoria: 'Ropa' }]],
  ['40 mil de zapatillas con la master', [{ tipo: 'tarjeta', card: 'm1' }]],
  ['120 mil de zapatillas en 6 cuotas sin interés', [{ tipo: 'tarjeta', cuotas: 6, descripcion: 'Zapatillas' }]],
  ['120 mil de zapatillas en doce cuotas', [{ cuotas: 12 }]],
  ['120 mil en 12x con la visa', [{ cuotas: 12, card: 'v1' }]],
  ['50 lucas, dos cuotas, la visa', [{ monto: 50000, cuotas: 2 }]],
  ['12 cuotas de 10000 de la heladera', [{ monto: 120000, cuotas: 12 }]],   // el total, no la cuota
  ['12 cuotas de 10 lucas de la heladera', [{ monto: 120000, cuotas: 12 }]],
  ['6 cuotas de 30 mil del celular', [{ monto: 180000, cuotas: 6 }]],
  ['180 lucas en 6 cuotas de 30 mil', [{ monto: 180000, cuotas: 6 }]],
  ['doce cuotas de diez lucas', [{ monto: 120000, cuotas: 12 }]],
  ['15.000 y 3 cuotas en el coto', [{ monto: 15000, cuotas: 3 }]],

  'Tipo de movimiento',
  ['cobré 500 mil de sueldo', [{ tipo: 'ingreso', categoria: 'Sueldo' }]],
  ['me pagaron 80 mil de un trabajo', [{ tipo: 'ingreso' }]],
  ['me transfirieron 30 mil', [{ tipo: 'ingreso' }]],
  ['me devolvieron 5000 de una compra', [{ tipo: 'ingreso' }]],
  ['el interés del plazo fijo 12 mil', [{ tipo: 'ingreso' }]],
  ['vendí la bici en 150 mil', [{ tipo: 'ingreso', categoria: 'Ventas' }]],
  ['guardé 50 mil', [{ tipo: 'ahorro' }]],
  ['aparté 20 mil para las vacaciones', [{ tipo: 'ahorro' }]],
  ['le transferí 15 mil a mi hermana', [{ tipo: 'gasto', especial: undefined }]],
  ['pagué la tarjeta 300 mil', [{ especial: 'resumen_tarjeta' }]],          // no es un gasto nuevo
  ['saqué 20 mil del cajero', [{ especial: 'transferencia_propia' }]],

  'Compartidos',
  ['30 mil de la cena a medias con Sofi', [{ tipo: 'compartido', split: 'ambos', categoria: 'Comida' }]],
  ['a medias con sofi 30 mil', [{ tipo: 'compartido', categoria: null }]],   // "a medias" no es ropa
  ['Sofi me debe 15 mil del cine', [{ tipo: 'compartido', split: 'solo_otro' }]],
  ['pagó Sofi 30 mil del super a medias', [{ tipo: 'compartido', pagador: 'u2' }]],
  ['50 y 50 con Sofi la pizza 20 mil', [{ monto: 20000, tipo: 'compartido' }]],

  'Categorías',
  ['8000 en la farmacia', [{ categoria: 'Salud' }]],
  ['Farmacity 8000', [{ categoria: 'Salud', comercio: 'Farmacity' }]],
  ['uber 6000', [{ categoria: 'Transporte', comercio: 'Uber' }]],
  ['cargué la sube 5000', [{ categoria: 'Transporte' }]],
  ['netflix 12 mil', [{ categoria: 'Suscripciones', comercio: 'Netflix' }]],
  ['spotify 4500', [{ categoria: 'Suscripciones' }]],
  ['edenor 35 mil', [{ categoria: 'Luz', comercio: 'Edenor' }]],
  ['la factura del gas 20 mil', [{ categoria: 'Gas' }]],
  ['el celular 18 mil', [{ categoria: 'Celular' }]],
  ['corte de pelo 15 mil', [{ categoria: 'Cuidado personal' }]],
  ['alimento del perro 40 mil', [{ categoria: 'Mascotas' }]],
  ['regalo de cumpleaños 25 mil', [{ categoria: 'Regalos' }]],
  ['cine 12 mil', [{ categoria: 'Salidas' }]],
  ['rappi 15 mil', [{ comercio: 'Rappi' }]],
  ['compras en el dia 30 mil', [{ categoria: 'Supermercado', comercio: 'Día' }]],
  ['peaje 2500', [{ categoria: 'Auto' }]],
  ['pagué 5000 al plomero', [{ categoria: 'Servicios' }]],
  ['compré pan, leche y huevos por 8.000', [{ categoria: 'Supermercado', descripcion: 'Pan, leche y huevos' }]],

  'Comercios y palabras trampa',
  ['mcdonalds 14 mil', [{ comercio: "McDonald's" }]],
  ['pedidosya 15 mil', [{ comercio: 'PedidosYa' }]],
  ['mercado libre 60 mil de una silla', [{ comercio: 'Mercado Libre', categoria: null }]],   // no es el súper
  ['7 eleven 3000', [{ comercio: '7-Eleven' }]],
  ['GASTÉ 15000 EN COTO', [{ comercio: 'Coto' }]],
  ['claro, 5000 en el coto', [{ categoria: 'Supermercado', comercio: 'Coto' }]],   // "claro" es una muletilla
  ['gasto personal 5000 de ropa', [{ categoria: 'Ropa', comercio: null }]],
  ['al otro día pagué 5000 de pan', [{ comercio: null }]],
  ['5000 en un disco de vinilo', [{ comercio: null, categoria: null }]],
  ['gasté 5000 en la cena del día del padre', [{ comercio: null, categoria: 'Comida' }]],
  ['eh este bueno gasté o sea 5000 en el kiosco', [{ monto: 5000, descripcion: 'Kiosco' }]],
  ['15.000 pesos, 15.000 en el coto', [{ monto: 15000, comercio: 'Coto' }]],   // dicho dos veces: uno solo

  'Equivocarse y corregir (cambia sólo lo que se vuelve a decir)',
  ['gaste 15.000 en mercado en el coto, ah no eso no, fueron 16.500 en el coto', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, no me equivoqué, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, perdón, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000, mentira, 16.500 en el coto', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, ah no, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, no no, fueron 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, error, eran 16.500', [{ monto: 16500, comercio: 'Coto', descripcion: null }]],
  ['gasté 15.000 en el coto, uy no, 16.500', [{ monto: 16500, comercio: 'Coto' }]],
  ['gasté 15 mil en el coto, me confundí, 16 mil 500', [{ monto: 16500, comercio: 'Coto' }]],
  ['15.000 en el coto, no espera, 16.000', [{ monto: 16000, comercio: 'Coto' }]],
  ['gasté 10 lucas, no, pará, 12 lucas en el coto', [{ monto: 12000 }]],
  ['15.000 en el coto, no pará, 16.000', [{ monto: 16000, comercio: 'Coto' }]],
  ['15.000 en el coto, pará, 16.000', [{ monto: 16000, comercio: 'Coto' }]],
  ['15.000 en el coto, esperá, 16.000', [{ monto: 16000, comercio: 'Coto' }]],
  ['15.000, para el regalo de mamá, en el coto', [{ monto: 15000 }]],                 // «para» común: no es corrección
  ['no, para 20 mil en el coto', [{ monto: 20000 }]],
  ['quince mil, digo, dieciséis mil en el coto', [{ monto: 16000 }]],
  ['gasté 15.000 en el coto, no, en el jumbo', [{ monto: 15000, comercio: 'Jumbo' }]],
  ['15.000 en el coto, no, en el jumbo, no, en el disco', [{ monto: 15000, comercio: 'Disco' }]],
  ['15.000 en el coto, ah no, era con la visa', [{ monto: 15000, comercio: 'Coto', card: 'v1' }]],
  ['son 500 no 800 en Coto', [{ monto: 800, comercio: 'Coto' }]],
  ['no me equivoqué, son 15.000 en el coto', [{ monto: 15000, comercio: 'Coto' }]],
  ['gasté 15.000 en el coto, no no me equivoqué, está bien', [{ monto: 15000, comercio: 'Coto', descripcion: null }]],

  'Varios movimientos en una frase',
  ['gaste 15.000 con la mercado pago en el kiosco de la esquina comprando cigarros, también otros 12.000 en el chino comprando pasta y arroz',
    [{ monto: 15000, categoria: 'Cigarrillos', cuenta: 'mp' }, { monto: 12000, categoria: 'Supermercado' }]],
  ['pagué 30.000 de luz y después 8.000 de gas ayer', [{ monto: 30000, fecha: hoy }, { monto: 8000, fecha: ayer }]],
  ['ayer gasté 15.000 en el coto y 3.000 en la farmacia', [{ fecha: ayer }, { fecha: ayer, categoria: 'Salud' }]],
  ['15.000 en el kiosco y 12.000 en el chino', [{ monto: 15000 }, { monto: 12000 }]],
  ['15.000 en el coto, 3.000 en la farmacia y 2.000 en el kiosco', [{ monto: 15000 }, { monto: 3000 }, { monto: 2000 }]],
  ['gasté 15.000 en el coto, también 3.000 en la farmacia, además 2.000 en el kiosco', [{ monto: 15000 }, { monto: 3000 }, { monto: 2000 }]],
  ['gasté 15.000 en el coto. También 3.000 en la farmacia.', [{ monto: 15000 }, { monto: 3000 }]],
  ['gaste 15000 en el coto tambien 3000 en la farmacia', [{ monto: 15000 }, { monto: 3000 }]],
  ['cobré 100 mil y gasté 20 mil en el super', [{ monto: 100000, tipo: 'ingreso' }, { monto: 20000, tipo: 'gasto' }]],
  ['15.000 en el coto con la visa en 3 cuotas y 5.000 en la farmacia en efectivo',
    [{ tipo: 'tarjeta', cuotas: 3 }, { tipo: 'gasto', cuenta: 'ef', cuotas: 1 }]],
  ['un café de 3000 y otro de 3500', [{ monto: 3000 }, { monto: 3500, categoria: 'Salidas' }]],
  ['15.000 en el kiosco, también 12.000 en el chino, ah no, 13.000', [{ monto: 15000 }, { monto: 13000 }]],
  ['compré pan y también leche 3000', [{ monto: 3000 }]],   // un solo gasto contado con detalle
  ['40 mil de nafta con la visa en 3 cuotas', [{ monto: 40000, tipo: 'tarjeta', cuotas: 3 }]],
  'Cuotas que ya venías pagando',
  ['pagué un celular de 1,5 millones en 12 cuotas, voy por la cuota 7', [{ monto: 1500000, cuotas: 12, pagadas: 6, tipo: 'tarjeta' }]],
  ['celular 1.500.000 con la visa en 12 cuotas, voy por la 7', [{ monto: 1500000, cuotas: 12, pagadas: 6, card: 'v1' }]],
  ['un celular de un millón y medio, voy por la séptima de doce', [{ monto: 1500000, cuotas: 12, pagadas: 6 }]],
  ['el celular de 1,5 millones en 12, voy por la 7', [{ monto: 1500000, cuotas: 12, pagadas: 6 }]],
  ['la heladera, 900 mil en 6 cuotas, ya pagué 2', [{ monto: 900000, cuotas: 6, pagadas: 2 }]],
  ['la tele en 18 cuotas de 50 mil, me quedan 10', [{ monto: 900000, cuotas: 18, pagadas: 8 }]],
  ['pago 125 mil por mes del celular, voy por la 7 de 12', [{ monto: 1500000, cuotas: 12, pagadas: 6 }]],   // dijo la cuota, no el total
  ['cuota 7 de 12 del celular, 125 mil cada cuota', [{ monto: 1500000, cuotas: 12, pagadas: 6 }]],
  ['estoy en la tercera cuota de 6 de las zapatillas, 300 mil en total con la master', [{ monto: 300000, cuotas: 6, pagadas: 2, card: 'm1' }]],
  ['ya pagué 6 cuotas de 12 del celular, 1,5 millones', [{ monto: 1500000, cuotas: 12, pagadas: 6 }]],
  ['llevo 3 pagadas de 12 del aire acondicionado 1.200.000', [{ monto: 1200000, cuotas: 12, pagadas: 3 }]],
  ['zapatillas 120 mil en 6 cuotas', [{ cuotas: 6, pagadas: 0 }]],                    // compra nueva
  ['ya pagué 2 mil de pan', [{ monto: 2000, pagadas: 0, tipo: 'gasto' }]],            // "ya pagué 2 mil" es plata, no cuotas
  ['el celular de 1,5 millones en 12, voy por la 7, y las zapatillas de 300 mil en 6, voy por la 2',
    [{ monto: 1500000, cuotas: 12, pagadas: 6 }, { monto: 300000, cuotas: 6, pagadas: 1 }]],
]

let fallas = 0
let total = 0
for (const caso of CASOS) {
  if (typeof caso === 'string') { console.log('\n— ' + caso); continue }
  let [frase, esperado] = caso; total++
  resetVoz()
  if (esperado[0] && esperado[0]._aprendido) { aprender(esperado[0]._aprendido); esperado = esperado.map(({ _aprendido, ...e }) => e) }
  global.V = { texto: frase, auto: {}, manual: {}, iaHecho: null, _n: 0 }
  interpretarLocal()
  const vs = movimientos()
  const errores = []
  if (vs.length !== esperado.length) errores.push(`${vs.length} movimientos, esperaba ${esperado.length}`)
  esperado.forEach((e, i) => Object.entries(e).forEach(([k, v]) => {
    if (!vs[i] || vs[i][k] !== v) errores.push(`#${i + 1} ${k}: ${JSON.stringify(vs[i] && vs[i][k])}, esperaba ${JSON.stringify(v)}`)
  }))
  if (errores.length) { fallas++; console.log('✗', frase, '\n   ' + errores.join('\n   ')) }
  else console.log('✓', frase)
}
// el calendario de una compra que venías pagando: la que sigue cae en el próximo resumen
{
  const prox = primeraCuotaMes(hoy, null), plan = planCuotas(12, 6, null, hoy)
  const ok = plan.primera === mesSuma(prox, -6) && plan.proxima === prox && plan.fecha.slice(0, 7) === mesSuma(prox, -7)
    && planCuotas(6, 0, null, hoy).primera === prox && planCuotas(12, 40, null, hoy).pagadas === 12
  total++; if (!ok) { fallas++; console.log('✗ calendario de cuotas', JSON.stringify(plan)) } else console.log('\n✓ calendario: pagadas en sus meses, la 7 en ' + prox)
}
console.log(`\n${total - fallas}/${total} bien`)
process.exit(fallas ? 1 : 0)
