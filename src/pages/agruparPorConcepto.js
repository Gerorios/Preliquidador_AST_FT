// Lógica pura de la vista "Por concepto" del Panel de precios (CONTEXT.md:
// Concepto completo). Sin React: recibe las reglas planas del endpoint del
// panel y devuelve bloques por tarea con una fila por alcance y una columna
// por código. Se mantiene aparte para poder razonarla y verificarla sola.

export const ORDEN_ALCANCE = { comun: 0, cliente: 1, finca: 2, supervisor: 3 }

const norm = (s) => (s ?? '').toString().trim().toUpperCase()

// Alcance de una regla (ADR-0011): supervisor > finca > cliente > común.
// Una regla con finca es SIEMPRE de alcance finca aunque no tenga cliente: si
// cayera en "común" se mezclaría con reglas que aplican a toda la tarea.
export function tipoAlcance(regla) {
  if (norm(regla.supervisor_nombre)) return 'supervisor'
  if (norm(regla.finca_nombre)) return 'finca'
  if (norm(regla.cliente_nombre)) return 'cliente'
  return 'comun'
}

// Clave estable del alcance dentro de una tarea. Normalizada igual que el
// matching del backend (strip + upper) para que "Citrusvil" y "CITRUSVIL"
// caigan en la misma fila.
export function claveAlcance(regla) {
  const tipo = tipoAlcance(regla)
  return `${tipo}|${norm(regla.cliente_nombre)}|${norm(regla.finca_nombre)}|${norm(regla.supervisor_nombre)}`
}

export function etiquetaAlcance(fila) {
  switch (fila.tipo) {
    case 'comun':
      return { titulo: 'Común', subtitulo: 'todas las líneas de la tarea' }
    case 'cliente':
      return { titulo: fila.cliente_nombre, subtitulo: `por cliente · todas las fincas${fila.reemplaza_comun ? ' · reemplaza al común' : ''}` }
    case 'finca':
      return { titulo: `${fila.cliente_nombre || '—'} / ${fila.finca_nombre}`, subtitulo: `por finca${fila.reemplaza_comun ? ' · reemplaza al común' : ''}` }
    case 'supervisor':
      return { titulo: `Supervisor: ${fila.supervisor_nombre}`, subtitulo: 'por supervisor · solo informativo' }
    default:
      return { titulo: '', subtitulo: '' }
  }
}

const tienePrecio = (r) => r.precio != null && r.precio !== ''

// Un código de un alcance está "sin precio" si ALGUNA de sus reglas (una por
// categoría, o una sola sin categoría) no tiene precio.
const codigoSinPrecio = (reglas) => reglas.some(r => !tienePrecio(r))

// Filtros multi-select del panel (misma semántica que la tabla plana: unión
// dentro del campo, intersección entre campos).
const CAMPOS = [
  { key: 'tarea',      field: 'tarea_nombre' },
  { key: 'cliente',    field: 'cliente_nombre' },
  { key: 'finca',      field: 'finca_nombre' },
  { key: 'supervisor', field: 'supervisor_nombre' },
]

// La comparación es normalizada porque las filas se agrupan normalizadas: si
// se comparara el texto crudo, filtrar por "Citrusvil" descartaría las reglas
// escritas "CITRUSVIL" que comparten fila y aparecerían faltantes falsos.
function pasaFiltros(regla, filtros) {
  for (const c of CAMPOS) {
    const valores = filtros[c.key]
    if (valores?.length && !valores.some(v => norm(v) === norm(regla[c.field]))) return false
  }
  return true
}

