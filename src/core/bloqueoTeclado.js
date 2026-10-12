/**
 * Qué teclas se tragan mientras el cartel de "Procesando" tapa la pantalla.
 *
 * El cartel frena el mouse, pero no el teclado: con Tab y Enter se podía volver a
 * apretar lo que quedó debajo y guardar dos veces. Se traga todo salvo una lista
 * blanca de atajos del navegador (recargar, copiar, buscar, herramientas), para
 * que se pueda recargar aunque una escritura quede colgada. Es lista blanca y no
 * negra porque hay teclas con modificador que también cambian datos: F4 y
 * Alt+Flecha abajo abren la lista de un select, Ctrl+V pega y AltGr (que en
 * Windows llega como Ctrl+Alt) escribe.
 */
const TECLAS_LIBRES = new Set(['F5', 'F12'])
const LETRAS_CON_CTRL = new Set(['r', 'c', 'f'])

export function debeTragar(evento) {
  if (TECLAS_LIBRES.has(evento.key)) return false
  const conCtrl = (evento.ctrlKey || evento.metaKey) && !evento.altKey
  if (conCtrl && LETRAS_CON_CTRL.has((evento.key || '').toLowerCase())) return false
  return true
}
