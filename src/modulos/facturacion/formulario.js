// El formulario del alta y la edición de un Comprobante (plan E2, FA6): pasar
// el detalle de la API al estado de la pantalla y de vuelta a la entrada del
// POST y el PUT, validar antes de mandar, leer el error que vuelve y buscar
// tareas para el autocompletar. No importa React, para que lo cargue
// `node --test`.
//
// En el estado, los números son el texto que se tipea en es-AR ("1.234,5") y
// cada fila lleva una `clave` propia: el orden de las filas cambia al quitar
// una, y el error que vuelve de la API (`linea_invalida`, con la fila desde 1
// entre las enviadas) se lleva a la clave para marcar la fila correcta.

import { leerNumero } from './numeros.js'
import { validarLinea } from './lineas.js'

// Largo de la columna `numero` del backend (LARGO_NUMERO).
const LARGO_NUMERO = 30

let ultimaClave = 0
const nuevaClave = () => `fila-${++ultimaClave}`

function vacio(valor) {
  return valor == null || String(valor).trim() === ''
}

/**
 * Un decimal como lo manda el backend ("1234.50", "98.1234") en es-AR, para
 * editarlo: con punto de miles, coma decimal y sin los ceros del final
 * ("1.234,5"). Lo vuelve a leer `leerNumero` tal cual. Sin valor, texto vacío.
 */
export function aTextoArgentino(decimal) {
  if (decimal == null) return ''
  const partes = String(decimal).trim().match(/^(-?)(\d+)(?:\.(\d+))?$/)
  if (!partes) return ''
  const [, signo, enteros, decimales = ''] = partes
  const miles = enteros.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sinCeros = decimales.replace(/0+$/, '')
  return `${signo}${miles}${sinCeros ? `,${sinCeros}` : ''}`
}

/**
 * "2026-10-05" a "05/10/2026" partiendo el texto: con `new Date` la zona
 * horaria puede correr el día. Sin fecha, null.
 */
export function textoFecha(fecha) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : null
}

/** Una fila nueva, con la fecha que se le pase (la de la fila anterior). */
export function filaVacia(fecha = '') {
  return {
    clave: nuevaClave(),
    fecha,
    tarea_id: null,
    tarea_nombre: '',
    unidad: '',
    unidadTocada: false,
    finca_id: null,
    finca_nombre: null,
    cantidad: '',
    precio_unitario: '',
  }
}

/**
 * Una fila sin tarea, cantidad ni precio no se manda: es la que quedó de más
 * al final. La fecha, la unidad y la finca no cuentan, porque pueden venir
 * puestas solas (la fecha copiada de la fila anterior).
 */
export function filaEstaVacia(fila) {
  return fila.tarea_id == null && vacio(fila.cantidad) && vacio(fila.precio_unitario)
}

// ─── Quitar y deshacer ───
//
// Quitar una línea se puede deshacer (revisión de FT-A, RA1): un Enter de más
// en Quitar no puede perder una línea cargada. Cada quitar devuelve la fila y
// su índice; la pantalla los apila en el orden en que se quitaron. Deshacer
// devuelve esa fila y todas las que se quitaron después, de la más nueva a la
// más vieja: así cada una vuelve a un índice que es el que tenía, y dos
// quitadas seguidas vuelven en su orden se deshagan como se deshagan. Entre
// quitar y deshacer las filas sólo pueden sumarse al final, que no corre esos
// índices; por eso también se apilan las filas vacías (sin aviso): si no, una
// vacía quitada más arriba correría el lugar de las otras.

/**
 * Saca la fila de esa clave. Devuelve las `filas` que quedan y la `quitada`,
 * { fila, indice }, para deshacer; null si la clave no está.
 */
export function quitarFila(filas, clave) {
  const indice = filas.findIndex(f => f.clave === clave)
  if (indice < 0) return { filas, quitada: null }
  return {
    filas: [...filas.slice(0, indice), ...filas.slice(indice + 1)],
    quitada: { fila: filas[indice], indice },
  }
}

/**
 * Vuelve a poner la fila quitada en su índice (al final si ya no hay tantas).
 * Si la fila ya está, no la repite.
 */
export function restaurarFila(filas, { fila, indice }) {
  if (filas.some(f => f.clave === fila.clave)) return filas
  const lugar = Math.min(indice, filas.length)
  return [...filas.slice(0, lugar), fila, ...filas.slice(lugar)]
}

