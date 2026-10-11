// Tests de lo que muestra Conceptos según si la persona puede editarla o sólo
// verla (ADR-0020, FT2 paso 4.4). node --test, sin dependencias.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { columnasDelPanel, textoSinConceptos, conteoPanel } from './conceptosSoloLectura.js'

const COLUMNAS = [{ key: 'chk' }, { key: 'tarea' }, { key: 'precio' }]

test('con Editar, el panel por regla conserva la columna de selección', () => {
  assert.deepEqual(columnasDelPanel(COLUMNAS, true).map(c => c.key), ['chk', 'tarea', 'precio'])
})

test('con sólo Ver, el panel por regla no tiene la columna de selección del precio masivo', () => {
  assert.deepEqual(columnasDelPanel(COLUMNAS, false).map(c => c.key), ['tarea', 'precio'])
})

test('lista vacía con Editar invita a usar "+ Nuevo"', () => {
  assert.equal(
    textoSinConceptos('comunes', true),
    'No hay conceptos comunes para esta quincena. Usá "+ Nuevo" para agregar.',
  )
})

test('lista vacía con sólo Ver no nombra un botón que no está', () => {
  assert.equal(textoSinConceptos('por finca', false), 'No hay conceptos por finca para esta quincena.')
})

test('conteo con Editar y filas destildadas avisa que conservan su precio', () => {
  assert.equal(
    conteoPanel({ filtradas: 5, seleccionadas: 3, total: 9, editable: true }),
    '2 destildada(s) conservan su precio',
  )
})

test('conteo con Editar y todo tildado muestra cuántos de cuántos', () => {
  assert.equal(conteoPanel({ filtradas: 5, seleccionadas: 5, total: 9, editable: true }), '5 de 9 conceptos')
})

test('conteo con sólo Ver nunca habla de destildadas', () => {
  assert.equal(conteoPanel({ filtradas: 5, seleccionadas: 3, total: 9, editable: false }), '5 de 9 conceptos')
})
