import api from '../../../core/api'

// Módulo Facturación: llamadas a /api/facturacion (contrato del plan E1, 2.5).
// En la E1 sólo existe la Unidad de medida por defecto de cada tarea.

// Las tareas activas del sistema de campo, con las sin definir primero. Lee el
// campo en vivo: si no responde, el backend da 503 con el mensaje en `detail`.
export const listarTareas = () =>
  api.get('/facturacion/tareas').then(r => r.data)

// Guarda el estado completo de una tarea: { unidad_sugerida, no_facturable }
// (ver cuerpoDesdeValor en ../unidades.js). Devuelve el ítem con la misma
// forma que en listarTareas, para actualizar el caché sin volver a leer.
export const definirTarea = (tareaId, cuerpo) =>
  api.patch(`/facturacion/tareas/${tareaId}`, cuerpo).then(r => r.data)
