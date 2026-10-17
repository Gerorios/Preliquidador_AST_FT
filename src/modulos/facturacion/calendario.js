// El calendario del período del Resumen (Ticket 4 del plan del período en
// curso): la lógica del rango de dos clics, el tope, qué atajo coincide con el
// rango elegido, la grilla de un mes y el movimiento con las flechas. Los días
// van como "AAAA-MM-DD", igual que `desde` y `hasta` de
// GET /api/facturacion/resumen; el que valida el rango es rangoValido
// (periodo.js) y, al final, el backend. No importa React, para que lo cargue
// `node --test`.
//
// Las cuentas de fechas van en UTC, para que no las mueva el huso.

import { textoFecha } from './formulario.js'
import { ATAJOS_RESUMEN, periodoDeAtajo } from './periodo.js'

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

const dosCifras = n => String(n).padStart(2, '0')

const aFecha = dia => {
  const [a, m, d] = dia.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

const aTexto = f => `${f.getUTCFullYear()}-${dosCifras(f.getUTCMonth() + 1)}-${dosCifras(f.getUTCDate())}`

/** Hoy como "AAAA-MM-DD", con la hora local del navegador (`hoy` es un Date). */
export function diaDeHoy(hoy) {
  return `${hoy.getFullYear()}-${dosCifras(hoy.getMonth() + 1)}-${dosCifras(hoy.getDate())}`
}

/** Si un día se puede elegir: hasta el tope incluido (topeDelPeriodo). */
export function diaElegible(dia, tope) {
  return dia <= tope
}

/**
 * El rango marcado después de un clic en `dia`. `marcado` es `{ desde, hasta }`
 * o null. Sin Desde, o con el rango ya completo (un atajo, por ejemplo), el
 * clic arranca otro: Desde y Hasta sin elegir. Con Desde y sin Hasta, el clic
 * es el Hasta y, si es anterior, se dan vuelta. Un día después del tope no
 * cambia nada. El rango está completo cuando tiene Hasta.
 */
export function clicEnDia(marcado, dia, tope) {
  if (!diaElegible(dia, tope)) return marcado
  if (marcado?.desde && !marcado.hasta) {
    return dia < marcado.desde
      ? { desde: dia, hasta: marcado.desde }
      : { desde: marcado.desde, hasta: dia }
  }
  return { desde: dia, hasta: null }
}

/** Los ids de los atajos cuyo rango es de `desde` a `hasta`, en el orden de la barra. */
export function atajosQueCoinciden(desde, hasta, hoy) {
  return ATAJOS_RESUMEN
    .filter(a => {
      const r = periodoDeAtajo(a.id, hoy)
      return r.desde === desde && r.hasta === hasta
    })
    .map(a => a.id)
}

/** El mes de un día, `{ anio, mes }` con el mes de 1 a 12. */
export function mesDeDia(dia) {
  const [anio, mes] = dia.split('-').map(Number)
  return { anio, mes }
}

/** El mes `delta` meses antes o después de `vista`. */
export function mesVecino({ anio, mes }, delta) {
  const indice = anio * 12 + (mes - 1) + delta
  return { anio: Math.floor(indice / 12), mes: (indice % 12) + 1 }
}

/** Si se puede ir al mes siguiente: no más allá del mes del tope. */
export function hayMesSiguiente(vista, tope) {
  const t = mesDeDia(tope)
  return vista.anio * 12 + vista.mes < t.anio * 12 + t.mes
}

/**
 * Las semanas del mes, de lunes a domingo: siete lugares cada una, con el día
 * ("AAAA-MM-DD") o null antes del 1 y después del último.
 */
export function semanasDelMes({ anio, mes }) {
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  // getUTCDay da 0 el domingo: el lunes queda primero.
  const huecos = (new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay() + 6) % 7
  const lugares = Array(huecos).fill(null)
  for (let d = 1; d <= ultimo; d++) lugares.push(`${anio}-${dosCifras(mes)}-${dosCifras(d)}`)
  while (lugares.length % 7) lugares.push(null)
  const semanas = []
  for (let i = 0; i < lugares.length; i += 7) semanas.push(lugares.slice(i, i + 7))
  return semanas
}

/** El día `delta` días antes o después (las flechas: 1 o 7). */
export function moverDia(dia, delta) {
  const f = aFecha(dia)
  f.setUTCDate(f.getUTCDate() + delta)
  return aTexto(f)
}

/** Lo que muestra el campo: "01/10/2026 – 15/10/2026". */
export function textoPeriodo(desde, hasta) {
  const d = textoFecha(desde)
  const h = textoFecha(hasta)
  return d && h ? `${d} – ${h}` : 'Elegí el período'
}

/** El mes a la vista: "Octubre 2026". */
export function tituloMes({ anio, mes }) {
  const nombre = MESES[mes - 1]
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`
}

/** El día para lectores de pantalla: "miércoles 14 de octubre de 2026". */
export function etiquetaDia(dia) {
  const f = aFecha(dia)
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`
}
