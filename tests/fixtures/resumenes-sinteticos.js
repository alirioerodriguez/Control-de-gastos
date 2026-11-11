// Fixtures SINTÉTICOS y ANÓNIMOS de resúmenes de tarjeta: texto con coordenadas, con la forma de lo que
// entrega pdf.js (getTextContent().items: {str, transform:[a,b,c,d,x,y], width}). No hay PDF ni datos reales:
// comercios, importes y fechas están inventados. La disposición de cada banco (orden de columnas, formato de
// fecha, forma de la cuota) sigue lo descrito en la investigación (respuestas/mis-cuentas.md); NO son copias de
// un resumen real, así que hay que contrastarlos con resúmenes propios anonimizados antes de darlos por buenos.
// Para ponerle dificultad al agrupado por Y, cada pedazo se corre hasta ±0,8 unidades y los pedazos van mezclados.

// fila(y, [x, texto], ...)  →  items de pdf.js para una fila de la tabla
const fila = (y, ...pares) => pares.map(([x, str], i) => ({
  str, width: str.length * 5, height: 8,
  transform: [1, 0, 0, 1, x, y + (((i * 7 + Math.round(y)) % 5) - 2) * 0.4],
}))
const pagina = (...filas) => filas.flat().reverse()      // al revés: el orden de entrega no es el de lectura

const GALICIA = pagina(
  fila(780, [40, 'Banco Galicia'], [200, 'RESUMEN DE CUENTA VISA']),
  fila(760, [40, 'CIERRE ACTUAL'], [120, '24 Oct 26'], [260, 'VENCIMIENTO ACTUAL'], [380, '05 Nov 26']),
  fila(740, [40, 'SALDO ANTERIOR'], [400, '150.000,00']),
  fila(725, [40, 'SU PAGO EN PESOS'], [400, '-150.000,00']),
  fila(710, [40, '12-04-26'], [90, '*'], [100, '004512'], [150, 'TIENDA DEMO CELULAR'], [300, 'C.07/12'], [400, '45.833,33']),
  fila(695, [40, '15-10-26'], [100, '004987'], [150, 'SUPER DEMO SUC 12'], [400, '81.230,55']),
  fila(680, [40, '24-10-26'], [150, 'IMPUESTO DE SELLOS'], [400, '1.500,00']),
  fila(660, [40, 'SALDO ACTUAL $'], [400, '128.563,88'], [470, 'PAGO MINIMO $'], [540, '22.000,00']),
)

const SANTANDER = pagina(
  fila(780, [40, 'Santander'], [200, 'Mastercard · Resumen de tarjeta']),
  fila(760, [40, 'Fecha de cierre actual:'], [160, '23/10/2026'], [260, 'Vencimiento actual:'], [380, '04/11/2026']),
  fila(740, [40, 'Saldo anterior'], [420, '90.000,00']),
  fila(725, [40, 'SU PAGO'], [420, '-90.000,00']),
  fila(705, [40, 'Fecha'], [100, 'Comprobante'], [180, 'Detalle'], [330, 'Cuota'], [430, 'Pesos'], [500, 'Dólares']),
  fila(690, [40, '10/07/2026'], [100, '334455'], [180, 'LIBRERIA DEMO SA'], [330, 'Cuota 04/06'], [420, '52.000,00']),
  fila(675, [40, '18/10/2026'], [100, '998877'], [180, 'ESTACION DEMO'], [420, '35.400,00']),
  fila(660, [40, '20/10/2026'], [100, '112233'], [180, 'SERVICIO ONLINE DEMO'], [500, '12,50']),
  fila(640, [40, 'Saldo actual'], [420, '87.400,00']),
)

const BBVA = pagina(
  fila(780, [40, 'BBVA'], [200, 'Resumen de tarjeta VISA']),
  fila(760, [40, 'Cierre actual 22/10/2026'], [260, 'Vencimiento actual 05/11/2026']),
  fila(740, [40, 'SALDO ANTERIOR'], [400, '60.000,00']),
  fila(725, [40, 'SU PAGO'], [400, '-60.000,00']),
  fila(705, [40, '12/04/26'], [100, 'COMERCIO NUEVO'], [300, '07/12'], [400, '45.000,00']),
  fila(690, [40, '15/10/26'], [100, 'FARMACIA DEMO'], [400, '12.300,00']),
  fila(670, [40, 'SALDO ACTUAL'], [400, '57.300,00']),
)

