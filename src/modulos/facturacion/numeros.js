// Números de los Comprobantes: leer lo que se tipea en es-AR, calcular el
// importe de una Línea y mostrar pesos (plan E2, FA1). Los números viajan como
// texto con punto decimal, igual que los Decimal del backend, y nunca pasan por
// un Number: con DECIMAL(14,2) × DECIMAL(14,4) el producto supera 2^53. No
// importa nada, para que lo cargue `node --test`.

// Un decimal como lo manda el backend: signo opcional, punto decimal, sin miles.
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/

// es-AR: el punto separa miles (en grupos de tres, o ninguno) y la coma los
// decimales. "1.5" no se lee: tomarlo como 15 sería peor que avisar.
const ES_AR = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/

/**
 * Lee un número escrito en es-AR ("1.234,56", "$ 1.234,56", "-$ 3,50") y lo
 * devuelve como texto con punto decimal ("1234.56"), o null si no se lee.
 * Que la cantidad sea > 0 o que entren los decimales lo valida la grilla.
 */
export function leerNumero(texto) {
  if (texto == null) return null
  const partes = String(texto).trim().match(/^(-?)\s*(?:\$\s*)?(.+)$/)
  if (!partes) return null
  const [, signo, cuerpo] = partes
  if (!ES_AR.test(cuerpo)) return null
  return signo + cuerpo.replace(/\./g, '').replace(',', '.')
}

// Texto con punto decimal a entero escalado: "2.3333" → { valor: 23333n, escala: 4 }.
function aEscalado(texto) {
  if (texto == null) return null
  const partes = String(texto).trim().match(DECIMAL)
  if (!partes) return null
  const [, signo, enteros, decimales = ''] = partes
  const valor = BigInt(enteros + decimales)
  return { valor: signo ? -valor : valor, escala: decimales.length }
}

/**
 * importe = round(cantidad × precio, 2) con ROUND_HALF_UP (regla 3), en
 * centavos con BigInt. Es la misma cuenta que calcular_importe del backend,
 * con sus mismos casos fijos; la que vale es la del backend, esta es para
 * mostrar mientras se tipea. Devuelve texto con dos decimales ("3.50"), o null
 * si alguno de los dos no es un número.
 */
export function importeDeLinea(cantidad, precio) {
  const a = aEscalado(cantidad)
  const b = aEscalado(precio)
  if (!a || !b) return null

  const producto = a.valor * b.valor
  const escala = a.escala + b.escala
  const negativo = producto < 0n
  const absoluto = negativo ? -producto : producto

  let centavos
  if (escala <= 2) {
    centavos = absoluto * 10n ** BigInt(2 - escala)
  } else {
    // ROUND_HALF_UP de Python: la mitad se aleja del cero, nunca va al par.
    const divisor = 10n ** BigInt(escala - 2)
    centavos = absoluto / divisor
    if ((absoluto % divisor) * 2n >= divisor) centavos += 1n
  }

  const digitos = centavos.toString().padStart(3, '0')
  const signo = negativo && centavos !== 0n ? '-' : ''
  return `${signo}${digitos.slice(0, -2)}.${digitos.slice(-2)}`
}

// Con un texto, Intl formatea el decimal exacto, sin pasar por un Number.
const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

/**
 * Pesos en es-AR con signo: "$ 1.234,56" y, en una Nota de crédito,
 * "-$ 3,50". Recibe el texto del backend o un number. Sin valor, una raya.
 */
export function formatoPesos(valor) {
  if (valor == null) return '—'
  const texto = String(valor).trim()
  if (!DECIMAL.test(texto)) return '—'
  // "-0.00" se muestra sin signo: un total en cero no resta nada.
  const sinCeroNegativo = /^-0+(\.0+)?$/.test(texto) ? texto.slice(1) : texto
  return PESOS.format(sinCeroNegativo)
}
