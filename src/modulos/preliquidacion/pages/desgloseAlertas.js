// Desglose de las alertas de una quincena para el historial: qué tipo de
// alerta es, cuántas líneas la tienen y qué quiere decir. Una línea puede
// tener más de una alerta, así que la suma del desglose puede superar al total
// de líneas con alerta. Las cantidades vienen en el item del listado de
// quincenas (`GET /preliquidacion/`); un item sin esos campos (backend viejo)
// da un desglose vacío.

const TIPOS = [
  {
    clave: 'incompletas',
    etiqueta: ['incompleta', 'incompletas'],
    tono: 'danger',
    explicacion: 'Sin concepto o sin precio: no pagan nada hasta cargar la regla en Conceptos.',
  },
  {
    clave: 'duplicados',
    etiqueta: ['duplicada', 'duplicadas'],
    tono: 'danger',
    explicacion: 'Igual a otra línea en todo lo que trae del campo: es una carga repetida y se corrige en el campo.',
  },
  {
    clave: 'posibles_duplicados',
    etiqueta: ['posible duplicado', 'posibles duplicados'],
    tono: 'warn',
    explicacion: 'Igual a otra línea salvo en las horas: puede ser una doble carga o dos trabajos reales.',
  },
  {
    clave: 'alerta_legajo',
    etiqueta: ['legajo inválido', 'legajo inválido'],
    tono: 'warn',
    explicacion: 'El legajo no se pudo confirmar en el padrón de sueldos de la empresa: revisar a quién se le paga.',
  },
  {
    clave: 'sin_empresa',
    etiqueta: ['sin empresa', 'sin empresa'],
    tono: 'warn',
    explicacion: 'Sin empresa asignada: no se sabe por qué empresa se liquida.',
  },
]

export function desgloseAlertas(item) {
  if (!item) return []
  return TIPOS
    .map(t => {
      const cantidad = Number(item[t.clave]) || 0
      return { ...t, cantidad, etiqueta: t.etiqueta[cantidad === 1 ? 0 : 1] }
    })
    .filter(t => t.cantidad > 0)
}
