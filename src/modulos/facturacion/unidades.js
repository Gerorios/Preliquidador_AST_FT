// Unidades de facturación del front. Es el espejo de
// app/modulos/facturacion/unidades.py (plan E1, D5): la clave es la del backend
// y la etiqueta vive en el código. La Unidad sugerida de cada tarea se define en
// el sistema de campo y el módulo la lee; acá quedan las claves y las etiquetas,
// que usa la grilla de la E2. No importa nada, para que lo cargue `node --test`.

export const UNIDADES = [
  'horas_peon', 'horas_tractor', 'plantas', 'hectareas', 'tancadas',
  'bins', 'bins_c', 'bins_m', 'viajes',
]

// Las de cosecha: lo facturado en una de estas queda fuera del Cruce y de las
// alertas.
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
