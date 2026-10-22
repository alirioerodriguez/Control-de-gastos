// Pruebas de la lectura del QR de la factura electrónica (ARCA, RG 4892/2020).
// Saca datosQRFactura de index.html, así prueba lo mismo que corre en la app.
// Uso:  node tests/factura.test.js
const fs = require('fs')
const path = require('path')
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
const tramo = (desde, hasta) => { const i = html.indexOf(desde); return html.slice(i, html.indexOf(hasta, i)) }
global.round2 = (n) => Math.round(((Number(n) || 0) + Number.EPSILON) * 100) / 100
eval(tramo('const TIPO_CMP=', 'let _jsQR=null;') + html.match(/const esQRDelComercio=.*\n/)[0] + ';global.datosQRFactura=datosQRFactura;global.esQRDelComercio=esQRDelComercio;')

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
const base = { ver: 1, fecha: '2026-10-15', cuit: 30500000001, ptoVta: 4, tipoCmp: 6, nroCmp: 1532, importe: 33250.5,
  moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: 76123456789012 }
const CASOS = [
  ['Factura B, dominio nuevo de ARCA', 'https://www.arca.gob.ar/fe/qr/?p=' + b64(base), { importe: 33250.5, fecha: '2026-10-15', tipoTxt: 'Factura B', credito: false }],
  ['Factura A, dominio viejo de AFIP', 'https://www.afip.gob.ar/fe/qr/?p=' + b64({ ...base, tipoCmp: 1, importe: 101500 }), { importe: 101500, tipoTxt: 'Factura A' }],
  ['Factura C', 'https://www.arca.gob.ar/fe/qr/?p=' + b64({ ...base, tipoCmp: 11, importe: 45000 }), { tipoTxt: 'Factura C', importe: 45000 }],
  ['Nota de crédito B: plata que vuelve', 'https://www.arca.gob.ar/fe/qr/?p=' + b64({ ...base, tipoCmp: 8 }), { credito: true, tipoTxt: 'Nota de crédito B' }],
  ['Factura E en dólares', 'https://www.arca.gob.ar/fe/qr/?p=' + b64({ ...base, tipoCmp: 19, importe: 120, moneda: 'DOL', ctz: 1250 }), { moneda: 'DOL', importe: 120 }],
  ['Base64 "URL-safe" sin relleno', 'https://www.arca.gob.ar/fe/qr/?p=' + b64({ ...base, importe: 999.99 }).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), { importe: 999.99 }],
  ['Base64 con %3D (escapado en la URL)', 'https://www.arca.gob.ar/fe/qr/?p=' + encodeURIComponent(b64(base)), { importe: 33250.5 }],
  ['QR de otra cosa (Mercado Pago)', 'https://mpago.la/2ABcd3', null],
  ['QR de ARCA roto', 'https://www.arca.gob.ar/fe/qr/?p=no-es-base64!!', null],
  ['QR sin importe', 'https://www.arca.gob.ar/fe/qr/?p=' + b64({ ...base, importe: 0 }), null],
]
let fallas = 0
// el QR "Data Fiscal" de los tiques de impresora fiscal identifica al comercio y no trae el monto
for (const [nombre, texto, esperado] of [
  ['QR del comercio (Data Fiscal) de un tique de súper', 'https://servicios1.afip.gov.ar/clavefiscal/qr/response.aspx?qr=Kb30548083156xQ7', true],
  ['QR de factura electrónica: no es el del comercio', 'https://www.arca.gob.ar/fe/qr/?p=' + b64(base), false],
  ['QR de Mercado Pago: no es de ARCA', 'https://mpago.la/2ABcd3', false],
]) {
  const ok = esQRDelComercio(texto) === esperado && (!esperado || datosQRFactura(texto) === null)
  if (!ok) fallas++
  console.log(ok ? '✓' : '✗', nombre)
}
for (const [nombre, texto, esperado] of CASOS) {
  const r = datosQRFactura(texto)
  const ok = esperado === null ? r === null : r && Object.entries(esperado).every(([k, v]) => r[k] === v)
  if (!ok) fallas++
  console.log(ok ? '✓' : '✗', nombre, ok ? '' : JSON.stringify(r))
}
console.log(`\n${CASOS.length + 3 - fallas}/${CASOS.length + 3} bien`)
process.exit(fallas ? 1 : 0)
