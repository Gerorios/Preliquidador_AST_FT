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
