// La fila Total de la Quincena: suma lo que se está viendo, con los filtros
// puestos. Sin React, para poder probarla sola.
//
// Los Decimal del backend llegan como string ('245000.00'): se suman con
// Number(), nunca como texto. Vacío o no numérico suma 0.

// Redondear a dos al final descarta sólo el error de punto flotante, no un
// valor real: en la base son todos Numeric(_, 2).
const aDosDecimales = (n) => Math.round(n * 100) / 100

const hay = (v) => v !== null && v !== undefined && v !== ''

export function totalesGrilla(lineas) {
  // La cantidad se suma sólo si todas las líneas miden lo mismo: viajes con
  // litros, u horas con toneladas, dan un número que no es de nada.
  const medidas = new Set(lineas.map(l => `${l.concepto}|${l.unidad ?? ''}`))
  let cantidad = 0, bins = 0, importe = 0, conBins = false
  for (const l of lineas) {
    cantidad += Number(l.cantidad) || 0
    if (hay(l.bins)) {
      bins += Number(l.bins) || 0
      conBins = true
    }
    // El importe va con su signo: lo que se le descuenta resta, como en la
    // orden de facturación.
    if (hay(l.importe)) importe += (l.signo ?? 1) * (Number(l.importe) || 0)
  }
  return {
    cantidad: lineas.length && medidas.size === 1 ? aDosDecimales(cantidad) : null,
    bins: conBins ? aDosDecimales(bins) : null,
    importe: aDosDecimales(importe),
  }
}
