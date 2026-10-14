// Lógica pura de la sección "Posibles duplicados" de Verificación. Sin React:
// recibe las líneas que la pantalla ya filtró y agrupa las marcadas como
// posible duplicado con sus compañeras. Vive acá, y no en el backend, para que
// la búsqueda, los filtros y la exclusión de mensualizados apliquen igual que
// en las otras secciones de Verificación, que también se calculan en cliente.

// La clave espeja `clave_posible_duplicado` del backend (motor_reglas.py): la
// línea de campo sin las horas. Nombres con trim + mayúsculas, legajo de campo
// sólo con trim, fecha tal cual y cantidades normalizadas a dos decimales
// como `normalizar_decimal` ('500' y '500.00' son la misma). La marca la decide
// el backend; acá sólo se juntan las líneas de cada grupo.

// Los Decimal del backend llegan como string ('12.50'): se operan siempre con
// Number(), nunca como texto.

const NOMBRES = ['nombre_empleado', 'nombre_tarea', 'nombre_cliente', 'nombre_finca', 'nombre_tractor']

const nombre = (v) => String(v ?? '').trim().toUpperCase()

// Como `normalizar_decimal`: 'None' para nulo, vacío o no numérico; dos
// decimales y sin cero negativo.
function decimal(v) {
  if (v === null || v === undefined || String(v).trim() === '') return 'None'
  const n = Number(v)
  if (!Number.isFinite(n)) return 'None'
  const fijo = n.toFixed(2)
  return Number(fijo) === 0 ? '0.00' : fijo
}

function clave(linea) {
  return JSON.stringify([
    nombre(linea.planilla),
    String(linea.fecha_tarea ?? ''),
    String(linea.legajo_campo ?? '').trim(),
    ...NOMBRES.map(c => nombre(linea[c])),
    decimal(linea.tancadas),
    decimal(linea.unidades),
  ])
}

// Como `paga_cantidad`: unidades o tancadas mayores a 0, ya normalizadas.
const pagaCantidad = (linea) =>
  ['unidades', 'tancadas'].some(c => {
    const d = decimal(linea[c])
    return d !== 'None' && Number(d) > 0
  })

// Los importes son Numeric(_, 2): redondear a dos descarta sólo el error de
// punto flotante, no un valor real.
const aDosDecimales = (n) => Math.round(n * 100) / 100

// Devuelve un item por grupo, ordenado por `valor` de mayor a menor:
// { clave, legajo, nombre_empleado, fecha, lineas, valor }. `valor` es el
// importe en duda: la suma del grupo menos la línea de mayor importe. Un grupo
// que por los filtros queda con una sola línea se oculta.
export function agruparPosiblesDuplicados(lineas) {
  const grupos = new Map()
  for (const linea of lineas) {
    if (!pagaCantidad(linea)) continue
    const k = clave(linea)
    if (!grupos.has(k)) grupos.set(k, [])
    grupos.get(k).push(linea)
  }

  const items = []
  for (const grupo of grupos.values()) {
    if (grupo.length < 2 || !grupo.some(l => l.es_posible_duplicado)) continue
    const importes = grupo.map(l => Number(l.importe_total) || 0)
    const suma = importes.reduce((a, b) => a + b, 0)
    const primera = grupo[0]
    items.push({
      clave: grupo.map(l => l.id).join('-'),
      legajo: primera.legajo_asignado || primera.legajo_campo || '',
      nombre_empleado: primera.nombre_empleado,
      fecha: primera.fecha_tarea,
      lineas: grupo,
      valor: aDosDecimales(suma - Math.max(...importes)),
    })
  }
  return items.sort((a, b) => b.valor - a.valor)
}
