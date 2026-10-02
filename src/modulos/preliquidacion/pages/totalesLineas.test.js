// Tests de la fila de totales de la tabla de Revisión (node --test, sin
// dependencias). Los números van como strings a propósito: así llegan los
// Decimal del backend, y sumar strings daría '10.5' + '2' = '10.52'.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { totalesLineas } from './totalesLineas.js'

const CAMPOS = ['hsjornal', 'hsmaquina', 'tancadas', 'unidades', 'importe_total']

// El mismo valor en los cinco campos sumados: sirve como línea y como total.
const lineaCon = (v) => Object.fromEntries(CAMPOS.map(c => [c, v]))

test('sin líneas: todo en 0', () => {
  assert.deepEqual(totalesLineas([]), lineaCon(0))
})

test('suma con Number(), no concatena strings', () => {
  const totales = totalesLineas([lineaCon('10.5'), lineaCon('2')])
  assert.deepEqual(totales, lineaCon(12.5))
})

test('cada campo suma por separado', () => {
  const totales = totalesLineas([
    { hsjornal: '8', hsmaquina: '1.5', tancadas: '3', unidades: '100', importe_total: '25000.50' },
    { hsjornal: '9.25', hsmaquina: null, tancadas: '2', unidades: '40.75', importe_total: '1000' },
  ])
  assert.deepEqual(totales, {
    hsjornal: 17.25, hsmaquina: 1.5, tancadas: 5, unidades: 140.75, importe_total: 26000.5,
  })
})

test('null, undefined, vacío y no numérico suman 0', () => {
  const totales = totalesLineas([
    lineaCon(null),
    lineaCon(undefined),
    lineaCon(''),
    lineaCon('abc'),
    {},
    lineaCon('3'),
  ])
  assert.deepEqual(totales, lineaCon(3))
})

test('líneas duplicadas suman dos veces', () => {
  const linea = { ...lineaCon('4.25'), es_duplicado: true }
  assert.deepEqual(totalesLineas([linea, { ...linea }]), lineaCon(8.5))
})

test('decimales: el total no arrastra error de punto flotante', () => {
  // 0.1 + 0.2 da 0.30000000000000004 en punto flotante.
  assert.deepEqual(totalesLineas([lineaCon('0.1'), lineaCon('0.2')]), lineaCon(0.3))
  // Muchas líneas de dos decimales, como un filtro grande de 2.500 filas.
  const muchas = Array.from({ length: 2500 }, () => lineaCon('0.01'))
  assert.deepEqual(totalesLineas(muchas), lineaCon(25))
})
