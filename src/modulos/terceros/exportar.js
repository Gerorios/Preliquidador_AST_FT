// Bajar lo que se está viendo a una planilla.
//
// Es CSV y no .xlsx por dos razones. La primera es que el front no tiene
// librería de Excel y las dependencias nuevas se aprueban antes de agregarse
// (regla de stack de GUIA-MODULOS). La segunda pesa más: armándolo acá, lo que
// se baja es **exactamente lo que está en pantalla**, con los filtros puestos.
// Generándolo en el servidor habría que mandarle los filtros y aplicarlos de
// nuevo, y dos implementaciones del mismo filtro terminan dando distinto.
//
// Sale con `;` y con coma decimal porque así lo espera el Excel en español: con
// coma de separador, un importe como 1.234,56 se parte en dos columnas.

const BOM = '﻿'   // sin esto Excel lee los acentos como símbolos

const celda = (valor) => {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

// Los números van con coma decimal y sin separador de miles: el de miles lo
// pone Excel al mostrarlos, y si viene en el archivo lo lee como texto.
export const comoNumeroCsv = (v) =>
  v === null || v === undefined || v === '' ? '' : String(v).replace('.', ',')

/**
 * @param {string} nombre     sin extensión
 * @param {Array}  columnas   [{ label, valor: (fila) => any }]
 * @param {Array}  filas
 */
export function bajarCsv(nombre, columnas, filas) {
  const lineas = [
    columnas.map(c => celda(c.label)).join(';'),
    ...filas.map(f => columnas.map(c => celda(c.valor(f))).join(';')),
  ]
  const blob = new Blob([BOM + lineas.join('\r\n')],
                        { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nombre}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
