import api from './api'

// ─── Asistente de ayuda de uso ────────────────────────────────────────────────

// pregunta: string; historial: [{ rol: 'user'|'assistant', contenido }]; pantalla: string|null
export const consultarAsistente = ({ pregunta, historial = [], pantalla = null }) =>
  api.post('/asistente/chat', { pregunta, historial, pantalla }).then(r => r.data)

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

export const obtenerControlTancadasJornal = (id) =>
  api.get(`/preliquidacion/${id}/control-tancadas-jornal`).then(r => r.data)

// valor: número (valor hora de pulverización de la quincena) o null para limpiar
export const setValorHoraPulv = (id, valor) =>
  api.patch(`/preliquidacion/${id}/valor-hora-pulv`, { valor_hora_pulv: valor }).then(r => r.data)

export const listarLineas = (id, filtros = {}) => {
  const params = new URLSearchParams()
  if (filtros.empresa)         params.append('empresa', filtros.empresa)
  if (filtros.solo_alertas)    params.append('solo_alertas', true)
  if (filtros.nombre_empleado) params.append('nombre_empleado', filtros.nombre_empleado)
  return api.get(`/preliquidacion/${id}/lineas?${params}`).then(r => r.data)
}

export const actualizarLinea = (lineaId, datos) =>
  api.patch(`/preliquidacion/linea/${lineaId}`, datos).then(r => r.data)

// Pares (empresa, legajo) reales de la persona de una línea, para el
// desplegable "EMPRESA — legajo" del panel. legajos_disponibles vacío = sin CUIL.
export const obtenerLegajosDisponibles = (lineaId) =>
  api.get(`/preliquidacion/linea/${lineaId}/legajos-disponibles`).then(r => r.data)

export const agregarConcepto = (lineaId, datos) =>
  api.post(`/preliquidacion/linea/${lineaId}/concepto`, datos).then(r => r.data)

export const eliminarConcepto = (conceptoId) =>
  api.delete(`/preliquidacion/linea/concepto/${conceptoId}`).then(r => r.data)

export const agregarConceptoPorCodigo = (lineaId, codigo) =>
  api.post(`/preliquidacion/linea/${lineaId}/conceptos/por-codigo`, { codigo }).then(r => r.data)

export const agregarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo', { linea_ids: lineaIds, codigo }).then(r => r.data)

export const eliminarConceptoMasivo = (lineaIds, codigo) =>
  api.post('/preliquidacion/lineas/concepto-masivo/eliminar', { linea_ids: lineaIds, codigo }).then(r => r.data)

export const legajosPorCuil = (lineaIds) =>
  api.post('/preliquidacion/lineas/legajos-por-cuil', { linea_ids: lineaIds }).then(r => r.data)

export const reasignarEmpresaMasivo = (lineaIds, empresa, motivoAjuste) =>
  api.post('/preliquidacion/lineas/reasignar-empresa', {
    linea_ids: lineaIds, empresa, motivo_ajuste: motivoAjuste,
  }).then(r => r.data)

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

// ─── Panel de precios (vista plana, edición masiva) ──────────────────────────

export const obtenerPanelPrecios = (quincena) =>
  api.get('/precios/conceptos/panel', { params: { quincena } }).then(r => r.data)

export const aplicarPrecioMasivo = (ids, precio) =>
  api.patch('/precios/conceptos/precio-masivo', { ids, precio }).then(r => r.data)

// ─── Categorías de operarios de mantenimiento ────────────────────────────────

export const listarOperariosMantenimiento = (preliqId) =>
  api.get(`/preliquidacion/${preliqId}/operarios-mantenimiento`).then(r => r.data)

export const setCategoriaOperario = (preliqId, cuil, categoria) =>
  api.put(`/preliquidacion/${preliqId}/categoria-operario`, { cuil, categoria }).then(r => r.data)

export const heredarCategoriasOperario = (preliqId) =>
  api.post(`/preliquidacion/${preliqId}/categorias-operario/heredar`).then(r => r.data)

// ─── Exportación a Excel ──────────────────────────────────────────────────────
// Descarga directa en el browser: pide el blob, arma un objectURL, dispara un
// <a download> con el nombre de archivo del header (si viene) y limpia todo.
export const exportarQuincenaExcel = async (preliqId) => {
  const res = await api.get(`/preliquidacion/${preliqId}/export-excel`, { responseType: 'blob' })

  const disposition = res.headers?.['content-disposition'] || ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const filename = match ? decodeURIComponent(match[1]) : 'preliquidacion.xlsx'

  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)

  return { filename }
}