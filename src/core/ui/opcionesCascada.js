// Opciones en cascada de la barra de filtros. Vive acá, fuera de FiltrosBar,
// para poder testearla con `npm test` sin React.

/**
 * Calcula, en un solo recorrido de `datos`, las opciones disponibles para
 * cada campo de filtro considerando los DEMÁS filtros activos (cascada).
 * Cada `filtros[key]` es un array de valores seleccionados (multi): una fila
 * pasa el filtro de un campo si ese array está vacío/ausente, o si incluye el
 * valor de la fila para ese campo (unión dentro del campo, intersección entre
 * campos). `campos` es la lista de descriptores { key, field } a calcular;
 * un campo puede traer además `orden`, un comparador `(a, b) => número` sobre
 * sus valores, y entonces sus opciones salen en ese orden (sin él, en orden
 * de texto).
 * `prefiltro` es la condición que ya aplica la pantalla (búsqueda, alertas):
 * si viene, sólo cuentan las filas que la cumplen.
 */
export function opcionesCascada(datos, filtros, campos, prefiltro = null) {
  const base = prefiltro ? datos.filter(prefiltro) : datos
  const activos = campos.filter(c => filtros[c.key]?.length)
  const sets = {}
  for (const c of campos) sets[c.key] = new Set()

  for (const item of base) {
    for (const campo of campos) {
      let ok = true
      for (const act of activos) {
        if (act.key === campo.key) continue
        if (!filtros[act.key].includes(item[act.field])) { ok = false; break }
      }
      if (!ok) continue
      const val = item[campo.field]
      if (val) sets[campo.key].add(val)
    }
  }

  const resultado = {}
  for (const c of campos) resultado[c.key] = ordenarValores([...sets[c.key]], c.orden)
  return resultado
}

/**
 * Las opciones de un filtro más los valores elegidos que la cascada ya no
 * ofrece, para no perder la selección de golpe, ordenadas con el `orden` del
 * campo (o como texto, si no trae). Si no falta ninguno, devuelve las mismas
 * `opciones`.
 */
export function opcionesConElegidos(opciones, valores, orden) {
  const faltantes = valores.filter(v => !opciones.includes(v))
  return faltantes.length ? ordenarValores([...faltantes, ...opciones], orden) : opciones
}

// Ordena en el lugar con el comparador del campo; sin él, `.sort()` de texto,
// el orden de siempre.
function ordenarValores(valores, orden) {
  return orden ? valores.sort(orden) : valores.sort()
}
