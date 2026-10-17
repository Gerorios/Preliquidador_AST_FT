// El aviso de lo que no entra en el filtro, arriba de una fila del Resumen
// (Ticket 4 de la spec de la E3a por grupo, decisión 7). Una Línea cuenta
// sólo si su período entero cae adentro del filtro; las que caen en parte no
// cuentan, y el aviso nombra sus Comprobantes con el período de esas Líneas y
// ofrece pasar el filtro a ese período. El texto sale del boceto aprobado. No
// importa React, para que lo cargue `node --test`.
//
// La fila es la de GET /api/facturacion/resumen: `desde` y `hasta` son el
// filtro recortado al mes y `comprobantes_fuera` trae `{ id, tipo, numero,
// desde, hasta }` por Comprobante.

import { esMesEntero, nombreDelMes, textoComprobante, textoPeriodo } from './detalle.js'

// En un mes en gris (Antes del corte) no se compara nada: el aviso no diría
// nada útil. Un período en curso sí se compara (plan del 2026-10-17).
const SIN_CONTROL = ['antes_del_corte']

// Cómo se cuenta cada tipo en el título, en singular y en plural. Con tipos
// distintos (o uno que no conoce), "comprobantes".
const CUENTA = {
  factura: ['factura', 'facturas'],
  nota_credito: ['nota de crédito', 'notas de crédito'],
}

const dia = texto => Number(texto.slice(8, 10))

function titulo(comprobantes) {
  const n = comprobantes.length
  const tipos = new Set(comprobantes.map(c => c.tipo))
  const [uno, varios] = tipos.size === 1 ? (CUENTA[[...tipos][0]] ?? ['comprobante', 'comprobantes'])
    : ['comprobante', 'comprobantes']
  return n === 1 ? `1 ${uno} no entra en este filtro` : `${n} ${varios} no entran en este filtro`
}

// Dónde corta el filtro a lo que no entra: "el filtro termina el 10".
function corte(filtro, periodo) {
  const cortaPrincipio = filtro.desde > periodo.desde
  const cortaFin = filtro.hasta < periodo.hasta
  if (cortaFin && !cortaPrincipio) return `el filtro termina el ${dia(filtro.hasta)}`
  if (cortaPrincipio && !cortaFin) return `el filtro empieza el ${dia(filtro.desde)}`
  return `el filtro va del ${dia(filtro.desde)} al ${dia(filtro.hasta)}`
}

// Qué mirar para compararlo: una quincena (decisión 8) o el mes entero.
function queMirar(periodo) {
  if (esMesEntero(periodo)) return 'el mes entero'
  const primera = dia(periodo.desde) === 1 && dia(periodo.hasta) === 15
  // La 2.ª va del 16 al último día: del 1 a ese día sería el mes entero.
  const segunda = dia(periodo.desde) === 16
    && esMesEntero({ desde: `${periodo.desde.slice(0, 8)}01`, hasta: periodo.hasta })
  return primera || segunda ? 'la quincena entera' : 'el período entero'
}

// "compararla" con una o con varias del mismo género; "compararlos" con tipos
// mezclados, que se cuentan como "comprobantes".
function comparar(comprobantes) {
  if (comprobantes.length === 1) return 'compararla'
  const tipos = new Set(comprobantes.map(c => c.tipo))
  return tipos.size === 1 && Object.hasOwn(CUENTA, [...tipos][0]) ? 'compararlas' : 'compararlos'
}

const cubre = c => `${textoComprobante(c)} cubre ${textoPeriodo(c)}`

/**
 * El aviso de la fila, `{ titulo, comprobantes, texto, boton }`, o null si no
 * lleva (nada afuera, o un mes en gris). Con un solo Comprobante, `texto` lo
 * nombra y `comprobantes` va vacía; con varios, `comprobantes` trae una línea
 * por cada uno y `texto` dice dónde corta el filtro. `boton` es `{ texto,
 * desde, hasta }`: el período de todas las Líneas que no entran, para pasar el
 * filtro ahí.
 */
export function avisoFueraDelFiltro(fila) {
  const lista = fila?.comprobantes_fuera ?? []
  if (!lista.length || SIN_CONTROL.some(e => fila.estados?.includes(e))) return null

  const desde = lista.map(c => c.desde).reduce((a, b) => (b < a ? b : a))
  const hasta = lista.map(c => c.hasta).reduce((a, b) => (b > a ? b : a))
  const periodo = { desde, hasta }
  const donde = corte(fila, periodo)
  const mirar = `Para ${comparar(lista)}, mirá ${queMirar(periodo)}.`
  const boton = {
    texto: esMesEntero(periodo) ? `Ver ${nombreDelMes(desde)} entero` : `Ver ${textoPeriodo(periodo)}`,
    desde,
    hasta,
  }

  if (lista.length === 1) {
    return { titulo: titulo(lista), comprobantes: [], texto: `La ${cubre(lista[0])}, y ${donde}. ${mirar}`, boton }
  }
  const mayuscula = donde[0].toUpperCase() + donde.slice(1)
  return { titulo: titulo(lista), comprobantes: lista.map(cubre), texto: `${mayuscula}. ${mirar}`, boton }
}
