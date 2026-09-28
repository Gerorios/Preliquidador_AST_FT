import { comoFecha, comoNumero, comoPesos } from './formato'

// Qué columnas muestra la grilla según lo que se esté mirando.
//
// **No es una sola tabla con todas las columnas.** Un repuesto no tiene capataz
// y un combustible no tiene finca; dejarlas en blanco obliga a barrer con la
// vista diez columnas vacías para llegar al importe. Cuando se elige un
// concepto se muestran sólo las columnas que ese concepto usa.
//
// Por lo mismo, en la vista de un concepto **no va la columna Concepto** —dice
// lo mismo que el filtro de arriba— ni la de Unidad cuando es siempre la misma:
// en Viajes todas las filas dicen "viaje". La única donde Unidad importa es
// Horas de servicio, porque ahí la tarifa elige entre hora de máquina y
// cantidad, y cuál eligió cambia lo que se cobra.

// El orden en que se lee una liquidación: primero lo que se le paga al tercero,
// después lo que se le descuenta. Es el mismo del recibo
// —Viajes + Horas de servicio − Combustible − Repuestos − Horas de reparación −
// Seguros— y por eso es el de los botones de arriba. El orden en que aparecen
// las filas es por fecha, que para elegir un concepto no significa nada.
export const ORDEN_CONCEPTOS = [
  'viajes', 'servicio', 'combustible', 'repuestos', 'reparacion', 'seguros',
]

const FECHA    = { clave: 'fecha', label: 'Fecha', formato: comoFecha, ancho: 92 }
const TERCERO  = { clave: 'tercero', label: 'Tercero', ancho: 180 }
const CLIENTE  = { clave: 'cliente', label: 'Cliente', ancho: 130 }
const FINCA    = { clave: 'finca', label: 'Finca', ancho: 130 }
const CAPATAZ  = { clave: 'capataz', label: 'Capataz', ancho: 170 }
const TAREA    = { clave: 'tarea', label: 'Tarea', ancho: 170 }
const PATENTE  = { clave: 'patente', label: 'Patente', ancho: 88 }
const MAQUINA  = { clave: 'maquina', label: 'Máquina', ancho: 210 }
const PRECIO   = { clave: 'precio', label: 'Precio', align: 'right', formato: comoPesos, ancho: 120 }
const IMPORTE  = { clave: 'importe', label: 'Importe', align: 'right', tipo: 'importe', ancho: 130 }
const ESTADO   = { clave: 'estado', label: 'Estado', tipo: 'estado', ancho: 120 }

// Las unidades se muestran como se dicen. 'hsmaquina' es el valor que guarda
// la base —el mismo que usa Preliquidación— y no algo para leer en una tabla.
const UNIDADES = { hsmaquina: 'Hora máquina', unidades: 'Cantidad' }
const comoUnidad = (v) => UNIDADES[v] ?? v ?? ''

const cantidad = (label, ancho = 88) =>
  ({ clave: 'cantidad', label, align: 'right', formato: comoNumero, ancho })

