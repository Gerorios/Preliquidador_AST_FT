// Lógica pura de la fila TOTAL de la tabla de Revisión. Sin React: recibe las
// líneas visibles (ya filtradas) y suma las cinco columnas numéricas. Las
// duplicadas suman como cualquier otra: el total coincide con lo que está en
// pantalla.

// Los Decimal del backend llegan como string ('12.50'): se suman siempre con
// Number(), nunca como texto ('10.5' + '2' = '10.52'). Vacío o no numérico
// suma 0.

const CAMPOS = ['hsjornal', 'hsmaquina', 'tancadas', 'unidades', 'importe_total']

// Las cinco columnas son Numeric(_, 2) en la base: la suma exacta tiene a lo
// sumo dos decimales. Redondear a dos al final descarta sólo el error de punto
// flotante (0.1 + 0.2 = 0.30000000000000004), no un valor real.
const aDosDecimales = (n) => Math.round(n * 100) / 100

export function totalesLineas(lineas) {
  const totales = Object.fromEntries(CAMPOS.map(c => [c, 0]))
  for (const linea of lineas) {
    for (const campo of CAMPOS) totales[campo] += Number(linea[campo]) || 0
  }
  for (const campo of CAMPOS) totales[campo] = aDosDecimales(totales[campo])
  return totales
}
