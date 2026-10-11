// Descripción de la tarjeta de Preliquidación en el Inicio, según las pantallas
// del menú que la persona ve (plan del esquema de permisos, respuesta 6). Pura:
// recibe esas entradas ya filtradas (`menuDe` de src/core/accesos.js), en el
// orden del menú. Revisión y la Vista gerencial no están en el menú, así que no
// cuentan.
//
// - Ve Inicio: el texto de siempre del Preliquidador.
// - Sólo ve Conceptos: el texto de siempre del gerente.
// - Si no: "Pantallas: " y la lista de las que ve.
//
// Sin entradas no hay tarjeta del módulo (`tarjetasDe` no la arma), así que ese
// caso no llega acá; devuelve '' para no inventar un texto.

const TEXTO_INICIO = 'Sueldos por quincena: generar, revisar, verificar y exportar.'
const TEXTO_CONCEPTOS = 'Maestro de conceptos y precios por quincena.'

// "A", "A y B", "A, B y C".
const enumerar = (nombres) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`

export const descripcionTarjeta = (entradas) => {
  const lista = entradas ?? []
  if (lista.length === 0) return ''
  if (lista.some(e => e.pantalla === 'inicio')) return TEXTO_INICIO
  if (lista.length === 1 && lista[0].pantalla === 'conceptos') return TEXTO_CONCEPTOS
  return `Pantallas: ${enumerar(lista.map(e => e.label))}.`
}
