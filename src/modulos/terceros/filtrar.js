// Cómo filtran todas las pantallas del módulo.
//
// Está acá y no copiado en cada una porque la regla que importa es sutil y se
// pierde al reescribirla: **las opciones de un filtro salen de lo que queda al
// aplicar los OTROS**. Elegido un tercero, el desplegable de finca ofrece sus
// fincas y no las del maestro entero. Sin eso, el liquidador elige un valor que
// no devuelve ninguna fila y no entiende por qué.
//
// Cada filtro guarda un Set. Vacío significa "todos", que es la lectura natural
// de un filtro recién abierto.

export const pasaFiltros = (fila, claves, filtros, salvo) =>
  claves.every(c => c === salvo || !filtros[c]?.size || filtros[c].has(fila[c]))

/**
 * Los valores que cada filtro puede ofrecer.
 *
 * `minimo` es cuántos valores distintos tiene que haber para que valga la pena
 * mostrar el filtro. Filtrando alcanza con 2 —uno solo no acota nada—, pero al
 * cargar una tarifa hace falta poder elegir aunque haya uno solo.
 */
export function opcionesCascada(filas, claves, filtros, minimo = 2) {
  const salida = {}
  for (const clave of claves) {
    const valores = [...new Set(
      filas.filter(f => pasaFiltros(f, claves, filtros, clave))
           .map(f => f[clave])
           .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, 'es'))
    if (valores.length >= minimo || filtros[clave]?.size) salida[clave] = valores
  }
  return salida
}
