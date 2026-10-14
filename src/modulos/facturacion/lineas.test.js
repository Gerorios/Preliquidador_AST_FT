// Tests de las reglas de la grilla de Líneas (node --test, sin dependencias).
// validarLinea repite la regla 3 de _validar_lineas en
// app/modulos/facturacion/services/comprobantes_service.py del backend (plan
// E2, A4 y FA2), con los mismos límites y las mismas claves de campo que
// `linea_invalida`: si difieren, la pantalla deja guardar algo que el backend
// rechaza, o al revés.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarLinea, unidadAlElegirTarea, avisoDeLinea, totalFirmado } from './lineas.js'

// Una Línea completa y válida, tal como queda en la grilla: los números son el
// texto tipeado en es-AR.
const valida = (cambios = {}) => ({
  fecha: '2026-09-16',
  tarea_id: 7,
  unidad: 'plantas',
  finca_id: null,
  cantidad: '1.234,50',
  precio_unitario: '98,1234',
  ...cambios,
})

// ─── validarLinea ───────────────────────────────────────────────────────────

test('validarLinea: una Línea completa no tiene errores, con o sin finca', () => {
  assert.deepEqual(validarLinea(valida()), {})
  assert.deepEqual(validarLinea(valida({ finca_id: 3 })), {})
})

test('validarLinea: fecha, tarea y unidad son obligatorias', () => {
  const errores = validarLinea(valida({ fecha: '', tarea_id: null, unidad: '' }))
  assert.deepEqual(Object.keys(errores).sort(), ['fecha', 'tarea_id', 'unidad'])
  assert.match(errores.fecha, /fecha/)
  assert.match(errores.tarea_id, /tarea/)
  assert.match(errores.unidad, /unidad/)
})

test('validarLinea: una unidad fuera de las nueve no sirve', () => {
  assert.deepEqual(Object.keys(validarLinea(valida({ unidad: 'kilos' }))), ['unidad'])
})

test('validarLinea: la cantidad tiene que ser mayor que 0', () => {
  for (const cantidad of ['0', '0,00', '-3', '-0']) {
    const errores = validarLinea(valida({ cantidad }))
    assert.deepEqual(Object.keys(errores), ['cantidad'], cantidad)
    assert.match(errores.cantidad, /mayor que 0/, cantidad)
  }
})

test('validarLinea: el precio puede ser 0, pero no negativo', () => {
  assert.deepEqual(validarLinea(valida({ precio_unitario: '0' })), {})
  assert.deepEqual(validarLinea(valida({ precio_unitario: '-0' })), {})
  const errores = validarLinea(valida({ precio_unitario: '-1,5' }))
  assert.deepEqual(Object.keys(errores), ['precio_unitario'])
  assert.match(errores.precio_unitario, /negativo/)
})

test('validarLinea: cantidad y precio vacíos faltan', () => {
  const errores = validarLinea(valida({ cantidad: '', precio_unitario: '  ' }))
  assert.deepEqual(Object.keys(errores).sort(), ['cantidad', 'precio_unitario'])
  assert.match(errores.cantidad, /Falta/)
  assert.match(errores.precio_unitario, /Falta/)
})

test('validarLinea: un número con punto decimal no se lee y el mensaje dice cómo escribirlo', () => {
  // En es-AR el punto es de miles: "1234.56" no es mil doscientos treinta y
  // cuatro con cincuenta y seis.
  const errores = validarLinea(valida({ cantidad: '1234.56', precio_unitario: 'abc' }))
  assert.deepEqual(Object.keys(errores).sort(), ['cantidad', 'precio_unitario'])
  assert.match(errores.cantidad, /coma/)
  assert.match(errores.precio_unitario, /coma/)
})

test('validarLinea: la cantidad admite hasta 2 decimales y 12 cifras enteras', () => {
  assert.deepEqual(validarLinea(valida({ cantidad: '999.999.999.999,99', precio_unitario: '0' })), {})
  // Los ceros de los extremos no cuentan, como en el backend.
  assert.deepEqual(validarLinea(valida({ cantidad: '0001,2300' })), {})
  const decimales = validarLinea(valida({ cantidad: '1,234' }))
  assert.deepEqual(Object.keys(decimales), ['cantidad'])
  assert.match(decimales.cantidad, /2 decimales/)
  const enteros = validarLinea(valida({ cantidad: '1.000.000.000.000' }))
  assert.deepEqual(Object.keys(enteros), ['cantidad'])
  assert.match(enteros.cantidad, /12 cifras/)
})

