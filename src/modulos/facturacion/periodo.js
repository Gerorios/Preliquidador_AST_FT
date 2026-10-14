// Períodos del Resumen (plan E3, FA1): los atajos de la barra y el control del
// rango antes de pedirlo. Los meses van como "AAAA-MM", igual que `desde` y
// `hasta` de GET /api/facturacion/resumen; el que manda es el backend, que
// responde 422 `rango_invalido` (plan E3, decisión 6). No importa React, para
// que lo cargue `node --test`.
//
// `hoy` es un Date y se lee con la hora local del navegador. Quien la llama
// pasa `new Date()`; los tests lo fijan.

// Hasta cuántos meses pide el Resumen, contando los dos extremos. Es el mismo
// número que `MESES_MAXIMOS` de `config.py` del backend.
export const MESES_MAXIMOS = 12

// Los atajos, en el orden de la barra (pantallas.md, Resumen). "Otro período"
// no es un atajo: es elegir desde y hasta a mano.
export const ATAJOS_RESUMEN = [
  { id: 'mes_pasado', label: 'Mes pasado' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'ultimos_3', label: 'Últimos 3 meses' },
  { id: 'este_anio', label: 'Este año' },
]

// El Resumen arranca en el mes pasado (pantallas.md y plan E3, decisión 6).
export const ATAJO_INICIAL = 'mes_pasado'

// Un mes como un número que crece con la fecha: año * 12 + (mes - 1).
const indiceDeHoy = hoy => hoy.getFullYear() * 12 + hoy.getMonth()

function indiceDeTexto(texto) {
  const partes = /^(\d{4})-(\d{2})$/.exec(texto ?? '')
  if (!partes) return null
  const mes = Number(partes[2])
  if (mes < 1 || mes > 12) return null
  return Number(partes[1]) * 12 + mes - 1
}

function textoDeIndice(indice) {
  const anio = Math.floor(indice / 12)
  const mes = (indice % 12) + 1
  return `${anio}-${String(mes).padStart(2, '0')}`
}

// De dónde a dónde va cada atajo, contado en meses desde el mes en curso.
// "Últimos 3 meses" son los tres cerrados, sin el mes en curso, como en el
// mockup aprobado del Resumen; "Este año" va de enero al mes en curso.
const RANGOS = {
  mes_pasado: actual => [actual - 1, actual - 1],
  este_mes: actual => [actual, actual],
  ultimos_3: actual => [actual - 3, actual - 1],
  este_anio: actual => [actual - (actual % 12), actual],
}

/**
 * El período de un atajo como `{ desde, hasta }` en "AAAA-MM", con los dos
 * meses incluidos. Un atajo que no existe da null.
 */
export function periodoDeAtajo(id, hoy) {
  const rango = RANGOS[id]
  if (!rango) return null
  const [desde, hasta] = rango(indiceDeHoy(hoy))
  return { desde: textoDeIndice(desde), hasta: textoDeIndice(hasta) }
}

/**
 * Si el Resumen puede pedir de `desde` a `hasta` ("AAAA-MM"): los dos bien
 * escritos, hasta no antes de desde, no más de MESES_MAXIMOS meses y hasta no
 * después del mes en curso.
 */
export function rangoValido(desde, hasta, hoy) {
  const d = indiceDeTexto(desde)
  const h = indiceDeTexto(hasta)
  if (d == null || h == null) return false
  if (h < d) return false
  if (h - d + 1 > MESES_MAXIMOS) return false
  return h <= indiceDeHoy(hoy)
}
