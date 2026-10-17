// Estados del mes en el Resumen (plan E3, FA2): cómo se muestra cada clave de
// `estados` de una fila de GET /api/facturacion/resumen (plan E3, sección 3.2,
// ruta 13), cuál es la más urgente y a dónde llevan el botón de la fila y cada
// etiqueta. No importa React, para que lo cargue `node --test`.
//
// Una fila puede traer varios estados (Con diferencia y Falta comprobante, o
// Mes en curso y Falta comprobante); se muestran todos y el botón de la fila
// sigue al más urgente. El backend ya los manda ordenados, pero la urgencia se
// toma de `orden`, para no depender de eso.
//
// El permiso llega como un booleano, como `editable` de las páginas del
// módulo: quien llama pasa `puedeEditar(usuario, 'facturacion', 'comprobantes')`.

// Etiqueta, badge (clase de src/index.css) y orden de urgencia de cada clave,
// tomados de la tabla del mockup aprobado del Resumen: 0 es lo más urgente.
// Una Facturada con `diferencia_revisada` sigue siendo Facturada. Sin comparar
// en este período (Ticket 4 de la spec de la E3a por grupo: nada de la fila
// entra entero en el filtro) va en el lugar que le da el backend, entre Falta
// comprobante y Facturada, y no lleva a ningún lado: el aviso de la fila dice
// qué período mirar.
export const ESTADOS = {
  pendiente_de_facturar: { etiqueta: 'Pendiente de facturar', badge: 'badge-danger', orden: 0 },
  con_diferencia: { etiqueta: 'Con diferencia', badge: 'badge-warn', orden: 1 },
  falta_comprobante: { etiqueta: 'Falta comprobante', badge: 'badge-info', orden: 2 },
  sin_comparar: { etiqueta: 'Sin comparar en este período', badge: 'badge-muted', orden: 3 },
  facturada: { etiqueta: 'Facturada', badge: 'badge-green', orden: 4 },
  mes_en_curso: { etiqueta: 'Mes en curso', badge: 'badge-muted', orden: 5 },
  antes_del_corte: { etiqueta: 'Antes del corte', badge: 'badge-muted', orden: 6 },
}

/**
 * La clave más urgente de `estados` (la de menor `orden`). Las claves que no
 * están en ESTADOS no cuentan; sin ninguna conocida, null.
 */
export function estadoMasUrgente(estados) {
  let masUrgente = null
  for (const clave of estados ?? []) {
    if (!Object.hasOwn(ESTADOS, clave)) continue
    if (masUrgente == null || ESTADOS[clave].orden < ESTADOS[masUrgente].orden) masUrgente = clave
  }
  return masUrgente
}

/**
 * El Detalle de la fila: /facturacion/resumen/{cliente_id}/{mes}, con el
 * filtro de la fila (el del Resumen recortado al mes) como `?desde=&hasta=`,
 * para que el Detalle muestre el mismo período. Sin los dos, el mes entero.
 */
export function rutaDelDetalle(fila) {
  const ruta = `/facturacion/resumen/${fila.cliente_id}/${fila.mes}`
  if (!fila.desde || !fila.hasta) return ruta
  return `${ruta}?${new URLSearchParams({ desde: fila.desde, hasta: fila.hasta })}`
}

// El alta de una Factura con el Cliente y el mes de la fila. En la E3a abre
// el formulario de la E2; en la E3b, la Precarga.
function rutaDeCargarFactura(fila) {
  const query = new URLSearchParams({ tipo: 'factura', cliente: String(fila.cliente_id), mes: fila.mes })
  return `/facturacion/comprobantes/nuevo?${query}`
}

// El primer Comprobante sin Adjunto de la fila, o null si la lista viene vacía.
function rutaDelPrimeroSinAdjunto(fila) {
  const primero = fila.comprobantes_sin_adjunto?.[0]
  return primero ? `/facturacion/comprobantes/${primero.id}` : null
}

// A dónde lleva cada estado que tiene a dónde llevar. Cargar una factura y
// adjuntar un PDF piden Editar en `comprobantes`; sin ese permiso, null.
const DESTINOS = {
  pendiente_de_facturar: (fila, puedeEditarComprobantes) =>
    puedeEditarComprobantes ? rutaDeCargarFactura(fila) : null,
  con_diferencia: fila => rutaDelDetalle(fila),
  falta_comprobante: (fila, puedeEditarComprobantes) =>
    puedeEditarComprobantes ? rutaDelPrimeroSinAdjunto(fila) : null,
}

const TEXTO_DE_ACCION = {
  pendiente_de_facturar: 'Cargar factura',
  con_diferencia: 'Ver diferencia',
  falta_comprobante: 'Adjuntar PDF',
}

/**
 * El botón de la fila, `{ texto, destino, primaria }`, según su estado más
 * urgente: "Cargar factura", "Ver diferencia" o "Adjuntar PDF", como botón
 * principal. Si el estado no pide nada, o pide Editar en `comprobantes` y no
 * se tiene, "Ver detalle", también en Antes del corte y en Mes en curso.
 */
export function accionDeFila(fila, puedeEditarComprobantes) {
  const clave = estadoMasUrgente(fila.estados)
  const destino = destinoDeEtiqueta(clave, fila, puedeEditarComprobantes)
  if (destino) return { texto: TEXTO_DE_ACCION[clave], destino, primaria: true }
  return { texto: 'Ver detalle', destino: rutaDelDetalle(fila), primaria: false }
}

/**
 * A dónde lleva la etiqueta de un estado de la fila, o null si va como texto.
 * Pendiente de facturar y Falta comprobante son link sólo con Editar en
 * `comprobantes`; Con diferencia, siempre; Facturada, Mes en curso y Antes
 * del corte, nunca.
 */
export function destinoDeEtiqueta(clave, fila, puedeEditarComprobantes) {
  if (!Object.hasOwn(DESTINOS, clave ?? '')) return null
  return DESTINOS[clave](fila, puedeEditarComprobantes)
}

/**
 * El texto de la etiqueta de un estado en la fila. Con diferencia dice cuántas
 * líneas (grupo, unidad) superan el Umbral, "Con diferencia · 2 líneas
 * superan": cuenta líneas, no grupos (decisión 2 de la spec de la E3a por
 * grupo). Sin `lineas_superan`, y en los demás estados, la etiqueta sola. Una
 * clave que no es de ESTADOS, null.
 */
export function textoDeEstado(clave, fila) {
  if (!Object.hasOwn(ESTADOS, clave ?? '')) return null
  const { etiqueta } = ESTADOS[clave]
  const n = fila?.lineas_superan
  if (clave !== 'con_diferencia' || !Number.isInteger(n) || n < 1) return etiqueta
  return `${etiqueta} · ${n} ${n === 1 ? 'línea supera' : 'líneas superan'}`
}