export function agruparPorConcepto(reglas, { filtroCodigo = '', filtros = {}, soloIncompletos = false } = {}) {
  const qCodigo = String(filtroCodigo ?? '').trim()

  // 1) Unión de códigos por tarea con TODAS las reglas (sin filtrar): la
  //    referencia de completitud no depende de lo que el usuario filtró. La
  //    tarea se indexa normalizada y se guarda la primera grafía vista como
  //    etiqueta visible.
  const codigosPorTarea = new Map()
  const etiquetaTarea = new Map()
  for (const r of reglas) {
    const t = norm(r.tarea_nombre)
    if (!etiquetaTarea.has(t)) etiquetaTarea.set(t, r.tarea_nombre)
    if (r.codigo == null) continue
    if (!codigosPorTarea.has(t)) codigosPorTarea.set(t, new Set())
    codigosPorTarea.get(t).add(Number(r.codigo))
  }

  // 2) Filas por (tarea, alcance) con las reglas que pasan los filtros de
  //    tarea/cliente/finca/supervisor. El filtro por código NO recorta reglas
  //    acá: recorta columnas más abajo (una fila sin el código filtrado debe
  //    seguir existiendo para poder decir "falta").
  const filasPorTarea = new Map()
  for (const r of reglas) {
    if (!pasaFiltros(r, filtros)) continue
    const t = norm(r.tarea_nombre)
    if (!filasPorTarea.has(t)) filasPorTarea.set(t, new Map())
    const filas = filasPorTarea.get(t)
    const clave = claveAlcance(r)
    if (!filas.has(clave)) {
      const tipo = tipoAlcance(r)
      filas.set(clave, {
        clave, tipo,
        cliente_nombre: tipo === 'cliente' || tipo === 'finca' ? r.cliente_nombre : null,
        finca_nombre: tipo === 'finca' ? r.finca_nombre : null,
        supervisor_nombre: tipo === 'supervisor' ? r.supervisor_nombre : null,
        reemplaza_comun: false,
        controlada: tipo !== 'supervisor',
        celdas: {},
        faltan: [], sinPrecio: [], sinCodigo: 0, estado: 'completo',
      })
    }
    const fila = filas.get(clave)
    if (r.reemplaza_comun) fila.reemplaza_comun = true
    // Una regla sin código no genera columna: se cuenta aparte para que el
    // alcance no se declare completo cuando en realidad hay algo a medio cargar.
    if (r.codigo == null) { fila.sinCodigo += 1; continue }
    const cod = Number(r.codigo)
    if (!fila.celdas[cod]) fila.celdas[cod] = []
    fila.celdas[cod].push(r)
  }

  // 3) Armar bloques: columnas (unión o solo el código filtrado), estado por
  //    fila, orden y filtro "solo incompletos".
  const bloques = []
  let totalIncompletos = 0
  let totalSinPrecio = 0

  const claves = [...filasPorTarea.keys()].sort((a, b) =>
    (etiquetaTarea.get(a) ?? a).localeCompare(etiquetaTarea.get(b) ?? b, 'es'))
  for (const tarea of claves) {
    const union = [...(codigosPorTarea.get(tarea) ?? [])].sort((a, b) => a - b)
    let codigos = union
    if (qCodigo) {
      // Filtro por código: solo las tareas que tienen un código que empieza
      // con lo tipeado (mismo criterio que la tabla plana), una columna por
      // cada uno de esos códigos.
      codigos = union.filter(c => String(c).startsWith(qCodigo))
      if (codigos.length === 0) continue
    }

    let filas = [...filasPorTarea.get(tarea).values()]
    for (const fila of filas) {
      // Ordenar las reglas de cada celda: sin categoría primero, luego por categoría.
      for (const cod of Object.keys(fila.celdas)) {
        fila.celdas[cod].sort((a, b) => (a.categoria ?? -1) - (b.categoria ?? -1))
      }
      if (!fila.controlada) { fila.estado = 'informativo'; continue }
      fila.faltan = codigos.filter(c => !fila.celdas[c])
      fila.sinPrecio = codigos.filter(c => fila.celdas[c] && codigoSinPrecio(fila.celdas[c]))
      fila.estado = fila.faltan.length
        ? 'falta'
        : fila.sinPrecio.length
          ? 'sin_precio'
          : fila.sinCodigo > 0
            ? 'sin_codigo'
            : 'completo'
    }

    if (soloIncompletos) filas = filas.filter(f => f.estado === 'falta' || f.estado === 'sin_precio' || f.estado === 'sin_codigo')
    if (filas.length === 0) continue

    filas.sort((a, b) => {
      const d = ORDEN_ALCANCE[a.tipo] - ORDEN_ALCANCE[b.tipo]
      if (d !== 0) return d
      return etiquetaAlcance(a).titulo.localeCompare(etiquetaAlcance(b).titulo, 'es')
    })

    const incompletos = filas.filter(f => f.estado === 'falta').length
    const sinPrecio = filas.filter(f => f.estado === 'sin_precio').length
    const sinCodigo = filas.reduce((acc, f) => acc + f.sinCodigo, 0)
    const controladas = filas.filter(f => f.controlada).length
    totalIncompletos += incompletos
    totalSinPrecio += sinPrecio
    bloques.push({
      tarea,
      tareaLabel: etiquetaTarea.get(tarea) ?? tarea,
      codigos, filas, incompletos, sinPrecio, sinCodigo, controladas,
    })
  }

  return { bloques, resumen: { tareas: bloques.length, incompletos: totalIncompletos, sinPrecio: totalSinPrecio } }
}
