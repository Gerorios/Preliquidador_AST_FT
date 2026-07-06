import api from './api'

// ─── Preliquidación ───────────────────────────────────────────────────────────

export const listarEmpresas = () =>
  api.get('/preliquidacion/empresas').then(r => r.data)

export const listarPreliquidaciones = () =>
  api.get('/preliquidacion/').then(r => r.data)

export const generarPreliquidacion = (quincena) =>
  api.post('/preliquidacion/generar', { quincena }).then(r => r.data)

export const obtenerEstadisticas = (id) =>
  api.get(`/preliquidacion/${id}/estadisticas`).then(r => r.data)

export const obtenerDashboardVerificacion = (id) =>
  api.get(`/preliquidacion/${id}/dashboard-verificacion`).then(r => r.data)

export const obtenerControlPlantasJornal = (id) =>
  api.get(`/preliquidacion/${id}/control-plantas-jornal`).then(r => r.data)

export const listarLineas = (id, filtros = {}) => {
  const params = new URLSearchParams()
  if (filtros.empresa)         params.append('empresa', filtros.empresa)
  if (filtros.solo_alertas)    params.append('solo_alertas', true)
  if (filtros.nombre_empleado) params.append('nombre_empleado', filtros.nombre_empleado)
  return api.get(`/preliquidacion/${id}/lineas?${params}`).then(r => r.data)
}

export const actualizarLinea = (lineaId, datos) =>
  api.patch(`/preliquidacion/linea/${lineaId}`, datos).then(r => r.data)

export const agregarConcepto = (lineaId, datos) =>
  api.post(`/preliquidacion/linea/${lineaId}/concepto`, datos).then(r => r.data)

export const eliminarConcepto = (conceptoId) =>
  api.delete(`/preliquidacion/linea/concepto/${conceptoId}`).then(r => r.data)

export const agregarConceptoPorCodigo = (lineaId, codigo) =>
  api.post(`/preliquidacion/linea/${lineaId}/conceptos/por-codigo`, { codigo }).then(r => r.data)

export const aplicarConceptos = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/aplicar-conceptos`).then(r => r.data)

export const recalcularPrecios = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/recalcular`).then(r => r.data)

export const agregarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo', { linea_ids: lineaIds, codigo }).then(r => r.data)

export const eliminarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo/eliminar', { linea_ids: lineaIds, codigo }).then(r => r.data)

// ─── Catálogos externos ───────────────────────────────────────────────────────

export const listarClientes = () =>
  api.get('/precios/maestro/clientes').then(r => r.data)

export const listarFincas = (cliente) =>
  api.get(`/precios/maestro/fincas?cliente=${encodeURIComponent(cliente)}`).then(r => r.data)

export const listarTareas = () =>
  api.get('/precios/maestro/tareas').then(r => r.data)

export const listarGruposPago = () =>
  api.get('/precios/grupos-pago').then(r => r.data)

// ─── Maestro unificado de Conceptos ──────────────────────────────────────────
// Reemplaza precio_maestro + precio_comun + concepto_liquidacion anterior.
// scope: 'comun' (cliente IS NULL) | 'especifico' (cliente NOT NULL)

export const listarQuincenasConConceptos = () =>
  api.get('/precios/conceptos/quincenas').then(r => r.data)

export const listarConceptos = (quincena, scope) =>
  api.get('/precios/conceptos', { params: { quincena, scope } }).then(r => r.data)

export const crearConcepto = (datos) =>
  api.post('/precios/conceptos', datos).then(r => r.data)

export const actualizarConcepto = (id, datos) =>
  api.patch(`/precios/conceptos/${id}`, datos).then(r => r.data)

export const eliminarConcepto2 = (id) =>
  api.delete(`/precios/conceptos/${id}`).then(r => r.data)

export const copiarConceptos = (origen, destino) =>
  api.post('/precios/conceptos/copiar', null, {
    params: { quincena_origen: origen, quincena_destino: destino }
  }).then(r => r.data)

export const listarConceptosFaltantes = (quincena) =>
  api.get('/precios/conceptos/faltantes', { params: { quincena } }).then(r => r.data)

export const buscarConceptosParaCombo = (q, quincena) =>
  api.get('/precios/conceptos/buscar', { params: { q, quincena } }).then(r => r.data)

export const aplicar = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/aplicar`).then(r => r.data)