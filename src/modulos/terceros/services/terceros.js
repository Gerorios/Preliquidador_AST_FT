import api from '../../../core/api'

// Módulo Liquidación Terceros — etapa 2: los cuatro conjuntos de una quincena,
// de solo lectura. Todavía no hay nada que escribir: las tarifas y el neto
// empiezan en la etapa 4. Por eso acá no hay ninguna mutación.
//
// La quincena se identifica por su primer día (el 1 o el 16) en formato
// AAAA-MM-DD, igual que la manda el backend en /quincenas.
//
// No hay una llamada que junte los cuatro conjuntos a propósito: el backend
// tenía un /resumen y tardaba 15 segundos porque pedía los cuatro orígenes en
// serie. Pidiéndolos por separado el navegador los hace en paralelo y cada
// tarjeta de la portada aparece cuando llega la suya.

export const listarQuincenas = (cantidad = 24) =>
  api.get(`/terceros/quincenas?cantidad=${cantidad}`).then(r => r.data)

export const listarViajes = (quincena) =>
  api.get(`/terceros/viajes?quincena=${quincena}`).then(r => r.data)

export const listarCombustible = (quincena) =>
  api.get(`/terceros/combustible?quincena=${quincena}`).then(r => r.data)

export const listarRepuestos = (quincena) =>
  api.get(`/terceros/repuestos?quincena=${quincena}`).then(r => r.data)

// Horas de REPARACIÓN: el taller de la empresa arreglando la máquina del
// tercero. Se le descuentan. Devuelve { horas, estados }: las dos cosas salen
// de la misma lectura del Sheet, que tarda unos seis segundos.
export const obtenerHorasReparacion = (quincena) =>
  api.get(`/terceros/horas-reparacion?quincena=${quincena}`).then(r => r.data)

// Para la pantalla de listado, que solo necesita las filas.
export const listarHorasReparacion = (quincena) =>
  obtenerHorasReparacion(quincena).then(d => d.horas)

// Horas de SERVICIO: la máquina del tercero trabajando en nuestras fincas. Se
// le pagan. Van en el sentido contrario a las de reparación, por eso son dos
// pantallas y no una con un filtro.
export const listarHorasServicio = (quincena) =>
  api.get(`/terceros/horas-servicio?quincena=${quincena}`).then(r => r.data)

// Alertas de cruce entre los tres sistemas de origen (etapa 3).
// No llevan quincena: un problema de cruce es del maestro, no de un período.
// El año sirve para una sola cosa: saber si una máquina descolgada tuvo
// movimiento, que es lo que separa una alerta accionable de una fila muerta.
export const obtenerAlertas = (anio) =>
  api.get(`/terceros/alertas${anio ? `?anio=${anio}` : ''}`).then(r => r.data)

// ─── La quincena generada (etapa 5) ─────────────────────────────────────────
// Generar trae las cinco fuentes y las guarda. No congela nada: se puede volver
// a llamar mientras el recibo no esté emitido, y reconcilia en vez de rehacer.

export const listarLiquidaciones = () =>
  api.get('/terceros/liquidaciones').then(r => r.data)

export const generarLiquidacion = (quincena) =>
  api.post('/terceros/liquidaciones/generar', { quincena }).then(r => r.data)