const ICBC = pagina(
  fila(780, [40, 'ICBC'], [200, 'Mastercard · Resumen']),
  fila(760, [40, 'Cierre actual 22-Oct-26'], [260, 'Vencimiento actual 03-Nov-26']),
  fila(740, [40, 'Saldo anterior'], [400, '30.000,00']),
  fila(725, [40, 'SU PAGO'], [400, '-30.000,00']),
  fila(705, [40, '05-Sep-26'], [100, 'TIENDA EXTERIOR DEMO USD 25,00'], [300, 'Cuota 02/03'], [400, '31.250,00']),
  fila(690, [40, '14-Oct-26'], [100, 'CAFE DEMO'], [400, '8.750,00']),
  fila(670, [40, 'Saldo actual'], [400, '40.000,00']),
)

const NARANJA = pagina(
  fila(780, [40, 'Tarjeta Naranja'], [200, 'Resumen de cuenta']),
  fila(760, [40, 'Cierre actual: 21/10/26'], [260, 'Vencimiento actual: 08/11/26']),
  fila(740, [40, 'Saldo anterior'], [400, '20.000,00']),
  fila(725, [40, 'SU PAGO'], [400, '-20.000,00']),
  fila(705, [40, '11/06/26'], [100, 'ZAPATERIA DEMO'], [300, 'Cta. 05/10'], [400, '9.990,00']),
  fila(690, [40, '11/06/26'], [100, 'BONIF. ZAPATERIA DEMO'], [300, 'Cta. 05/10'], [400, '-999,00']),
  fila(675, [40, '20/10/26'], [100, 'INTERESES FINANCIACION'], [400, '2.000,00']),
  fila(655, [40, 'Saldo actual'], [400, '10.991,00'], [470, 'Pago mínimo'], [540, '4.000,00']),
)

// Galicia sin el renglón del sellos (1.500,00): la suma NO cuadra y la app tiene que avisar
const GALICIA_NO_CUADRA = pagina(
  fila(780, [40, 'Banco Galicia'], [200, 'RESUMEN DE CUENTA VISA']),
  fila(760, [40, 'CIERRE ACTUAL'], [120, '24 Oct 26'], [260, 'VENCIMIENTO ACTUAL'], [380, '05 Nov 26']),
  fila(740, [40, 'SALDO ANTERIOR'], [400, '150.000,00']),
  fila(725, [40, 'SU PAGO EN PESOS'], [400, '-150.000,00']),
  fila(710, [40, '12-04-26'], [100, '004512'], [150, 'TIENDA DEMO CELULAR'], [300, 'C.07/12'], [400, '45.833,33']),
  fila(695, [40, '15-10-26'], [100, '004987'], [150, 'SUPER DEMO SUC 12'], [400, '81.230,55']),
  fila(660, [40, 'SALDO ACTUAL $'], [400, '128.563,88']),
)

module.exports = {
  GALICIA, SANTANDER, BBVA, ICBC, NARANJA, GALICIA_NO_CUADRA,
  // lo que tiene que salir de cada uno
  ESPERADO: {
    GALICIA: { emisor: 'Galicia', estado: 'cuadra', cierre: '2026-10-24', vence: '2026-11-05',
      cuotas: [{ descripcion: 'TIENDA DEMO CELULAR', actual: 7, total: 12, monto: 45833.33, fechaCompra: '2026-04-12', fechaEfectiva: '2026-10-24', moneda: 'ARS' }] },
    SANTANDER: { emisor: 'Santander', estado: 'cuadra', cierre: '2026-10-23', vence: '2026-11-04',
      cuotas: [{ descripcion: 'LIBRERIA DEMO SA', actual: 4, total: 6, monto: 52000, fechaCompra: '2026-07-10', fechaEfectiva: '2026-10-23', moneda: 'ARS' }], usd: 12.5 },
    BBVA: { emisor: 'BBVA', estado: 'cuadra', cierre: '2026-10-22', vence: '2026-11-05',
      cuotas: [{ descripcion: 'COMERCIO NUEVO', actual: 7, total: 12, monto: 45000, fechaCompra: '2026-04-12', fechaEfectiva: '2026-10-22', moneda: 'ARS' }] },
    ICBC: { emisor: 'ICBC', estado: 'cuadra', cierre: '2026-10-22', vence: '2026-11-03',
      cuotas: [{ descripcion: 'TIENDA EXTERIOR DEMO USD 25,00', actual: 2, total: 3, monto: 31250, fechaCompra: '2026-09-05', fechaEfectiva: '2026-10-22', moneda: 'ARS' }] },
    NARANJA: { emisor: 'Naranja', estado: 'cuadra', cierre: '2026-10-21', vence: '2026-11-08',
      cuotas: [{ descripcion: 'ZAPATERIA DEMO', actual: 5, total: 10, monto: 9990, fechaCompra: '2026-06-11', fechaEfectiva: '2026-10-21', moneda: 'ARS' }] },
  },
}