export const COLUMNAS = {
  // La vista de todos junta conceptos que no comparten columnas, así que acá sí
  // hace falta un resumen: es el único lugar donde una sola columna tiene que
  // servir para un viaje y para una póliza.
  todos: [
    FECHA,
    { clave: 'concepto_label', label: 'Concepto', ancho: 130 },
    TERCERO, CLIENTE, FINCA, CAPATAZ,
    { clave: 'resumen', label: 'Detalle', calculado: resumen },
    cantidad('Cantidad'),
    { clave: 'unidad', label: 'Unidad', formato: comoUnidad, ancho: 70 },
    PRECIO, IMPORTE, ESTADO,
  ],

  viajes: [
    FECHA, TERCERO, PATENTE,
    { clave: 'chofer', label: 'Chofer', ancho: 180 },
    CLIENTE, FINCA, CAPATAZ, TAREA,
    // El tipo lo resuelve la tarifa, no el origen: hasta que no se calcula, un
    // viaje no es corto ni largo. Por eso va al lado del precio.
    { clave: 'tipo_viaje', label: 'Tipo', ancho: 72 },
    cantidad('Viajes', 72),
    PRECIO, IMPORTE, ESTADO,
  ],

  combustible: [
    FECHA, TERCERO, PATENTE,
    { clave: 'estacion', label: 'Estación', ancho: 160 },
    { clave: 'vale', label: 'Vale', ancho: 80 },
    cantidad('Litros'),
    // El campo libre del sistema de campo. Va acá porque es lo que explica una
    // carga rara sin tener que ir a preguntarle a quien la cargó.
    { clave: 'observacion', label: 'Comentario' },
    { ...PRECIO, label: 'Precio por litro' },
    IMPORTE, ESTADO,
  ],

  servicio: [
    FECHA, TERCERO, MAQUINA,
    { clave: 'planilla', label: 'Planilla', ancho: 110 },
    CLIENTE, FINCA, TAREA,
    { clave: 'supervisor', label: 'Supervisor', ancho: 170 },
    cantidad('Cantidad'),
    // Acá sí: la tarifa elige entre hora de máquina y cantidad, y cuál eligió
    // es lo que explica el importe.
    { clave: 'unidad', label: 'Se paga por', formato: comoUnidad, ancho: 110 },
    PRECIO, IMPORTE, ESTADO,
  ],

  repuestos: [
    FECHA, TERCERO, MAQUINA,
    { clave: 'repuesto', label: 'Repuesto', ancho: 220 },
    { clave: 'rubro', label: 'Rubro', ancho: 140 },
    cantidad('Cantidad'),
    // Sin columna de precio: el importe viene calculado del sistema de compras
    // y no hay un precio pactado con el tercero que mostrar.
    IMPORTE, ESTADO,
  ],

  reparacion: [
    FECHA, TERCERO, MAQUINA,
    { clave: 'rubro', label: 'Rubro', ancho: 140 },
    { clave: 'sub_rubro', label: 'Sub-rubro', ancho: 200 },
    FINCA,
    // El del taller (Aprobado / Pendiente). Es el que decide si se cobra, así
    // que va en su columna y no escondido en el estado del cálculo.
    { clave: 'estado_taller', label: 'Taller', ancho: 92 },
    cantidad('Horas', 72),
    PRECIO, IMPORTE, ESTADO,
  ],

  seguros: [
    TERCERO,
    { clave: 'sujeto', label: 'Máquina o chofer', ancho: 220 },
    { clave: 'referencia', label: 'Patente o CUIL', ancho: 130 },
    { clave: 'tipo_seguro', label: 'Tipo de póliza', ancho: 170 },
    IMPORTE, ESTADO,
  ],
}

// Cómo se resume una línea en la vista de todos: lo que la identifica, en el
// orden en que uno la reconocería de un vistazo.
const PARTES = {
  viajes: f => [f.patente, f.chofer, f.tipo_viaje],
  combustible: f => [f.patente, f.estacion, f.vale && `vale ${f.vale}`, f.observacion],
  servicio: f => [f.maquina, f.planilla],
  repuestos: f => [f.maquina, f.repuesto, f.rubro],
  reparacion: f => [f.maquina, f.sub_rubro, f.estado_taller],
  seguros: f => [f.sujeto, f.referencia, f.tipo_seguro],
}

export function resumen(fila) {
  return (PARTES[fila.concepto]?.(fila) ?? []).filter(Boolean).join(' · ')
}

export const columnasDe = (concepto) => COLUMNAS[concepto] ?? COLUMNAS.todos

// El valor que muestra una columna, ya sea un campo de la fila o algo compuesto.
export const valorDe = (columna, fila) =>
  columna.calculado ? columna.calculado(fila) : fila[columna.clave]

// ─── Por qué se puede filtrar en cada concepto ──────────────────────────────
//
// No son todas las columnas: filtrar por fecha o por importe no sirve para
// nada —para eso está ordenar— y filtrar por tercero tampoco, porque el tercero
// es el maestro y vive arriba de los conceptos.
//
// Cada lista está en el orden en que uno acota: primero lo que más corta.

export const FILTROS_POR_CONCEPTO = {
  todos: [
    ['cliente', 'Cliente'], ['finca', 'Finca'],
    ['capataz', 'Capataz'], ['estado', 'Estado'],
  ],
  viajes: [
    ['cliente', 'Cliente'], ['finca', 'Finca'], ['patente', 'Patente'],
    ['capataz', 'Capataz'], ['tarea', 'Tarea'], ['estado', 'Estado'],
  ],
  servicio: [
    ['cliente', 'Cliente'], ['finca', 'Finca'], ['tarea', 'Tarea'],
    ['supervisor', 'Supervisor'], ['maquina', 'Máquina'], ['estado', 'Estado'],
  ],
  combustible: [
    ['patente', 'Patente'], ['estacion', 'Estación'], ['vale', 'Vale'],
    ['estado', 'Estado'],
  ],
  repuestos: [
    ['maquina', 'Máquina'], ['repuesto', 'Repuesto'], ['estado', 'Estado'],
  ],
  reparacion: [
    ['finca', 'Finca'], ['maquina', 'Máquina'], ['estado', 'Estado'],
  ],
  seguros: [
    ['sujeto', 'Máquina o chofer'], ['referencia', 'Patente o CUIL'],
    ['tipo_seguro', 'Tipo de póliza'],
  ],
}

export const filtrosDe = (concepto) =>
  FILTROS_POR_CONCEPTO[concepto] ?? FILTROS_POR_CONCEPTO.todos
