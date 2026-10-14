// Tests del formato único de quincena del módulo (node --test, sin
// dependencias propias). La fecha es la ISO de inicio de la quincena:
// día 1 es la primera y día 16 la segunda.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatoQuincena } from './formatoQuincena.js'

test('día 1: primera quincena', () => {
  assert.equal(formatoQuincena('2026-09-01'), '1ra quincena septiembre 2026')
})

test('día 16: segunda quincena', () => {
  assert.equal(formatoQuincena('2026-09-16'), '2da quincena septiembre 2026')
})

test('otro mes y año: el mes va en español y en minúscula', () => {
  assert.equal(formatoQuincena('2026-01-16'), '2da quincena enero 2026')
  assert.equal(formatoQuincena('2025-12-01'), '1ra quincena diciembre 2025')
})

test('sin fecha: guion largo', () => {
  assert.equal(formatoQuincena(null), '—')
  assert.equal(formatoQuincena(undefined), '—')
  assert.equal(formatoQuincena(''), '—')
})
