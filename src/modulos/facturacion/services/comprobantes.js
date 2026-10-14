import api from '../../../core/api'

// Módulo Facturación — etapa 2: los Comprobantes (Facturas y Notas de crédito)
// y las lecturas del campo y de sueldos que necesita su alta.
// Todas las rutas son de la pantalla `comprobantes` del backend
// (app/modulos/facturacion/api/comprobantes.py); el contrato está en el plan
// 2026-10-11-facturacion-e2.md, sección 3.2, del repo backend.
//
// Los decimales viajan como texto con punto decimal: el formato argentino lo
// convierte `leerNumero` (numeros.js) antes de mandar, y el backend los
// devuelve como texto. Los errores llegan con `status` y `detail` crudo
// (core/api.js): la pantalla lee `detail.tipo` para reaccionar a cada 409 y 422.

// ─── Claves de React Query ──────────────────────────────────────────────────
// El listado y el alta/edición comparten la del listado: guardar o borrar la
// invalida. La del detalle empieza distinto a propósito ("comprobante", en
// singular): invalidar el listado no vuelve a pedir el Comprobante abierto.

export const CLAVE_COMPROBANTES = ['facturacion', 'comprobantes']
export const claveComprobante = (id) => ['facturacion', 'comprobante', String(id)]

// ─── Comprobantes ───────────────────────────────────────────────────────────

// Todos, del más nuevo al más viejo, sin paginar: la pantalla filtra y ordena.
export const listarComprobantes = () =>
  api.get('/facturacion/comprobantes').then(r => r.data)

export const obtenerComprobante = (id) =>
  api.get(`/facturacion/comprobantes/${id}`).then(r => r.data)

// El alta y la edición devuelven el detalle completo, el mismo del GET: la
// pantalla sigue con lo guardado sin volver a pedirlo.
export const crearComprobante = (datos) =>
  api.post('/facturacion/comprobantes', datos).then(r => r.data)

// Reemplaza la cabecera y todas las Líneas. `datos.actualizado_en` va tal cual
// lo trajo el detalle: si otra persona guardó en el medio, 409
// `comprobante_modificado`.
export const editarComprobante = (id, datos) =>
  api.put(`/facturacion/comprobantes/${id}`, datos).then(r => r.data)

// Borra también sus adjuntos. Un histórico o una Factura con Notas de crédito
// no se borran (409).
export const borrarComprobante = (id) =>
  api.delete(`/facturacion/comprobantes/${id}`).then(r => r.data)

// ─── Adjuntos ───────────────────────────────────────────────────────────────
// PDF, PNG o JPG, hasta 5 por Comprobante; también en los históricos. Subir y
// quitar no cambian la cabecera ni el `actualizado_en` del Comprobante. Los
// mensajes de error los arma `mensajeDeAdjunto` (adjuntos.js).

// Devuelve el Adjunto creado: {id, nombre_original, tipo_contenido,
// tamano_bytes, subido_en}. El Content-Type va explícito: la instancia de
// core/api.js manda JSON por defecto, y con ese header axios convierte el
// FormData en JSON (el archivo no viajaría). Con multipart, el navegador lo
// reemplaza por el suyo, con el boundary.
export const subirAdjunto = (comprobanteId, archivo) => {
  const cuerpo = new FormData()
  cuerpo.append('archivo', archivo)
  return api.post(`/facturacion/comprobantes/${comprobanteId}/adjuntos`, cuerpo, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}

// El archivo como Blob, con el tipo que detectó el backend al subirlo: la
// sesión viaja en un header, así que un enlace directo no la llevaría. Si
// falla, el `detail` llega como Blob y no se lee: el error trae sólo `status`.
export const verAdjunto = (comprobanteId, adjuntoId) =>
  api.get(`/facturacion/comprobantes/${comprobanteId}/adjuntos/${adjuntoId}`, { responseType: 'blob' })
     .then(r => r.data)

export const quitarAdjunto = (comprobanteId, adjuntoId) =>
  api.delete(`/facturacion/comprobantes/${comprobanteId}/adjuntos/${adjuntoId}`).then(r => r.data)

// ─── Lecturas del campo y de sueldos ────────────────────────────────────────
// El backend las guarda 10 minutos en caché. Si el sistema de campo no
// responde, 503.

// Sólo los activos: un Cliente de baja ya guardado lo nombra el detalle.
export const listarClientes = () =>
  api.get('/facturacion/clientes').then(r => r.data)

export const listarFincas = (clienteId) =>
  api.get(`/facturacion/clientes/${clienteId}/fincas`).then(r => r.data)

// Las Empresas emisoras, de la base de sueldos: una lista de nombres.
export const listarEmpresas = () =>
  api.get('/facturacion/empresas').then(r => r.data)

// Las tareas activas, con su Unidad sugerida y la marca No facturable leídas
// del campo: la grilla precarga la unidad y avisa.
export const listarTareas = () =>
  api.get('/facturacion/tareas').then(r => r.data)
