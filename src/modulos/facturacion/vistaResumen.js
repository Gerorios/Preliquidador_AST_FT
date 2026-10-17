// Textos y formatos de la pantalla del Resumen (plan E3, FA5): la hora de
// lectura del campo, las medidas y la unidad de cada línea, el texto de cada
// cuadro de Alertas y el formulario del pie (Umbral de diferencia y Mes de
// corte). Las filas, los filtros y el orden están en resumen.js (FA3). No
// importa React, para que lo cargue `node --test`.
//
// Las horas llegan en UTC y sin zona, como las demás fechas de alta del
// backend (`creada_en` en detalle.js): se leen como UTC y se muestran con la
// hora de la PC. `zona` sólo la pasan los tests, para no depender de la PC.

import { leerNumero } from './numeros.js'
import { ATAJO_INICIAL, periodoDeAtajo } from './periodo.js'
import { ETIQUETAS } from './unidades.js'

const DECIMAL = /^-?\d+(?:\.\d+)?$/
const CERO = /^-?0+(?:\.0+)?$/
const MES = /^\d{4}-(?:0[1-9]|1[0-2])$/

function leerFechaUtc(texto) {
  if (!texto) return null
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`
  const fecha = new Date(conZona)
  return Number.isNaN(fecha.getTime()) ? null : fecha
}

// Las partes de la fecha y la hora, armadas a mano para que el separador no
// dependa de la versión del navegador: "14/10/2026" y "09:15".
function partes(fecha, zona) {
  const formato = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zona,
  })
  const p = Object.fromEntries(formato.formatToParts(fecha).map(({ type, value }) => [type, value]))
  return { dia: `${p.day}/${p.month}/${p.year}`, hora: `${p.hour}:${p.minute}` }
}

/**
 * La hora de `leido_en` (la lectura más vieja del campo que usa la pantalla),
 * "10:42", para "Datos del campo de las HH:MM". Sin una fecha que se lea, null.
 */
export function horaDeLectura(leidoEn, zona) {
  const fecha = leerFechaUtc(leidoEn)
  return fecha ? partes(fecha, zona).hora : null
}

/** Si una medida no se lee como número: vacía o ilegible. El cero sí se lee. */
export function medidaIlegible(valor) {
  return !DECIMAL.test(String(valor ?? '').trim())
}

/** Si una medida o el neto no tienen nada que mostrar: cero, vacío o ilegible. */
export function medidaVacia(valor) {
  return medidaIlegible(valor) || CERO.test(String(valor).trim())
}

// Con un texto, Intl formatea el decimal exacto, sin pasar por un Number (como
// numeros.js).
const MEDIDA = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/**
 * Una medida del campo en es-AR, hasta dos decimales y sin ceros de más:
 * "1739.00" da "1.739" y "120.50" da "120,5". Lo que no tiene nada que
 * mostrar (medidaVacia) es una raya. Con `conCero` (el Detalle, que compara
 * Campo contra Facturado) el cero se muestra, "0", y la raya queda sólo para
 * lo vacío o ilegible (medidaIlegible).
 */
export function textoMedida(valor, { conCero = false } = {}) {
  const raya = conCero ? medidaIlegible(valor) : medidaVacia(valor)
  return raya ? '—' : MEDIDA.format(String(valor).trim())
}

// El texto de cada cuadro de Alertas. Cada cuadro cuenta filas (mes y
// Cliente), y el texto lo dice: con varios meses, un Cliente pendiente en dos
// meses suma 2 (revisión de la E3a; el boceto F0 decía "clientes").
const TEXTOS_CUADRO = {
  pendiente_de_facturar: ['mes de cliente pendiente de facturar', 'meses de cliente pendientes de facturar'],
  con_diferencia: ['mes de cliente con diferencia', 'meses de cliente con diferencia'],
  falta_comprobante: ['mes de cliente con facturas sin PDF', 'meses de cliente con facturas sin PDF'],
}

/** El texto junto al número de un cuadro, en singular sólo con 1. */
export function textoDeCuadro(clave, cantidad) {
  const [uno, varios] = TEXTOS_CUADRO[clave] ?? ['', '']
  return cantidad === 1 ? uno : varios
}

const UMBRAL_PIE = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
const UMBRAL_CAMPO = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const textoDecimal = valor => {
  const texto = String(valor ?? '').trim()
  return DECIMAL.test(texto) ? texto : null
}

/** El Umbral en el texto del pie: "5 %", "2,5 %". Sin un número, null. */
export function textoUmbral(umbral) {
  const texto = textoDecimal(umbral)
  return texto ? `${UMBRAL_PIE.format(texto)} %` : null
}

/** El Umbral en su campo del formulario: "5,00". Sin un número, vacío. */
export function umbralParaEditar(umbral) {
  const texto = textoDecimal(umbral)
  return texto ? UMBRAL_CAMPO.format(texto) : ''
}

/**
 * Lo que escribió el Admin, listo para PUT /api/facturacion/configuracion:
 * `{ datos: { umbral_pct, mes_corte }, errores: {} }`, con el Umbral con
 * punto decimal ("5,00" da "5.00"). Si algo no se lee, `datos` es null y
 * `errores` trae el mensaje de cada campo. Si es mayor que 0, hasta 100 y no
 * posterior al mes en curso lo controla el backend, que manda (422
 * `configuracion_invalida`).
 */
export function leerConfiguracion(umbralTexto, mesCorte) {
  const errores = {}
  const umbral = leerNumero(umbralTexto)
  if (umbral == null) errores.umbral_pct = 'Escribí un número, por ejemplo 5,00.'
  if (!MES.test(mesCorte ?? '')) errores.mes_corte = 'Elegí el Mes de corte.'
  if (Object.keys(errores).length) return { datos: null, errores }
  return { datos: { umbral_pct: umbral, mes_corte: mesCorte }, errores }
}

/**
 * "Último cambio: quién, dd/mm/aaaa hh:mm" de la configuración, o sólo el
 * cuándo si no se sabe quién. Sin cuándo (nadie la cambió todavía), null.
 */
export function textoUltimoCambio(configuracion, zona) {
  const fecha = leerFechaUtc(configuracion?.actualizado_en)
  if (!fecha) return null
  const { dia, hora } = partes(fecha, zona)
  const quien = configuracion.actualizado_por_nombre
  return `Último cambio: ${quien ? `${quien}, ` : ''}${dia} ${hora}`
}

// "Otro período" no es un atajo de periodo.js: es elegir Desde y Hasta a mano.
export const OTRO_PERIODO = 'otro'

/**
 * El período que pide la pantalla, `{ desde, hasta }` en "AAAA-MM-DD", según lo
 * elegido en la barra (`{ atajo, desde?, hasta? }`). Un atajo se calcula con
 * `hoy` cada vez, así "Mes pasado" sigue siendo el mes pasado al volver otro
 * día; "Otro período" usa Desde y Hasta tal cual (si es válido lo dice
 * rangoValido). Un atajo que no existe vuelve al inicial.
 */
export function periodoElegido(valor, hoy) {
  if (valor?.atajo === OTRO_PERIODO) return { desde: valor.desde ?? '', hasta: valor.hasta ?? '' }
  return periodoDeAtajo(valor?.atajo, hoy) ?? periodoDeAtajo(ATAJO_INICIAL, hoy)
}

/**
 * La unidad de una línea del Resumen: su etiqueta ("Horas de peón"). Sin
 * unidad (las tareas del grupo no tienen Unidad sugerida), "Sin Unidad
 * sugerida"; una clave que no conoce, tal cual.
 */
export function textoUnidad(unidad) {
  if (unidad == null || unidad === '') return 'Sin Unidad sugerida'
  return ETIQUETAS[unidad] ?? unidad
}
