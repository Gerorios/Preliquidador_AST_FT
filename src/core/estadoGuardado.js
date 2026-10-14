// Parte pura del estado guardado por pantalla (`estadoPantallas.js`). Vive acá,
// sin React ni zustand, para poder testearla con `npm test`.

/**
 * Valor nuevo de una clave guardada, como el setter de useState: `nuevo` puede
 * ser el valor o una función del valor anterior. Si todavía no hay nada
 * guardado (`previo === undefined`), la función recibe `inicial`; un `null`
 * guardado es un valor y no cae al inicial.
 */
export function resolverValor(previo, inicial, nuevo) {
  if (typeof nuevo !== 'function') return nuevo
  return nuevo(previo === undefined ? inicial : previo)
}

/**
 * Llama a `limpiar` cada vez que cambia el token de `authStore` y devuelve la
 * desuscripción. Se limpia en cualquier cambio de token, no sólo al pasar a
 * null: /login se puede abrir con la sesión abierta y `login()` cambia el token
 * de una persona por el de otra sin pasar por null, y quien entra no tiene que
 * ver los filtros de la anterior. Un cambio del store que no toca el token no
 * limpia.
 */
export function conectarCierreDeSesion(authStore, limpiar) {
  let tokenAnterior = authStore.getState().token
  return authStore.subscribe(estado => {
    if (estado.token === tokenAnterior) return
    tokenAnterior = estado.token
    limpiar()
  })
}
