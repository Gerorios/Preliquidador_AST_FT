// Períodos del Resumen (plan E3, FA1, y Ticket 4 de la spec de la E3a por
// grupo: el filtro por día): los atajos de la barra y el control del rango
// antes de pedirlo. Los días van como "AAAA-MM-DD", igual que `desde` y
// `hasta` de GET /api/facturacion/resumen; el que manda es el backend, que
// responde 422 `fecha_invalida` o `rango_invalido`. No importa React, para que
// lo cargue `node --test`.
//
// `hoy` es un Date y se lee con la hora local del navegador. Quien la llama
// pasa `new Date()`; los tests lo fijan.

// Hasta cuántos meses toca el Resumen, contando los dos extremos. Es el mismo
// número que `MESES_MAXIMOS` de `config.py` del backend.
export const MESES_MAXIMOS = 12

// Los atajos, en el orden de la barra (decisión 6 de la spec). "Otro período"
// no es un atajo: es elegir desde y hasta a mano.
export const ATAJOS_RESUMEN = [
  { id: 'quincena_pasada', label: 'Quincena pasada' },
  { id: 'esta_quincena', label: 'Esta quincena' },
  { id: 'mes_pasado', label: 'Mes pasado' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'ultimos_3', label: 'Últimos 3 meses' },
  { id: 'este_anio', label: 'Este año' },
]

// El Resumen arranca en el mes pasado (decisión 6 de la spec).
export const ATAJO_INICIAL = 'mes_pasado'

// La 1.ª quincena va del 1 al 15; la 2.ª, del 16 a fin de mes (decisión 8).
const FIN_PRIMERA = 15

const dosCifras = n => String(n).padStart(2, '0')

// Un mes como un número que crece con la fecha: año * 12 + (mes - 1).
const indiceDeHoy = hoy => hoy.getFullYear() * 12 + hoy.getMonth()

// El último día de un mes (por su índice). El día 0 del mes siguiente es el
// último de este; en UTC, para que no lo mueva el huso.
const ultimoDia = indice => new Date(Date.UTC(Math.floor(indice / 12), (indice % 12) + 1, 0)).getUTCDate()

function textoDia(indice, dia) {
  return `${Math.floor(indice / 12)}-${dosCifras((indice % 12) + 1)}-${dosCifras(dia)}`
}

const primero = indice => textoDia(indice, 1)
const ultimo = indice => textoDia(indice, ultimoDia(indice))

// "AAAA-MM-DD" a { indice, dia }, o null si no está bien escrito o no existe.
function leerDia(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto ?? '')
  if (!partes) return null
  const mes = Number(partes[2])
  if (mes < 1 || mes > 12) return null
  const indice = Number(partes[1]) * 12 + mes - 1
  const dia = Number(partes[3])
  if (dia < 1 || dia > ultimoDia(indice)) return null
  return { indice, dia }
}

// Una quincena como `{ desde, hasta }`: la 1.ª o la 2.ª del mes `indice`.
const quincena = (indice, segunda) => (segunda
  ? { desde: textoDia(indice, FIN_PRIMERA + 1), hasta: ultimo(indice) }
  : { desde: primero(indice), hasta: textoDia(indice, FIN_PRIMERA) })

const meses = (desde, hasta) => ({ desde: primero(desde), hasta: ultimo(hasta) })

// De dónde a dónde va cada atajo. "Últimos 3 meses" son los tres cerrados, sin
// el mes en curso, como en el mockup aprobado del Resumen; "Este año" va del 1
// de enero al fin del mes en curso. Las quincenas van enteras, como las cubren
// los Comprobantes.
const RANGOS = {
  quincena_pasada: (actual, dia) => (dia > FIN_PRIMERA ? quincena(actual, false) : quincena(actual - 1, true)),
  esta_quincena: (actual, dia) => quincena(actual, dia > FIN_PRIMERA),
  mes_pasado: actual => meses(actual - 1, actual - 1),
  este_mes: actual => meses(actual, actual),
  ultimos_3: actual => meses(actual - 3, actual - 1),
  este_anio: actual => meses(actual - (actual % 12), actual),
}

/**
 * El período de un atajo como `{ desde, hasta }` en "AAAA-MM-DD", con los dos
 * días incluidos. Un atajo que no existe da null.
 */
export function periodoDeAtajo(id, hoy) {
  const rango = Object.hasOwn(RANGOS, id ?? '') ? RANGOS[id] : null
  return rango ? rango(indiceDeHoy(hoy), hoy.getDate()) : null
}

/** El último día que se puede pedir, "AAAA-MM-DD": el fin del mes en curso. */
export function topeDelPeriodo(hoy) {
  return ultimo(indiceDeHoy(hoy))
}

/**
 * Si el Resumen puede pedir de `desde` a `hasta` ("AAAA-MM-DD"): los dos días
 * bien escritos y existentes, hasta no antes de desde, no más de MESES_MAXIMOS
 * meses tocados y hasta no después del fin del mes en curso. Las mismas reglas
 * que el backend.
 */
export function rangoValido(desde, hasta, hoy) {
  const d = leerDia(desde)
  const h = leerDia(hasta)
  if (!d || !h) return false
  if (h.indice < d.indice || (h.indice === d.indice && h.dia < d.dia)) return false
  if (h.indice - d.indice + 1 > MESES_MAXIMOS) return false
  return h.indice <= indiceDeHoy(hoy)
}
