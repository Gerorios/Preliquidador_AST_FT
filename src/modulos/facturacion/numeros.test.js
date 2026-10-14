// Tests de los números de Comprobantes (node --test, sin dependencias).
// Los casos fijos de importeDeLinea son los mismos que los de
// calcular_importe en tests/facturacion/test_reglas_comprobante.py del
// backend (plan E2, A1 y FA1): si difieren, la pantalla muestra un importe y
// la base guarda otro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { leerNumero, importeDeLinea, formatoPesos } from './numeros.js'

// El separador que pone Intl entre el signo pesos y el número.
const NBSP = ' '

// ─── leerNumero ─────────────────────────────────────────────────────────────

test('leerNumero: los casos del plan', () => {
  assert.equal(leerNumero('1.234,56'), '1234.56')
  assert.equal(leerNumero('1.500'), '1500')
  assert.equal(leerNumero('12,5'), '12.5')
  assert.equal(leerNumero('$ 1.234,56'), '1234.56')
  assert.equal(leerNumero('abc'), null)
})

test('leerNumero: sin separador de miles y con espacios en los extremos', () => {
  assert.equal(leerNumero('1500'), '1500')
  assert.equal(leerNumero('1234,5678'), '1234.5678')
  assert.equal(leerNumero('  12,5  '), '12.5')
})

test('leerNumero: lee lo que escribe formatoPesos', () => {
  assert.equal(leerNumero(`$${NBSP}17.781.987,60`), '17781987.60')
  assert.equal(leerNumero(`-$${NBSP}3,50`), '-3.50')
})

test('leerNumero: el punto es de miles, así que un grupo que no es de tres no se lee', () => {
  // En es-AR "1.5" no es uno coma cinco: devolver 15 sería peor que no leerlo.
  assert.equal(leerNumero('1.5'), null)
  assert.equal(leerNumero('1234.56'), null)
  assert.equal(leerNumero('12.34.567'), null)
})

test('leerNumero: vacío, null y textos que no son números dan null', () => {
  assert.equal(leerNumero(''), null)
  assert.equal(leerNumero('   '), null)
  assert.equal(leerNumero(null), null)
  assert.equal(leerNumero(undefined), null)
  assert.equal(leerNumero('$'), null)
  assert.equal(leerNumero('1,2,3'), null)
  assert.equal(leerNumero('12,'), null)
  assert.equal(leerNumero('1e3'), null)
})

// ─── importeDeLinea ─────────────────────────────────────────────────────────

test('importeDeLinea: los casos fijos de A1', () => {
  assert.equal(importeDeLinea('3', '0.005'), '0.02')
  assert.equal(importeDeLinea('1.5', '2.3333'), '3.50')
  assert.equal(importeDeLinea('56710', '313.56'), '17781987.60')
})

test('importeDeLinea: redondea la mitad hacia arriba, no al par', () => {
  // Con el redondeo bancario 0.125 daría 0.12.
  assert.equal(importeDeLinea('1', '0.125'), '0.13')
  assert.equal(importeDeLinea('1', '0.135'), '0.14')
  assert.equal(importeDeLinea('1', '0.1249'), '0.12')
})

test('importeDeLinea: con precio cero da 0.00, siempre con dos decimales', () => {
  assert.equal(importeDeLinea('10', '0'), '0.00')
  assert.equal(importeDeLinea('2', '5'), '10.00')
})

test('importeDeLinea: exacto con los máximos de las columnas, donde un Number ya no alcanza', () => {
  // Cantidad DECIMAL(14,2) y precio DECIMAL(14,4): el producto pasa de 2^53.
  // Exacto es 9999999999999800000000.000001 (verificado con Decimal de Python).
  assert.equal(
    importeDeLinea('999999999999.99', '9999999999.9999'),
    '9999999999999800000000.00',
  )
})

test('importeDeLinea: si falta un número o no se lee, da null', () => {
  assert.equal(importeDeLinea(null, '2'), null)
  assert.equal(importeDeLinea('2', ''), null)
  assert.equal(importeDeLinea('abc', '2'), null)
  assert.equal(importeDeLinea('1,5', '2'), null)
})

// ─── formatoPesos ───────────────────────────────────────────────────────────

test('formatoPesos: es-AR, con miles y dos decimales', () => {
  assert.equal(formatoPesos('17781987.60'), `$${NBSP}17.781.987,60`)
  assert.equal(formatoPesos('3.5'), `$${NBSP}3,50`)
  assert.equal(formatoPesos('0.00'), `$${NBSP}0,00`)
})

test('formatoPesos: el total de una Nota de crédito sale con signo menos', () => {
  assert.equal(formatoPesos('-3.50'), `-$${NBSP}3,50`)
  assert.equal(formatoPesos('-17781991.12'), `-$${NBSP}17.781.991,12`)
})

test('formatoPesos: un cero negativo se muestra sin signo', () => {
  assert.equal(formatoPesos('-0.00'), `$${NBSP}0,00`)
})

test('formatoPesos: exacto con importes que no entran en un Number', () => {
  assert.equal(formatoPesos('123456789012345678.91'), `$${NBSP}123.456.789.012.345.678,91`)
})

test('formatoPesos: acepta un number', () => {
  assert.equal(formatoPesos(1234.5), `$${NBSP}1.234,50`)
})

test('formatoPesos: sin valor o con uno que no es número, una raya', () => {
  assert.equal(formatoPesos(null), '—')
  assert.equal(formatoPesos(undefined), '—')
  assert.equal(formatoPesos(''), '—')
  assert.equal(formatoPesos('abc'), '—')
})
