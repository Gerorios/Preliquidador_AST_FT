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

// ─── El Tarifario (etapa 6) ─────────────────────────────────────────────────
// Un solo juego de llamadas para los cinco tarifarios: cambia el `tipo`.

export const obtenerResumenTarifario = (quincena) =>
  api.get(`/terceros/tarifario/resumen?quincena=${quincena}`).then(r => r.data)

export const listarTarifas = (tipo, quincena) =>
  api.get(`/terceros/tarifario/${tipo}?quincena=${quincena}`).then(r => r.data)

export const crearTarifa = (tipo, quincena, datos) =>
  api.post(`/terceros/tarifario/${tipo}?quincena=${quincena}`, datos).then(r => r.data)

export const actualizarTarifa = (tipo, id, datos) =>
  api.patch(`/terceros/tarifario/${tipo}/${id}`, datos).then(r => r.data)

// Deja el precio como está, pero dicho por una persona: le saca la marca de
// heredado sin cambiar el número.
export const confirmarTarifa = (tipo, id) =>
  api.post(`/terceros/tarifario/${tipo}/${id}/confirmar`).then(r => r.data)

export const eliminarTarifa = (tipo, id) =>
  api.delete(`/terceros/tarifario/${tipo}/${id}`).then(r => r.data)

export const copiarTarifario = (desde, hasta, tipos) =>
  api.post('/terceros/tarifario/copiar', { desde, hasta, tipos }).then(r => r.data)

// El padrón de lo que se le asegura a cada tercero: sus colectivos, su
// maquinaria y sus choferes. No lleva quincena — es el padrón del sistema de
// campo, no un movimiento.
export const listarBienes = () =>
  api.get('/terceros/bienes').then(r => r.data)

// ─── El cálculo y la grilla (etapas 7 y 8) ──────────────────────────────────

// No hay una llamada para recalcular: cargar un precio ya lo aplica. El backend
// recalcula el concepto de ese tarifario en el mismo request, igual que hace
// Preliquidación con sus conceptos. Lo único que queda de este lado es avisarle
// a la caché de la grilla que lo que tenía quedó viejo.

// Los seis conceptos de la quincena en una sola lista, ya con su importe.
// Vienen también las líneas sin precio: son las que hay que resolver.
export const listarLineas = (quincena) =>
  api.get(`/terceros/liquidaciones/lineas?quincena=${quincena}`).then(r => r.data)

// Por tercero: Total a facturar (sin seguros) y Total a pagar (con).
export const listarTotales = (quincena) =>
  api.get(`/terceros/liquidaciones/totales?quincena=${quincena}`).then(r => r.data)

export const listarPendientes = (quincena) =>
  api.get(`/terceros/liquidaciones/pendientes?quincena=${quincena}`).then(r => r.data)

// Las combinaciones que la quincena tiene, con o sin precio. De acá salen dos
// cosas: la lista de lo que falta pactar, y los valores que los desplegables
// ofrecen al cargar una regla — para no tipear un nombre que tiene que
// coincidir exacto con el del sistema de campo.
export const listarCombinaciones = (tipo, quincena) =>
  api.get(`/terceros/tarifario/${tipo}/combinaciones?quincena=${quincena}`).then(r => r.data)

// Sacarle la marca de heredada a varias reglas de una. Copiar una quincena
// trae doscientas sin confirmar, y confirmarlas de a una es el trabajo que
// copiar vino a evitar.
export const confirmarTarifasEnLote = (tipo, ids) =>
  api.post(`/terceros/tarifario/${tipo}/confirmar-lote`, { ids }).then(r => r.data)

// El mismo valor para varias reglas, con un solo recálculo. Es lo que se usa
// cuando sube un precio y hay que tocarlo en cuarenta reglas iguales.
export const actualizarTarifasEnLote = (tipo, ids, datos) =>
  api.patch(`/terceros/tarifario/${tipo}/lote`, { ids, datos }).then(r => r.data)

// Varias reglas del mismo tarifario de una. De a una, pactar las 44
// combinaciones de horas de servicio de una quincena son 44 requests y 44
// recálculos de lo mismo.
export const crearTarifasEnLote = (tipo, quincena, tarifas) =>
  api.post(`/terceros/tarifario/${tipo}/lote?quincena=${quincena}`, { tarifas })
     .then(r => r.data)

// Lo que hay que mirar antes de liquidar, agrupado por la fuente que lo
// origina. A diferencia de las alertas de cruce, esto es POR QUINCENA: un
// duplicado de agosto es plata cobrada dos veces en agosto.
export const obtenerVerificaciones = (quincena) =>
  api.get(`/terceros/verificaciones?quincena=${quincena}`).then(r => r.data)

// ─── Estaciones de servicio (etapa 10) ──────────────────────────────────────
// El otro lado del combustible: lo que la estación facturó, contra lo que el
// sistema de campo dice que se cargó.

export const listarEstaciones = (quincena) =>
  api.get(`/terceros/estaciones?quincena=${quincena}`).then(r => r.data)

// Cada línea del archivo va a la quincena de SU fecha; la que se manda es el
// respaldo para las que vengan sin fecha.
export const subirArchivoEstacion = (estacionId, quincena, archivo) => {
  const cuerpo = new FormData()
  cuerpo.append('quincena', quincena)
  cuerpo.append('archivo', archivo)
  return api.post(`/terceros/estaciones/${estacionId}/subir`, cuerpo)
            .then(r => r.data)
}

export const obtenerCruceEstaciones = (quincena) =>
  api.get(`/terceros/estaciones/cruce?quincena=${quincena}`).then(r => r.data)

export const listarLineasEstacion = (estacionId, quincena) =>
  api.get(`/terceros/estaciones/${estacionId}/lineas?quincena=${quincena}`)
     .then(r => r.data)

// Los remitos que llegan por foto. Suman, no reemplazan: van llegando de a
// poco y borrar lo anterior sería perder lo recién tipeado.
export const cargarLineasAMano = (estacionId, lineas) =>
  api.post(`/terceros/estaciones/${estacionId}/lineas`, { lineas }).then(r => r.data)

export const borrarLineaFacturada = (id) =>
  api.delete(`/terceros/estaciones/lineas/${id}`).then(r => r.data)

// Con qué nombre se registran sus cargas en el sistema de campo. Sin esto no
// hay nada que cruzar, y no se puede adivinar.
export const definirOrigenEstacion = (estacionId, origen) =>
  api.patch(`/terceros/estaciones/${estacionId}`, { origen_campo: origen })
     .then(r => r.data)