test('validarLinea: el precio admite hasta 4 decimales y 10 cifras enteras', () => {
  assert.deepEqual(validarLinea(valida({ cantidad: '1', precio_unitario: '9.999.999.999,9999' })), {})
  assert.deepEqual(validarLinea(valida({ precio_unitario: '2,333300' })), {})
  const decimales = validarLinea(valida({ precio_unitario: '2,33333' }))
  assert.deepEqual(Object.keys(decimales), ['precio_unitario'])
  assert.match(decimales.precio_unitario, /4 decimales/)
  const enteros = validarLinea(valida({ precio_unitario: '10.000.000.000' }))
  assert.deepEqual(Object.keys(enteros), ['precio_unitario'])
  assert.match(enteros.precio_unitario, /10 cifras/)
})

test('validarLinea: un importe que no entra en su columna da error en importe', () => {
  // Cada uno entra en la suya, pero el producto pasa las 12 cifras enteras.
  const errores = validarLinea(valida({ cantidad: '1.000.000', precio_unitario: '1.000.000' }))
  assert.deepEqual(Object.keys(errores), ['importe'])
  assert.match(errores.importe, /demasiado grande/)
  // Justo en el límite: 999.999.999.999,99 entra.
  assert.deepEqual(validarLinea(valida({ cantidad: '999.999.999.999,99', precio_unitario: '1' })), {})
})

// ─── unidadAlElegirTarea ────────────────────────────────────────────────────

const conSugerida = { tarea_id: 7, unidad_sugerida: 'plantas', no_facturable: false }
const sinSugerida = { tarea_id: 8, unidad_sugerida: null, no_facturable: false }

test('unidadAlElegirTarea: si la unidad no se tocó, precarga la sugerida', () => {
  assert.equal(unidadAlElegirTarea({ unidad: '', unidadTocada: false }, conSugerida), 'plantas')
  // Cambiar de tarea reemplaza la que se había precargado.
  assert.equal(
    unidadAlElegirTarea({ unidad: 'tancadas', unidadTocada: false }, conSugerida),
    'plantas',
  )
})

test('unidadAlElegirTarea: una tarea sin sugerida deja la unidad vacía', () => {
  assert.equal(unidadAlElegirTarea({ unidad: 'plantas', unidadTocada: false }, sinSugerida), '')
  assert.equal(unidadAlElegirTarea({ unidad: '', unidadTocada: false }, null), '')
})

test('unidadAlElegirTarea: si la unidad se tocó a mano, se respeta', () => {
  assert.equal(
    unidadAlElegirTarea({ unidad: 'hectareas', unidadTocada: true }, conSugerida),
    'hectareas',
  )
  assert.equal(
    unidadAlElegirTarea({ unidad: 'hectareas', unidadTocada: true }, sinSugerida),
    'hectareas',
  )
})

// ─── avisoDeLinea ───────────────────────────────────────────────────────────

test('avisoDeLinea: avisa si la tarea es No facturable, sin impedir guardar', () => {
  assert.match(avisoDeLinea({ ...conSugerida, no_facturable: true }), /No facturable/)
  assert.equal(avisoDeLinea(conSugerida), null)
  assert.equal(avisoDeLinea(null), null)
})

// ─── totalFirmado ───────────────────────────────────────────────────────────

test('totalFirmado: suma los importes de una Factura con dos decimales', () => {
  assert.equal(totalFirmado('factura', ['0.02', '3.50', '17781987.60']), '17781991.12')
  assert.equal(totalFirmado('factura', []), '0.00')
})

test('totalFirmado: en una Nota de crédito sale negativo, y en cero sin signo', () => {
  assert.equal(totalFirmado('nota_credito', ['0.02', '3.50']), '-3.52')
  assert.equal(totalFirmado('nota_credito', ['0.00']), '0.00')
})

test('totalFirmado: exacto con importes que no entran en un Number', () => {
  assert.equal(
    totalFirmado('factura', ['9999999999999800000000.00', '0.01']),
    '9999999999999800000000.01',
  )
})

test('totalFirmado: las Líneas sin importe todavía no suman', () => {
  // Una fila a medio tipear (importeDeLinea dio null) no frena el total.
  assert.equal(totalFirmado('factura', ['3.50', null, undefined, '1.25']), '4.75')
})

test('totalFirmado: un tipo desconocido es un error de programación', () => {
  assert.throws(() => totalFirmado('nota_debito', ['1.00']))
})
