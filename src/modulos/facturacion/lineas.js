// Reglas de la grilla de Líneas de un Comprobante (plan E2, FA2): validar una
// Línea antes de mandarla, precargar la Unidad sugerida, avisar si la tarea es
// No facturable y sumar el total con su signo. No importa React, para que lo
// cargue `node --test`.
//
// validarLinea repite la regla 3 del backend (_validar_lineas en
// comprobantes_service.py) para avisar antes de guardar; la que vale es la del
// backend. Las claves de los errores son los campos de `linea_invalida`, así
// la pantalla marca igual un error propio y uno que vuelve de la API. Que la
// tarea sea del maestro y la finca del Cliente lo controla sólo el backend: el
// front no tiene las tareas y fincas de baja que el backend conserva al editar.

import { leerNumero, importeDeLinea } from './numeros.js'
import { UNIDADES } from './unidades.js'

// (cifras enteras, decimales) que entran en cada columna: DECIMAL(14,2) y
// DECIMAL(14,4), como CANTIDAD, PRECIO e IMPORTE del backend.
const CANTIDAD = { enteros: 12, decimales: 2 }
const PRECIO = { enteros: 10, decimales: 4 }
const IMPORTE = { enteros: 12 }

const FECHA = /^\d{4}-\d{2}-\d{2}$/

// Texto con punto decimal ("-0012.3400") a sus partes significativas, sin los
// ceros de los extremos, que no cuentan para entrar en la columna (el backend
// hace lo mismo con Decimal.normalize()).
function partes(texto) {
  const [, signo, enteros, decimales = ''] = texto.match(/^(-?)(\d+)(?:\.(\d+))?$/)
  const significativos = {
    enteros: enteros.replace(/^0+/, ''),
    decimales: decimales.replace(/0+$/, ''),
  }
  const cero = !significativos.enteros && !significativos.decimales
  // "-0" es cero, no negativo: el backend tampoco lo toma como menor que 0.
  return { ...significativos, cero, negativo: signo === '-' && !cero }
}

function vacio(valor) {
  return valor == null || String(valor).trim() === ''
}

// Lee un número tipeado y devuelve { texto } o { error }. `nombre` va en el
// mensaje ("La cantidad", "El precio") y `ejemplo` muestra cómo escribirlo.
function leer(valor, nombre, ejemplo) {
  if (vacio(valor)) return { error: `Falta ${nombre.toLowerCase()}.` }
  const texto = leerNumero(valor)
  if (texto == null) {
    // El caso común es el punto decimal ("1234.56"): en es-AR el punto es de
    // miles, así que se avisa cómo escribirlo en lugar de adivinar.
    return { error: `${nombre} no es un número. Usá la coma para los decimales, por ejemplo ${ejemplo}.` }
  }
  return { texto }
}

/**
 * Valida una Línea de la grilla. Recibe { fecha, tarea_id, unidad, finca_id,
 * cantidad, precio_unitario }, con la fecha como AAAA-MM-DD y los números como
 * se tipean en es-AR. Devuelve { campo: mensaje } con un error por campo, o {}
 * si la Línea está bien.
 */
export function validarLinea(linea) {
  const errores = {}

  if (vacio(linea.fecha)) errores.fecha = 'Falta la fecha.'
  else if (!FECHA.test(String(linea.fecha))) errores.fecha = 'La fecha no es válida.'

  if (vacio(linea.tarea_id)) errores.tarea_id = 'Elegí la tarea.'

  if (vacio(linea.unidad)) errores.unidad = 'Elegí la unidad.'
  else if (!UNIDADES.includes(linea.unidad)) errores.unidad = 'Esa unidad no es una de las nueve.'

  const cantidad = leer(linea.cantidad, 'La cantidad', '1.234,50')
  if (cantidad.error) {
    errores.cantidad = cantidad.error
  } else {
    const c = partes(cantidad.texto)
    if (c.cero || c.negativo) {
      errores.cantidad = 'La cantidad tiene que ser mayor que 0.'
    } else if (c.enteros.length > CANTIDAD.enteros || c.decimales.length > CANTIDAD.decimales) {
      errores.cantidad = 'La cantidad tiene hasta 2 decimales y 12 cifras enteras.'
    }
  }

  const precio = leer(linea.precio_unitario, 'El precio', '98,1234')
  if (precio.error) {
    errores.precio_unitario = precio.error
  } else {
    const p = partes(precio.texto)
    if (p.negativo) {
      errores.precio_unitario = 'El precio no puede ser negativo.'
    } else if (p.enteros.length > PRECIO.enteros || p.decimales.length > PRECIO.decimales) {
      errores.precio_unitario = 'El precio tiene hasta 4 decimales y 10 cifras enteras.'
    }
  }

  // El importe se controla sólo con los dos números bien: cada uno puede
  // entrar en su columna y el producto no entrar en la suya.
  if (!errores.cantidad && !errores.precio_unitario) {
    const importe = importeDeLinea(cantidad.texto, precio.texto)
    if (partes(importe).enteros.length > IMPORTE.enteros) {
      errores.importe = 'El importe de la línea es demasiado grande.'
    }
  }

  return errores
}

/**
 * La unidad que queda al elegir una tarea en la fila. Si la unidad no se tocó
 * a mano, precarga la Unidad sugerida de la tarea (o la deja vacía si la tarea
 * no tiene, para que se elija a conciencia); si se tocó, la respeta.
 * `fila` es { unidad, unidadTocada } y `tarea` la de GET /tareas, o null.
 */
export function unidadAlElegirTarea(fila, tarea) {
  if (fila.unidadTocada) return fila.unidad
  return tarea?.unidad_sugerida ?? ''
}

/**
 * El aviso de la fila, o null. Una tarea No facturable se acepta (pregunta 5):
 * lo emitido se registra tal cual, pero se avisa por si fue un error.
 */
export function avisoDeLinea(tarea) {
  if (tarea?.no_facturable) {
    return 'Esta tarea está marcada como No facturable en el sistema de campo.'
  }
  return null
}

// Importe con hasta dos decimales ("3.5", "17781987.60") a centavos, o null.
function aCentavos(importe) {
  if (importe == null) return null
  const partesImporte = String(importe).trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/)
  if (!partesImporte) return null
  const [, signo, enteros, decimales = ''] = partesImporte
  const centavos = BigInt(enteros + decimales.padEnd(2, '0'))
  return signo ? -centavos : centavos
}

/**
 * El total del Comprobante: la suma de los importes de las Líneas, negativa en
 * una Nota de crédito (regla 5, como total_firmado del backend). Devuelve texto
 * con dos decimales, en centavos con BigInt para no perder exactitud. Las
 * Líneas sin importe (a medio tipear) todavía no suman. Un cero sale sin signo.
 */
export function totalFirmado(tipo, importes) {
  if (tipo !== 'factura' && tipo !== 'nota_credito') {
    throw new Error(`Tipo de comprobante desconocido: ${tipo}`)
  }
  let total = 0n
  for (const importe of importes) {
    const centavos = aCentavos(importe)
    if (centavos != null) total += centavos
  }
  if (tipo === 'nota_credito') total = -total

  const negativo = total < 0n
  const digitos = (negativo ? -total : total).toString().padStart(3, '0')
  return `${negativo ? '-' : ''}${digitos.slice(0, -2)}.${digitos.slice(-2)}`
}
