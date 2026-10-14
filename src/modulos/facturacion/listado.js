// Filas del listado de Comprobantes (plan E2, FA3): lo que necesita la barra
// común del núcleo (FiltrosBar) para filtrar y buscar, y los textos de la
// columna del número. No importa React, para que lo cargue `node --test`.
//
// La barra lee cada filtro con `fila[campo.field]` y arma las opciones con los
// valores tal cual (opcionesCascada saltea los vacíos). Por eso cada campo
// apunta a un texto ya armado para el usuario ("Sin empresa", "ago 2025",
// "Nota de crédito"), que `filaDelListado` le suma a la fila de la API sin
// tocar sus campos originales.
//
// La barra ordena las opciones como texto salvo que el campo traiga `orden`
// (plan E2, FA3b): el Mes lo trae, para ir por fecha y no "abr 2026, ago 2025".

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "ago 2025" a un número que crece con la fecha (año * 12 + mes), con la
// misma tabla que arma el texto. Un texto que no es un mes da -1.
function claveMes(texto) {
  const partes = /^([a-z]{3}) (\d{4})$/.exec(texto ?? '')
  const indice = partes ? MESES.indexOf(partes[1]) : -1
  return indice < 0 ? -1 : Number(partes[2]) * 12 + indice
}

// Del mes más nuevo al más viejo; lo que no es un mes va al final.
const delMesMasNuevo = (a, b) => claveMes(b) - claveMes(a)

export const CAMPOS_COMPROBANTES = [
  { key: 'cliente', label: 'Cliente', field: 'cliente_nombre' },
  { key: 'empresa', label: 'Empresa emisora', field: 'empresa_texto' },
  { key: 'tipo', label: 'Tipo', field: 'tipo_texto' },
  { key: 'mes', label: 'Mes', field: 'mes_texto', orden: delMesMasNuevo },
  { key: 'adjunto', label: 'Adjunto', field: 'adjunto_texto' },
]

// Botones de alerta de la barra. Un histórico no genera la Alerta "sin
// comprobante" (glosario de Facturación), así que nunca entra en "Sin adjunto".
export const ALERTAS_COMPROBANTES = [
  { value: 'sin_adjunto', label: 'Sin adjunto', tono: 'warn' },
]

const TIPOS = { factura: 'Factura', nota_credito: 'Nota de crédito' }

const SIN_ADJUNTO = 'Sin adjunto'
const CON_ADJUNTO = 'Con adjunto'

const sinAdjunto = f => !f.es_historico && f.cantidad_adjuntos === 0

const ALERTA = {
  sin_adjunto: sinAdjunto,
}

// "2025-08" (el `mes` de la API: el de la primera Línea) a "ago 2025". Con
// una tabla fija y no con Intl, para que el texto no cambie según la versión
// del navegador.
export function textoMes(mes) {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes ?? '')
  if (!partes) return null
  const nombre = MESES[Number(partes[2]) - 1]
  return nombre ? `${nombre} ${partes[1]}` : null
}

// Valor del campo Adjunto. Un histórico sin adjuntos queda sin valor: no es
// "Sin adjunto" (no genera la Alerta) y tampoco tiene uno.
function textoAdjunto(f) {
  if (f.cantidad_adjuntos > 0) return CON_ADJUNTO
  return f.es_historico ? null : SIN_ADJUNTO
}

// La fila de la API (`ComprobanteFila`) con los textos que usan la barra y
// la tabla. `numero_texto` es lo que va en la columna del número y `etiqueta`
// la marca de un histórico Pendiente de facturar (null si no la lleva).
export function filaDelListado(f) {
  return {
    ...f,
    empresa_texto: f.empresa_emisora || (f.es_historico ? 'Sin empresa' : null),
    tipo_texto: TIPOS[f.tipo] ?? f.tipo,
    mes_texto: textoMes(f.mes),
    adjunto_texto: textoAdjunto(f),
    numero_texto: f.numero || 'Sin número',
    etiqueta: f.pendiente_de_facturar ? 'Pendiente de facturar' : null,
  }
}

// Búsqueda (por número o Cliente, sin distinguir mayúsculas) y Alerta. Va
// aparte de los campos porque la barra la necesita sola, como `prefiltro`:
// las opciones de cada filtro salen sólo de lo que ya pasa por acá.
export function pasaBusquedaYAlertas(fila, busqueda, filtros) {
  if (busqueda) {
    const q = busqueda.toLowerCase()
    const coincide = [fila.numero, fila.cliente_nombre].some(v => v?.toLowerCase().includes(q))
    if (!coincide) return false
  }
  if (filtros.alerta && !ALERTA[filtros.alerta]?.(fila)) return false
  return true
}

export function pasaCampos(fila, filtros, campos = CAMPOS_COMPROBANTES) {
  return campos.every(c => !filtros[c.key]?.length || filtros[c.key].includes(fila[c.field]))
}

// Las filas (ya pasadas por filaDelListado) que quedan con la búsqueda y los
// filtros de la barra, en el orden en que vinieron.
export function filtrarComprobantes(filas, busqueda, filtros, campos = CAMPOS_COMPROBANTES) {
  return filas.filter(f => pasaBusquedaYAlertas(f, busqueda, filtros) && pasaCampos(f, filtros, campos))
}
