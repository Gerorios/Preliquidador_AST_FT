import api from './api'

// Todos aceptan { quincena } o { mes: 'YYYY-MM' } (exactamente uno) y empresa opcional.
const params = ({ quincena, mes, empresa, ...resto }) => ({
  ...(quincena ? { quincena } : { mes }),
  ...(empresa ? { empresa } : {}),
  ...resto,
})

export const listarQuincenasGerencial = () =>
  api.get('/gerencial/quincenas').then(r => r.data)

export const listarEmpresasGerencial = () =>
  api.get('/gerencial/empresas').then(r => r.data)

export const obtenerResumen = (periodo) =>
  api.get('/gerencial/resumen', { params: params(periodo) }).then(r => r.data)

export const obtenerEvolucion = (empresa) =>
  api.get('/gerencial/evolucion', { params: empresa ? { empresa } : {} }).then(r => r.data)

export const obtenerPorCliente = (periodo) =>
  api.get('/gerencial/por-cliente', { params: params(periodo) }).then(r => r.data)

export const obtenerPorGrupoTarea = (periodo, grupo) =>
  api.get('/gerencial/por-grupo-tarea', { params: params({ ...periodo, ...(grupo ? { grupo } : {}) }) }).then(r => r.data)

export const obtenerDesvios = (periodo, umbral) =>
  api.get('/gerencial/desvios-persona', { params: params({ ...periodo, umbral }) }).then(r => r.data)
