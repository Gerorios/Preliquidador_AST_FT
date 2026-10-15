// Tests de la fila Total de la Quincena (node --test, sin dependencias). Los
// números van como strings: así llegan los Decimal del backend.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totalesGrilla } from './totalesGrilla.js'

const viaje = (importe, cantidad = '1.00') =>
  ({ concepto: 'viajes', unidad: 'viaje', cantidad, importe, signo: 1 })

test('suma la cantidad y el importe de lo que se ve', () => {
  const t = totalesGrilla([viaje('245000.00'), viaje('245000.00'), viaje('0.00', '0.00')])
  assert.equal(t.cantidad, 2)
  assert.equal(t.importe, 490000)
})

test('lo que se le descuenta resta', () => {
  const carga = { concepto: 'combustible', unidad: 'litro', cantidad: '100', importe: '200000.00', signo: -1 }
  assert.equal(totalesGrilla([viaje('245000.00'), carga]).importe, 45000)
})

test('no suma cantidades que miden cosas distintas', () => {
  const carga = { concepto: 'combustible', unidad: 'litro', cantidad: '100', importe: '1', signo: -1 }
  assert.equal(totalesGrilla([viaje('1'), carga]).cantidad, null)
})

test('una línea sin precio no suma importe', () => {
  assert.equal(totalesGrilla([viaje('245000.00'), viaje(null)]).importe, 245000)
})

test('los bins se suman sólo donde los hay', () => {
  const hora = (bins) => ({ concepto: 'servicio', unidad: 'toneladas', cantidad: '1', importe: '1', signo: 1, bins })
  assert.equal(totalesGrilla([hora('201.00'), hora('100.50')]).bins, 301.5)
  assert.equal(totalesGrilla([viaje('1')]).bins, null)
})

test('los decimales no arrastran error de punto flotante', () => {
  assert.equal(totalesGrilla([viaje('0.10', '0.1'), viaje('0.20', '0.2')]).importe, 0.3)
})

test('sin líneas, todo en cero y sin cantidad', () => {
  assert.deepEqual(totalesGrilla([]), { cantidad: null, bins: null, importe: 0 })
})
