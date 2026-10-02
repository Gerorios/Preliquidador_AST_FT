// Lógica pura del orden por columna de la tabla de Revisión. Sin React: recibe
// las líneas ya filtradas y el orden activo ({ clave, dir } o null) y devuelve
// una copia ordenada. El ciclo de clics es asc, desc y vuelta al orden del
// server. Se mantiene aparte para poder razonarla y verificarla sola.

// Los Decimal del backend llegan como string ('12.50'): los numéricos se
// comparan siempre con Number(), nunca como texto ("95" > "120").

// Collators a nivel de módulo: crearlos dentro del comparador costaría uno por
// comparación, y con 2.500 líneas eso se nota.
const collatorTexto = new Intl.Collator('es', { sensitivity: 'base' })
const collatorLegajo = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

// Precedencia de alertas: la misma que muestra el badge de la primera columna.
// Una línea con varias alertas se ordena por la más grave.
const PRECEDENCIA_ALERTAS = ['DUPLICADO', 'INCOMPLETA', 'LEGAJO', 'EMPRESA']

export function alertaDe(linea) {
  if (linea.es_duplicado)     return 'DUPLICADO'
  if (linea.linea_incompleta) return 'INCOMPLETA'
  if (linea.alerta_legajo)    return 'LEGAJO'
  if (linea.alerta_empresa)   return 'EMPRESA'
  return null
}

// Cada tipo sabe normalizar un valor crudo (null = vacío) y comparar dos
// valores normalizados.
const texto = (v) => {
  const s = (v ?? '').toString().trim()
  return s || null
}

const TIPOS = {
  texto:  { normalizar: texto, comparar: collatorTexto.compare },
  legajo: { normalizar: texto, comparar: collatorLegajo.compare },
  // Fechas ISO (AAAA-MM-DD): el orden de string es el cronológico.
  fecha:  { normalizar: texto, comparar: (a, b) => (a < b ? -1 : a > b ? 1 : 0) },
  // 0 cuenta como vacío: la tabla ya lo muestra '—'. NaN también.
  numero: { normalizar: (v) => Number(v) || null, comparar: (a, b) => a - b },
  alerta: {
    normalizar: (v) => (v ? PRECEDENCIA_ALERTAS.indexOf(v) : null),
    comparar: (a, b) => a - b,
  },
}

// Clave de columna → criterios en orden de desempate. La clave es la que usa
// el estado del orden en Revision.jsx.
const criterio = (tipo, valor) => ({ tipo, valor })
export const COLUMNAS_ORDEN = {
  alerta:        [criterio('alerta', alertaDe)],
  fecha:         [criterio('fecha', l => l.fecha_tarea)],
  empleado:      [criterio('texto', l => l.nombre_empleado)],
  legajo:        [criterio('legajo', l => l.legajo_asignado || l.legajo_campo)],
  empresa:       [criterio('texto', l => l.empresa_asignada)],
  tarea:         [criterio('texto', l => l.nombre_tarea)],
  supervisor:    [criterio('texto', l => l.nombre_supervisor)],
  cliente_finca: [criterio('texto', l => l.nombre_cliente), criterio('texto', l => l.nombre_finca)],
  grupo_pago:    [criterio('texto', l => l.grupo_pago_aplicado)],
  hsjornal:      [criterio('numero', l => l.hsjornal)],
  hsmaquina:     [criterio('numero', l => l.hsmaquina)],
  tancadas:      [criterio('numero', l => l.tancadas)],
  unidades:      [criterio('numero', l => l.unidades)],
  importe:       [criterio('numero', l => l.importe_total)],
  conceptos:     [criterio('numero', l => l.conceptos?.length)],
}

// Ciclo de un encabezado: asc → desc → sin orden. Otra columna arranca en asc.
export function siguienteOrden(orden, clave) {
  if (!orden || orden.clave !== clave) return { clave, dir: 'asc' }
  if (orden.dir === 'asc') return { clave, dir: 'desc' }
  return null
}

export function ordenarLineas(lineas, orden) {
  if (!orden) return lineas
  const criterios = COLUMNAS_ORDEN[orden.clave]
  if (!criterios) return lineas
  const signo = orden.dir === 'desc' ? -1 : 1
  const pasos = criterios.map(({ tipo, valor }) => ({ valor, ...TIPOS[tipo] }))

  // Los vacíos se resuelven antes de aplicar el signo: quedan al final en asc
  // y en desc. Entre iguales manda el orden de entrada (sort es estable).
  const cmp = (a, b) => {
    for (const { valor, normalizar, comparar } of pasos) {
      const va = normalizar(valor(a))
      const vb = normalizar(valor(b))
      if (va === null && vb === null) continue
      if (va === null) return 1
      if (vb === null) return -1
      const d = comparar(va, vb)
      if (d !== 0) return signo * d
    }
    return 0
  }

  return [...lineas].sort(cmp)
}
