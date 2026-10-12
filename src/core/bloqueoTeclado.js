/**
 * Qué teclas se tragan mientras el cartel de "Procesando" tapa la pantalla.
 *
 * El cartel frena el mouse, pero no el teclado: con Tab y Enter se podía volver a
 * apretar lo que quedó debajo y guardar dos veces. Se traga toda tecla suelta;
 * quedan vivos los atajos del navegador (con Ctrl, Cmd o Alt, y las F), para que
 * se pueda recargar o copiar aunque una escritura quede colgada.
 */
export function debeTragar(evento) {
  if (evento.ctrlKey || evento.metaKey || evento.altKey) return false
  if (/^F\d{1,2}$/.test(evento.key)) return false
  return true
}
