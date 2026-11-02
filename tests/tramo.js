// Saca de index.html el código que está entre /* @prueba:nombre */ y /* @fin:nombre */.
// Las marcas no se mueven aunque se reescriban los comentarios o el código de alrededor,
// así un cambio de formato no rompe las pruebas sin avisar.
module.exports = (html, nombre) => {
  const desde = `/* @prueba:${nombre} */`, hasta = `/* @fin:${nombre} */`
  const i = html.indexOf(desde), j = html.indexOf(hasta, i)
  if (i < 0 || j < 0) throw new Error(`Faltan las marcas ${desde} y ${hasta} en index.html`)
  return html.slice(i + desde.length, j)
}
