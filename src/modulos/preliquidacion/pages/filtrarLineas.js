// Filtrado de líneas en cliente, compartido por Revisión y Verificación.
// Se separa en dos partes porque la barra de filtros necesita la primera
// sola: las opciones de cada filtro (cliente, finca...) salen de las líneas
// que ya pasan la búsqueda y las alertas, así nunca se ofrece un valor que
// no tiene ninguna línea visible.

export const CAMPOS_LINEAS = [
  { key: 'cliente',     label: 'Cliente',        field: 'nombre_cliente' },
  { key: 'finca',       label: 'Finca',          field: 'nombre_finca' },
  { key: 'tarea',       label: 'Tarea',          field: 'nombre_tarea' },
  { key: 'empresa',     label: 'Empresa',        field: 'empresa_asignada' },
  { key: 'grupo_pago',  label: 'Grupo de pago',  field: 'grupo_pago_aplicado' },
  { key: 'supervisor',  label: 'Supervisor',     field: 'nombre_supervisor' },
]

const ALERTA = {
  incompleta: l => l.linea_incompleta,
  alerta_legajo: l => l.alerta_legajo,
  alerta_empresa: l => l.alerta_empresa,
  es_duplicado: l => l.es_duplicado,
  es_posible_duplicado: l => l.es_posible_duplicado,
}

// `solo_alertas` reproduce la condición de preliquidacion_service.listar_lineas
// (sin alerta_empresa).
const conAlguna = l => l.es_duplicado || l.es_posible_duplicado || l.alerta_legajo || l.linea_incompleta

export function pasaBusquedaYAlertas(linea, busqueda, filtros) {
  if (busqueda) {
    const q = busqueda.toLowerCase()
    const coincide = [
      linea.nombre_empleado, linea.legajo_campo, linea.legajo_asignado,
      linea.nombre_tarea, linea.nombre_cliente, linea.nombre_finca,
    ].some(v => v?.toLowerCase().includes(q))
    if (!coincide) return false
  }
  if (filtros.alerta && !ALERTA[filtros.alerta]?.(linea)) return false
  if (filtros.solo_alertas && !conAlguna(linea)) return false
  if (filtros.nombre_empleado && !linea.nombre_empleado?.toLowerCase().includes(filtros.nombre_empleado.toLowerCase())) return false
  return true
}

export function pasaCampos(linea, filtros, campos = CAMPOS_LINEAS) {
  return campos.every(c => !filtros[c.key]?.length || filtros[c.key].includes(linea[c.field]))
}

export function filtrarLineas(lineas, busqueda, filtros, campos = CAMPOS_LINEAS) {
  return lineas.filter(l => pasaBusquedaYAlertas(l, busqueda, filtros) && pasaCampos(l, filtros, campos))
}
