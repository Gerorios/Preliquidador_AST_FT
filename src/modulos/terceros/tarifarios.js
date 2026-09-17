// Los cinco tarifarios, declarados una sola vez.
//
// Cada uno tiene sus dimensiones —los campos que deciden a qué hechos alcanza—
// y sus valores —lo que la regla resuelve—. La pantalla es una sola y arma sus
// columnas leyendo esto, así que agregar una dimensión es tocar un solo lugar.
//
// `obligatorias` son las dimensiones sin las cuales la regla no se sabe a quién
// aplicarle. Las demás vacías significan "esta regla no discrimina por eso", y
// entre dos reglas que alcanzan al mismo hecho gana la que tiene más cargadas.

export const TARIFARIOS = [
  {
    clave: 'viajes',
    titulo: 'Viajes',
    ayuda: 'Cuánto se le paga un viaje a cada tercero, y si es corto o largo. La combinación habitual es tercero + capataz, porque el capataz identifica adónde va el viaje.',
    dimensiones: [
      { clave: 'tercero', label: 'Tercero', obligatoria: false },
      { clave: 'cliente', label: 'Cliente' },
      { clave: 'finca', label: 'Finca' },
      { clave: 'capataz', label: 'Capataz' },
    ],
    valores: [
      { clave: 'precio', label: 'Precio', tipo: 'pesos' },
      { clave: 'tipo_viaje', label: 'Tipo', tipo: 'opciones', opciones: ['CORTO', 'LARGO'] },
    ],
  },
  {
    clave: 'servicio',
    titulo: 'Horas de servicio',
    ayuda: 'Cuánto se le paga al tercero por el trabajo de su maquinaria. La unidad base dice sobre qué se multiplica el precio: la hora de máquina o la cantidad que midió la tarea.',
    dimensiones: [
      { clave: 'tercero', label: 'Tercero' },
      { clave: 'cliente', label: 'Cliente' },
      { clave: 'finca', label: 'Finca' },
      { clave: 'tarea', label: 'Tarea' },
    ],
    valores: [
      { clave: 'precio', label: 'Precio', tipo: 'pesos' },
      {
        clave: 'unidad_base', label: 'Unidad base', tipo: 'opciones',
        opciones: ['hsmaquina', 'unidades'],
        etiquetas: { hsmaquina: 'Hora de máquina', unidades: 'Cantidad' },
        requerida: true,
      },
    ],
  },
  {
    clave: 'combustible',
    titulo: 'Combustible',
    ayuda: 'Precio por litro que se le descuenta a cada tercero. No depende de la estación ni del tipo de carga.',
    dimensiones: [{ clave: 'tercero', label: 'Tercero', obligatoria: true }],
    valores: [{ clave: 'precio', label: 'Precio por litro', tipo: 'pesos' }],
  },
  {
    clave: 'reparacion',
    titulo: 'Horas de reparación',
    ayuda: 'Precio de la hora de mano de obra del taller, por tercero. Es lo que se le descuenta por arreglarle la máquina.',
    dimensiones: [{ clave: 'tercero', label: 'Tercero', obligatoria: true }],
    valores: [{ clave: 'precio', label: 'Precio por hora', tipo: 'pesos' }],
  },
  {
    clave: 'seguros',
    titulo: 'Seguros',
    ayuda: 'La cuota de cada póliza. No llega por archivo ni sale de ningún sistema: la carga a mano quien tiene los seguros a cargo.',
    dimensiones: [
      { clave: 'tercero', label: 'Tercero', obligatoria: true },
      { clave: 'maquinaria', label: 'Máquina', obligatoria: true },
    ],
    valores: [{ clave: 'importe', label: 'Importe de la cuota', tipo: 'pesos' }],
  },
]

export const tarifarioPorClave = (clave) => TARIFARIOS.find(t => t.clave === clave)
