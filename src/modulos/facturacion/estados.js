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
// Una Facturada con `diferencia_revisada` sigue siendo Facturada.
export const ESTADOS = {
  pendiente_de_facturar: { etiqueta: 'Pendiente de facturar', badge: 'badge-danger', orden: 0 },
  con_diferencia: { etiqueta: 'Con diferencia', badge: 'badge-warn', orden: 1 },
  falta_comprobante: { etiqueta: 'Falta comprobante', badge: 'badge-info', orden: 2 },
  facturada: { etiqueta: 'Facturada', badge: 'badge-green', orden: 3 },
  mes_en_curso: { etiqueta: 'Mes en curso', badge: 'badge-muted', orden: 4 },
  antes_del_corte: { etiqueta: 'Antes del corte', badge: 'badge-muted', orden: 5 },
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

/** El Detalle de la fila: /facturacion/resumen/{cliente_id}/{mes}. */
export const rutaDelDetalle = fila => `/facturacion/resumen/${fila.cliente_id}/${fila.mes}`

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
