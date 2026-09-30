// En qué punto está cada recibo, deducido de lo que tiene. No se guarda un
// estado aparte: sería otro dato que puede quedar diciendo algo distinto de lo
// que el recibo tiene cargado.
//
// El orden es el del trabajo: lo que falta resolver antes de emitir, lo que se
// espera del tercero, lo que hay que revisar, y lo que queda por pagar.

export const ESTADOS_RECIBO = {
  pendientes: { label: 'Con líneas sin precio', alerta: true },
  para_emitir: { label: 'Para emitir' },
  sin_factura: { label: 'Esperando factura' },
  factura_recibida: { label: 'Factura por revisar', alerta: true },
  factura_rechazada: { label: 'Factura rechazada', alerta: true },
  por_pagar: { label: 'Por pagar' },
  pago_parcial: { label: 'Pagado en parte' },
  pagado: { label: 'Pagado' },
  vacio: { label: 'Sin nada que liquidar' },
}

export function estadoDe(r) {
  if (!r.emitido) {
    if (r.pendientes) return 'pendientes'
    const nada = !Number(r.total_a_facturar) && !Number(r.seguros)
    return nada ? 'vacio' : 'para_emitir'
  }
  if (r.pago === 'TOTAL') return 'pagado'
  if (r.pago === 'PARCIAL') return 'pago_parcial'
  if (r.factura_estado === 'APROBADA') return 'por_pagar'
  if (r.factura_estado === 'RECHAZADA') return 'factura_rechazada'
  if (r.factura_estado === 'RECIBIDA') return 'factura_recibida'
  return 'sin_factura'
}

// A quién se le puede facturar. Es la misma lista cerrada que valida el
// backend, y se elige en cada recibo porque cambia de una quincena a otra.
export const EMPRESAS = ['La Asturiana', 'Pamplona', 'Baleares', 'La Sevilla']

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// '2026-08-16' → '2da de agosto 2026', igual que el backend.
export function nombreQuincena(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-').map(Number)
  return `${dia <= 15 ? '1ra' : '2da'} de ${MESES[mes - 1]} ${anio}`
}
