// Orden de las tablas de Verificación por cualquier columna. `columnas` trae,
// por cada clave, cómo leer el valor de una fila (`valor`). Los números se
// comparan como números y el resto como texto en español; lo vacío va siempre
// al final, en los dos sentidos. Sin orden elegido, las filas quedan como
// vinieron.

const vacio = v => v === null || v === undefined || v === ''

export function ordenarFilas(filas, columnas, orden) {
  if (!orden) return filas
  const col = columnas.find(c => c.clave === orden.clave)
  if (!col) return filas
  const signo = orden.dir === 'desc' ? -1 : 1
  return [...filas].sort((a, b) => {
    const va = col.valor(a)
    const vb = col.valor(b)
    if (vacio(va) && vacio(vb)) return 0
    if (vacio(va)) return 1
    if (vacio(vb)) return -1
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * signo
    return String(va).localeCompare(String(vb), 'es', { numeric: true }) * signo
  })
}

// Click en un encabezado: la primera vez ordena de mayor a menor si la
// columna es numérica (lo que se busca en un control es lo más alto) y de A a
// Z si es texto; la segunda invierte; la tercera vuelve al orden original.
export function siguienteOrden(orden, clave, numerica) {
  const primera = numerica ? 'desc' : 'asc'
  const segunda = numerica ? 'asc' : 'desc'
  if (orden?.clave !== clave) return { clave, dir: primera }
  if (orden.dir === primera) return { clave, dir: segunda }
  return null
}
