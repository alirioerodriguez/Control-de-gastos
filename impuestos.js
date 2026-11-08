// Impuestos de pagar en dólares desde Argentina: suscripciones, juegos y compras del exterior con tarjeta, y
// paquetes que entran por courier o por correo. Funciones puras, sin pantalla. Es una estimación: el banco y la
// Aduana tienen la última palabra.
//
// Fuentes (revisadas el 08/11/2026):
//  - IVA 21 % a servicios digitales del exterior, cobrado por el banco: RG 4240 (AFIP/ARCA).
//  - Percepción del 30 % a cuenta de Ganancias o Bienes Personales en compras y servicios del exterior pagados
//    en pesos: RG 5617/2024. La RG 5672/2025 solo la sacó de la compra de dólares para ahorro; sigue para
//    consumos (El Cronista, 16/09/2026, con datos de ARCA de enero a julio de 2026). No aplica si se paga con
//    dólares propios, ni a salud, medicamentos, libros y plataformas o software educativo.
//  - Ingresos Brutos: lo cobra cada provincia y el porcentaje cambia; se deja editable (CABA y Buenos Aires
//    suelen figurar con 2 %, sin verificar contra la norma de cada una).
//  - Envíos: Decreto 604/2026 y RG ARCA 5884/2026 (B. O. 30/07/2026): franquicia de USD 400 FOB por envío
//    pagando solo IVA, 5 envíos por año, tope de USD 3.000; lo que pasa de USD 400 paga el arancel del producto
//    y la tasa de estadística del 3 %, además del IVA.
// Uso en el navegador: <script src="impuestos.js"></script> → window.Impuestos. En node: require('./impuestos.js').
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory()
  else root.Impuestos = factory()
})(typeof self !== 'undefined' ? self : this, function () {
  const IVA = 0.21
  const PERCEPCION = 0.30
  const FRANQUICIA_USD = 400
  const TOPE_ENVIO_USD = 3000
  const ESTADISTICA = 0.03
  const r2 = (n) => Math.round(n * 100) / 100
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)

  /**
   * Pago con tarjeta de algo del exterior.
   * tipo: 'digital' (streaming, juegos, apps, nube), 'exterior' (compras y servicios en el exterior que no son
   * digitales) o 'excluido' (salud, medicamentos, libros, educación).
   * conDolares: se paga con dólares propios (cuenta en dólares o stop debit), así no hay percepción del 30 %.
   */
  function pagoConTarjeta({ precioUsd, dolar, tipo = 'digital', iibbPct = 0, conDolares = false }) {
    const usd = num(precioUsd), tc = num(dolar)
    const pesos = usd * tc
    const lineas = []
    const sumar = (nombre, tasa, aclaracion) => { if (tasa > 0) lineas.push({ nombre, pesos: r2(pesos * tasa), aclaracion }) }
    if (tipo === 'digital') sumar('IVA 21 %', IVA, 'Servicios digitales del exterior (RG 4240)')
    if (!conDolares && tipo !== 'excluido') sumar('Percepción 30 %', PERCEPCION, 'A cuenta de Ganancias o Bienes Personales; se descuenta o se pide la devolución (RG 5617)')
    if (tipo === 'digital') sumar(`Ingresos Brutos ${num(iibbPct)} %`, num(iibbPct) / 100, 'Depende de tu provincia')
    const impuestos = r2(lineas.reduce((t, l) => t + l.pesos, 0))
    const total = r2(pesos + impuestos)
    return {
      precioPesos: r2(pesos), lineas, impuestos, total,
      // lo que termina valiendo cada dólar del precio
      dolarFinal: usd > 0 ? r2(total / usd) : 0,
      recargoPct: pesos > 0 ? r2((impuestos / pesos) * 100) : 0,
    }
  }

  /**
   * Paquete que entra por courier o por correo (régimen único desde julio de 2026).
   * fobUsd: valor de la mercadería; fleteUsd: envío; arancelPct: derecho de importación del producto (depende de su
   * posición arancelaria, 0 si no se sabe); pagadoConTarjetaEnPesos: la compra misma lleva la percepción del 30 %.
   */
  function envio({ fobUsd, fleteUsd = 0, dolar, arancelPct = 0, pagadoConTarjetaEnPesos = true }) {
    const fob = num(fobUsd), flete = num(fleteUsd), tc = num(dolar)
    const excedente = Math.max(0, fob - FRANQUICIA_USD)
    const lineasUsd = []
    const sumar = (nombre, usd, aclaracion) => { if (usd > 0) lineasUsd.push({ nombre, usd: r2(usd), aclaracion }) }
    sumar('IVA 21 %', (fob + flete) * IVA, 'Compra + envío (estimado)')
    sumar(`Arancel ${num(arancelPct)} %`, excedente * (num(arancelPct) / 100), 'Sobre lo que pasa de USD 400; depende del producto')
    sumar('Estadística 3 %', excedente * ESTADISTICA, 'Sobre lo que pasa de USD 400')
    const aduanaUsd = r2(lineasUsd.reduce((t, l) => t + l.usd, 0))
    const percepcion = pagadoConTarjetaEnPesos ? r2((fob + flete) * tc * PERCEPCION) : 0
    const compraPesos = r2((fob + flete) * tc)
    const aduanaPesos = r2(aduanaUsd * tc)
    return {
      excedenteUsd: r2(excedente),
      dentroDeFranquicia: excedente === 0,
      fueraDeRegimen: fob > TOPE_ENVIO_USD,
      lineasUsd, aduanaUsd, aduanaPesos, compraPesos, percepcion,
      total: r2(compraPesos + aduanaPesos + percepcion),
    }
  }

  return { pagoConTarjeta, envio, IVA, PERCEPCION, FRANQUICIA_USD, TOPE_ENVIO_USD, ESTADISTICA }
})
