// En qué punto está cada orden, deducido de lo que tiene. No se guarda un
// estado aparte: sería otro dato que puede quedar diciendo algo distinto de lo
// que la orden tiene cargado.
//
// Son los cuatro que distingue quien liquida, en el orden del trabajo.
// «Pendiente de pago» junta todo lo emitido que no se terminó de pagar —sin
// factura, con la factura por revisar o rechazada, aprobada, pagada en parte—:
// qué falta lo dice el diálogo de cada tercero, con el botón que corresponde.
//
// `sinTarjeta`: una orden sin nada no es trabajo. Se la muestra sólo si arrastra
// un saldo o le llegó algo tarde, y no tiene tarjeta propia.

export const ESTADOS_RECIBO = {
  pendientes: { label: 'Con líneas sin precio', alerta: true },
  para_emitir: { label: 'Para emitir' },
  pendiente_pago: { label: 'Pendiente de pago' },
  pagado: { label: 'Pagada' },
  vacio: { label: 'Sin nada que liquidar', sinTarjeta: true },
}

export function estadoDe(r) {
  if (!r.emitido) {
    if (r.pendientes) return 'pendientes'
    const nada = !Number(r.total_a_facturar) && !Number(r.seguros)
    return nada ? 'vacio' : 'para_emitir'
  }
  return r.pago === 'TOTAL' ? 'pagado' : 'pendiente_pago'
}

// Una orden que no tiene nada que hacer: ni importe, ni seguros, ni saldo que
// arrastrar, ni algo que le llegó tarde.
export const sinNadaQueHacer = (r) =>
  estadoDe(r) === 'vacio' && !Number(r.saldo_anterior) && !(r.llegadas > 0)

// A quién se le puede facturar. Es la misma lista cerrada que valida el
// backend, y se elige en cada recibo porque cambia de una quincena a otra.
export const EMPRESAS = ['La Asturiana', 'Pamplona', 'Baleares', 'La Sevilla']

// De qué puede ser un ajuste, en el orden del recibo. Es la misma lista que
// valida el backend; «otro» es para lo que no es de ninguno.
export const AJUSTE_CONCEPTOS = {
  viajes: 'Viajes',
  servicio: 'Horas de servicio',
  combustible: 'Combustible',
  repuestos: 'Repuestos',
  reparacion: 'Horas de reparación',
  otro: 'Otro',
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// '2026-08-16' → '2da de agosto 2026', igual que el backend.
export function nombreQuincena(iso) {
  if (!iso) return ''
  const [anio, mes, dia] = iso.split('-').map(Number)
  return `${dia <= 15 ? '1ra' : '2da'} de ${MESES[mes - 1]} ${anio}`
}