/**
 * Lo que devuelve el Deshacer de la fila de esa clave: `restauradas`, ella y
 * las quitadas después, de la más nueva a la más vieja (para pasarlas en ese
 * orden a `restaurarFila`), y la `pila` que queda. Una clave que ya no está en
 * la pila (un Deshacer que ya se usó) no devuelve nada.
 */
export function sacarDeLaPila(pila, clave) {
  const desde = pila.findIndex(q => q.fila.clave === clave)
  if (desde < 0) return { pila, restauradas: [] }
  return { pila: pila.slice(0, desde), restauradas: pila.slice(desde).reverse() }
}

/** El estado de un Comprobante nuevo: una Factura con una fila vacía. */
export function estadoNuevo() {
  return {
    cabecera: {
      tipo: 'factura',
      cliente_id: null,
      empresa_emisora: '',
      numero: '',
      fecha: '',
      factura_corregida_id: null,
    },
    filas: [filaVacia()],
  }
}

/**
 * El estado de la pantalla a partir del detalle de la API. `tareas` es un Map
 * de tarea_id a la tarea de GET /tareas: una unidad guardada que no es la
 * Unidad sugerida de su tarea la eligió alguien a mano, y queda como tocada
 * para que cambiar la tarea no la pise (lineas.js, unidadAlElegirTarea).
 */
export function estadoDesdeDetalle(detalle, tareas = new Map()) {
  const lineas = [...(detalle.lineas ?? [])].sort((a, b) => a.orden - b.orden)
  return {
    cabecera: {
      tipo: detalle.tipo,
      cliente_id: detalle.cliente_id,
      empresa_emisora: detalle.empresa_emisora ?? '',
      numero: detalle.numero ?? '',
      fecha: detalle.fecha ?? '',
      factura_corregida_id: detalle.factura_corregida?.id ?? null,
    },
    filas: lineas.map(l => ({
      clave: nuevaClave(),
      fecha: l.fecha,
      tarea_id: l.tarea_id,
      tarea_nombre: l.tarea_nombre,
      unidad: l.unidad,
      unidadTocada: tareas.get(l.tarea_id)?.unidad_sugerida !== l.unidad,
      finca_id: l.finca_id ?? null,
      finca_nombre: l.finca_nombre ?? null,
      cantidad: aTextoArgentino(l.cantidad),
      precio_unitario: aTextoArgentino(l.precio_unitario),
    })),
  }
}

// El número como lo normaliza el backend para medirlo: sin espacios en los
// extremos y con los de adentro colapsados. Las mayúsculas no cambian el largo.
const numeroNormalizado = numero => String(numero ?? '').trim().replace(/\s+/g, ' ')

function validarCabecera(c) {
  const errores = {}
  if (c.tipo !== 'factura' && c.tipo !== 'nota_credito') {
    errores.tipo = 'Elegí si es una Factura o una Nota de crédito.'
  }
  if (c.cliente_id == null || c.cliente_id === '') errores.cliente_id = 'Elegí el Cliente.'
  if (vacio(c.empresa_emisora)) errores.empresa_emisora = 'Elegí la Empresa emisora.'
  const numero = numeroNormalizado(c.numero)
  if (!numero) errores.numero = 'Falta el número del comprobante.'
  else if (numero.includes('|')) errores.numero = 'El número no puede llevar el carácter |.'
  else if (numero.length > LARGO_NUMERO) errores.numero = `El número tiene hasta ${LARGO_NUMERO} caracteres.`
  if (vacio(c.fecha)) errores.fecha = 'Falta la fecha del comprobante.'
  if (c.tipo === 'nota_credito' && c.factura_corregida_id == null) {
    errores.factura_corregida_id = 'Elegí la factura que corrige esta Nota de crédito.'
  }
  return errores
}

/**
 * Lo que hay que corregir antes de guardar: `cabecera` ({campo: mensaje}),
 * `filas` ({clave: {campo: mensaje}}, sólo las filas con errores), `general`
 * (el comprobante sin Líneas, o null) y `hayErrores`. Las filas vacías no se
 * validan: no se mandan.
 */
export function validarFormulario(cabecera, filas) {
  const erroresCabecera = validarCabecera(cabecera)
  const conDatos = filas.filter(f => !filaEstaVacia(f))
  const erroresFilas = {}
  for (const fila of conDatos) {
    const errores = validarLinea(fila)
    if (Object.keys(errores).length) erroresFilas[fila.clave] = errores
  }
  const general = conDatos.length === 0
    ? 'El comprobante necesita al menos una línea: cargá la tarea, la cantidad y el precio.'
    : null
  return {
    cabecera: erroresCabecera,
    filas: erroresFilas,
    general,
    hayErrores: Object.keys(erroresCabecera).length > 0
      || Object.keys(erroresFilas).length > 0
      || general != null,
  }
}

