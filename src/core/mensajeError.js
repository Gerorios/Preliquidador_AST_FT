// Texto para el usuario a partir del `detail` de una respuesta de error del
// backend. Llega en tres formas: texto (lo normal), objeto {tipo, mensaje, ...}
// (el 409 de solapamiento) o lista de errores de validación (el 422 de
// FastAPI, cada uno con su `msg`). Devuelve null si no hay nada que mostrar.
export function mensajeDeError(detail) {
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => String(d?.msg ?? '').replace(/^Value error, /, ''))
      .filter(Boolean)
    return msgs.length ? msgs.join('; ') : null
  }
  if (detail && typeof detail === 'object') return detail.mensaje || null
  return detail || null
}
