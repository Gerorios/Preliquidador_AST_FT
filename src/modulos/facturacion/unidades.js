// Unidades de facturación y helpers de la pantalla Unidad de medida por
// defecto. Es el espejo de app/modulos/facturacion/unidades.py (plan E1, D5):
// en la base va la clave y la etiqueta vive en el código. No importa nada,
// para que lo cargue `node --test`.
//
// Las tareas tienen la forma del contrato de GET /api/facturacion/tareas:
// { tarea_id, nombre, grupo_tarea, unidad_sugerida, no_facturable, sin_definir }.
// El cuerpo del PATCH lleva el estado completo: { unidad_sugerida, no_facturable }.

export const UNIDADES = [
  'horas_peon', 'horas_tractor', 'plantas', 'hectareas', 'tancadas',
  'bins', 'bins_c', 'bins_m', 'viajes',
]

// Las de cosecha. En la E1 una tarea con una de estas cuenta como con unidad.
export const UNIDADES_COSECHA = ['bins', 'bins_c', 'bins_m', 'viajes']

export const ETIQUETAS = {
  horas_peon: 'Horas de peón',
  horas_tractor: 'Horas de tractor',
  plantas: 'Plantas',
  hectareas: 'Hectáreas',
  tancadas: 'Tancadas',
  bins: 'Bins',
  bins_c: 'Bins C',
  bins_m: 'Bins M',
  viajes: 'Viajes',
}

// Valores del select de la pantalla para lo que no es una unidad. Sin definir
// es el vacío, como la opción sin elegir de un select; No facturable es una
// marca y no una unidad, así que su valor no puede ser una de las nueve claves.
export const VALOR_SIN_DEFINIR = ''
export const VALOR_NO_FACTURABLE = 'no_facturable'

export function valorDeTarea(tarea) {
  if (tarea.no_facturable) return VALOR_NO_FACTURABLE
  return tarea.unidad_sugerida || VALOR_SIN_DEFINIR
}

// El backend valida la clave: una desconocida vuelve con un 422 que la nombra.
export function cuerpoDesdeValor(valor) {
  if (valor === VALOR_NO_FACTURABLE) return { unidad_sugerida: null, no_facturable: true }
  if (!valor) return { unidad_sugerida: null, no_facturable: false }
  return { unidad_sugerida: valor, no_facturable: false }
}

export function etiquetaDe(tarea) {
  if (tarea.no_facturable) return 'No facturable'
  if (!tarea.unidad_sugerida) return 'Sin definir'
  return ETIQUETAS[tarea.unidad_sugerida] ?? tarea.unidad_sugerida
}

// Búsqueda por nombre o grupo de tareas sin distinguir mayúsculas, como la de
// filtrarLineas.js de Preliquidación (copiada, no importada: ADR-0013).
export function filtrarTareas(tareas, { texto, soloSinDefinir } = {}) {
  const q = texto ? texto.toLowerCase() : ''
  return tareas.filter(t => {
    if (soloSinDefinir && !t.sin_definir) return false
    if (q && ![t.nombre, t.grupo_tarea].some(v => v?.toLowerCase().includes(q))) return false
    return true
  })
}

export function contarSinDefinir(tareas) {
  return tareas.filter(t => t.sin_definir).length
}

// Con "Sólo sin definir", una tarea recién definida sale de la vista y su select
// se desmonta. El foco pasa a la tarea que queda en su lugar: la siguiente; si
// era la última, la anterior. `antes` y `despues` son las tareas visibles antes y
// después de guardar. Devuelve { sale, vecino }: vecino es el tarea_id que toma
// el foco, o null si no queda ninguna (el foco va al chip).
export function vecinoAlSalir(antes, despues, tareaId) {
  const indice = antes.findIndex(t => t.tarea_id === tareaId)
  if (indice === -1 || despues.some(t => t.tarea_id === tareaId)) {
    return { sale: false, vecino: null }
  }
  const vecino = despues[indice] ?? despues[indice - 1] ?? null
  return { sale: true, vecino: vecino ? vecino.tarea_id : null }
}

// Teclas con las que un select cerrado pasa de una opción a otra y dispara un
// cambio por cada una. Ese cambio queda pendiente y se guarda al salir del
// select o con Enter. No cuentan las que abren la lista (Espacio, Alt+flecha,
// F4), donde se elige como con el mouse, ni los atajos con Ctrl o Cmd.
const TECLAS_QUE_RECORREN = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown',
])

export function recorreConTecla({ key, altKey, ctrlKey, metaKey }) {
  if (altKey || ctrlKey || metaKey) return false
  return TECLAS_QUE_RECORREN.has(key) || (key.length === 1 && key !== ' ')
}
