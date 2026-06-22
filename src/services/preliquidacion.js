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
  if (filtros.empresa)        params.append('empresa', filtros.empresa)
  if (filtros.revisado != null) params.append('revisado', filtros.revisado)
  if (filtros.solo_alertas)   params.append('solo_alertas', true)
  if (filtros.nombre_empleado) params.append('nombre_empleado', filtros.nombre_empleado)
  return api.get(`/preliquidacion/${id}/lineas?${params}`).then(r => r.data)
}

export const actualizarLinea = (lineaId, datos) =>
  api.patch(`/preliquidacion/linea/${lineaId}`, datos).then(r => r.data)

export const agregarConcepto = (lineaId, datos) =>
  api.post(`/preliquidacion/linea/${lineaId}/concepto`, datos).then(r => r.data)

export const eliminarConcepto = (conceptoId) =>
  api.delete(`/preliquidacion/linea/concepto/${conceptoId}`).then(r => r.data)

// ─── Precios ──────────────────────────────────────────────────────────────────

export const listarClientes = () =>
  api.get('/precios/maestro/clientes').then(r => r.data)

export const listarFincas = (cliente) =>
  api.get(`/precios/maestro/fincas?cliente=${encodeURIComponent(cliente)}`).then(r => r.data)

export const listarTareas = () =>
  api.get('/precios/maestro/tareas').then(r => r.data)

export const listarPreciosMaestro = (quincena, cliente) => {
  const params = new URLSearchParams()
  if (quincena) params.append('quincena', quincena)
  if (cliente)  params.append('cliente', cliente)
  return api.get(`/precios/maestro?${params}`).then(r => r.data)
}

export const crearPrecioMaestro = (datos) =>
  api.post('/precios/maestro', datos).then(r => r.data)

export const eliminarPrecioMaestro = (id) =>
  api.delete(`/precios/maestro/${id}`).then(r => r.data)

export const actualizarPrecioMaestro = (id, datos) =>
  api.patch(`/precios/maestro/${id}`, datos).then(r => r.data)

export const copiarQuincena = (origen, destino) =>
  api.post(`/precios/maestro/copiar-quincena?quincena_origen=${origen}&quincena_destino=${destino}`).then(r => r.data)

export const listarQuincenasConPrecios = () =>
  api.get('/precios/maestro/quincenas').then(r => r.data)

export const buscarConceptosParaCombo = (q) =>
  api.get('/precios/conceptos/buscar', { params: { q } }).then(r => r.data)

export const agregarConceptoPorCodigo = (lineaId, codigo) =>
  api.post(`/preliquidacion/linea/${lineaId}/conceptos/por-codigo`, { codigo }).then(r => r.data)

export const aplicarConceptos = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/aplicar-conceptos`).then(r => r.data)

export const listarConceptosAgrupados = (params = {}) =>
  api.get('/precios/conceptos/agrupados', { params }).then(r => r.data)

export const listarConceptos = (detalle) =>
  api.get('/precios/conceptos', { params: { detalle } }).then(r => r.data)

export const listarDetallesConceptos = () =>
  api.get('/precios/conceptos/detalles').then(r => r.data)

export const crearConcepto = (datos) =>
  api.post('/precios/conceptos', datos).then(r => r.data)

export const actualizarConcepto = (id, datos) =>
  api.patch(`/precios/conceptos/${id}`, datos).then(r => r.data)

export const eliminarConcepto2 = (id) =>
  api.delete(`/precios/conceptos/${id}`).then(r => r.data)

export const recalcularPrecios = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/recalcular`).then(r => r.data)

export const obtenerPreciosFaltantes = (preliqId) =>
  api.get(`/precios/maestro/faltantes/${preliqId}`).then(r => r.data)

export const obtenerPrecioSugerido = (cliente, finca, tarea) =>
  api.get(`/precios/maestro/precio-sugerido?cliente=${encodeURIComponent(cliente)}&finca=${encodeURIComponent(finca)}&tarea=${encodeURIComponent(tarea)}`).then(r => r.data)

export const listarPreciosComunes = (quincena) => {
  const params = new URLSearchParams()
  if (quincena) params.append('quincena', quincena)
  return api.get(`/precios/comunes?${params}`).then(r => r.data)
}

export const crearPrecioComun = (datos) =>
  api.post('/precios/comunes', datos).then(r => r.data)

export const eliminarPrecioComun = (id) =>
  api.delete(`/precios/comunes/${id}`).then(r => r.data)

export const listarGruposPago = () =>
  api.get('/precios/grupos-pago').then(r => r.data)

export const agregarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo', { linea_ids: lineaIds, codigo }).then(r => r.data)

export const eliminarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo/eliminar', { linea_ids: lineaIds, codigo }).then(r => r.data)

export const copiarQuincenaComunes = (origen, destino) =>
  api.post('/precios/comunes/copiar-quincena', null, {
    params: { quincena_origen: origen, quincena_destino: destino }
  }).then(r => r.data)

export const listarQuincenasConPreciosComunes = () =>
  api.get('/precios/comunes/quincenas').then(r => r.data)