/**
 * La entrada del POST y el PUT (contrato, sección 3.2) y las `claves` de las
 * filas enviadas, en el orden en que van: la fila N de un `linea_invalida` es
 * `claves[N - 1]`. Las filas vacías no se mandan. `actualizadoEn` va tal cual
 * lo trajo el detalle (null en el alta).
 */
export function armarEntrada(cabecera, filas, actualizadoEn) {
  const enviadas = filas.filter(f => !filaEstaVacia(f))
  return {
    entrada: {
      tipo: cabecera.tipo,
      cliente_id: Number(cabecera.cliente_id),
      empresa_emisora: String(cabecera.empresa_emisora ?? '').trim(),
      numero: String(cabecera.numero ?? '').trim(),
      fecha: cabecera.fecha || null,
      // Una Factura no lleva Factura corregida aunque haya quedado elegida
      // antes de cambiar el tipo: el backend la rechazaría.
      factura_corregida_id: cabecera.tipo === 'nota_credito' ? cabecera.factura_corregida_id : null,
      actualizado_en: actualizadoEn ?? null,
      lineas: enviadas.map(f => ({
        fecha: f.fecha,
        tarea_id: f.tarea_id,
        unidad: f.unidad,
        finca_id: f.finca_id ?? null,
        cantidad: leerNumero(f.cantidad),
        precio_unitario: leerNumero(f.precio_unitario),
      })),
    },
    claves: enviadas.map(f => f.clave),
  }
}

/**
 * El error de un guardado o un borrado, listo para mostrar:
 * - `linea`: { clave, campo, mensaje }, para marcar la fila y el campo;
 * - `cabecera`: { campo, mensaje } (campo "lineas" es el comprobante sin Líneas);
 * - `repetido`: { comprobanteId, mensaje }, con enlace al existente;
 * - `modificado`: otra persona lo guardó en el medio;
 * - `no_existe`: lo borraron;
 * - `aviso`: { mensaje }, el resto (histórico, factura con notas, 503...).
 */
export function errorDeGuardado(error, claves) {
  const detail = error?.detail
  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    switch (detail.tipo) {
      case 'linea_invalida': {
        const clave = claves[detail.fila - 1]
        // Sin la fila en pantalla no hay qué marcar: se dice cuál era.
        if (clave == null) return { tipo: 'aviso', mensaje: `Línea ${detail.fila}: ${detail.mensaje}` }
        return { tipo: 'linea', clave, campo: detail.campo, mensaje: detail.mensaje }
      }
      case 'comprobante_invalido':
        return { tipo: 'cabecera', campo: detail.campo, mensaje: detail.mensaje }
      case 'comprobante_repetido':
      case 'historico_mismo_numero':
        return { tipo: 'repetido', comprobanteId: detail.comprobante_id, mensaje: detail.mensaje }
      case 'comprobante_modificado':
        return { tipo: 'modificado', mensaje: detail.mensaje }
      default:
        return { tipo: 'aviso', mensaje: detail.mensaje || error.message }
    }
  }
  if (error?.status === 404) {
    return { tipo: 'no_existe', mensaje: 'Este comprobante ya no existe: otra persona lo borró.' }
  }
  return { tipo: 'aviso', mensaje: error?.message || 'No se pudo guardar el comprobante.' }
}

// Sin acentos y en minúsculas, para buscar como se tipea.
export const normalizar = texto => String(texto ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Las tareas que coinciden con lo tipeado, para el autocompletar de la
 * grilla: cada palabra tiene que aparecer en el nombre, sin importar acentos
 * ni mayúsculas. Primero las que empiezan con lo tipeado; dentro de cada
 * grupo, el orden de la lista. Sin texto, todas.
 */
export function filtrarTareas(tareas, texto) {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean)
  if (!palabras.length) return tareas
  const primeras = []
  const resto = []
  const inicio = palabras.join(' ')
  for (const tarea of tareas) {
    const nombre = normalizar(tarea.nombre)
    if (!palabras.every(p => nombre.includes(p))) continue
    if (nombre.startsWith(inicio)) primeras.push(tarea)
    else resto.push(tarea)
  }
  return [...primeras, ...resto]
}
