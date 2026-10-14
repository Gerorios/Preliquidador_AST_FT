import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Un solo formato de quincena en todo el módulo: "1ra quincena septiembre 2026".
// `fecha` es la fecha ISO de inicio de la quincena (día 1 o 16).
export function formatoQuincena(fecha) {
  if (!fecha) return '—'
  const d = new Date(fecha + 'T00:00:00')
  const q = d.getDate() === 1 ? '1ra' : '2da'
  return `${q} quincena ${format(d, 'MMMM yyyy', { locale: es })}`
}
