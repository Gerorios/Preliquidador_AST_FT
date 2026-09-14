// Cómo se muestran los números y las fechas del módulo. En un solo lugar para
// que las cuatro pantallas no escriban cada una su variante: el liquidador
// compara columnas entre pantallas y dos formatos distintos se leen como dos
// datos distintos.

const numero = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 })
const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 })

const vacio = (v) => v === null || v === undefined || v === ''

export const comoNumero = (v) => vacio(v) ? '' : numero.format(Number(v))
export const comoEntero = (v) => vacio(v) ? '' : entero.format(Number(v))
export const comoPesos = (v) => vacio(v) ? '' : pesos.format(Number(v))

// Las horas se escriben con los decimales que tengan: media hora es 0,5 y
// mostrarla como "1" sería mentir sobre lo que se cobra.
export const comoHoras = (v) => vacio(v) ? '' : Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })

// Las fechas llegan del backend como AAAA-MM-DD; se muestran como se leen acá.
// Se parte el texto en vez de usar Date() porque `new Date('2026-08-01')` se
// interpreta en UTC y en Argentina retrocede un día.
export const comoFecha = (v) => {
  if (vacio(v)) return ''
  const [a, m, d] = String(v).slice(0, 10).split('-')
  return d ? `${d}/${m}/${a}` : String(v)
}

// La patente viene del sistema de campo con espacios de más (' FAP480').
export const comoPatente = (v) => vacio(v) ? '' : String(v).trim()
