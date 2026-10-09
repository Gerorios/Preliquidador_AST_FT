import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ordenarFilas, siguienteOrden } from './ordenarFilas.js'

const columnas = [
  { clave: 'nombre', valor: f => f.nombre },
  { clave: 'horas', valor: f => f.horas },
]
const filas = [
  { nombre: 'Sosa', horas: 14 },
  { nombre: 'Álvarez', horas: 18.5 },
  { nombre: 'Funes', horas: null },
  { nombre: 'Benítez', horas: 13.5 },
]

test('sin orden devuelve las filas como vinieron', () => {
  assert.equal(ordenarFilas(filas, columnas, null), filas)
})

test('ordena números de mayor a menor y deja lo vacío al final', () => {
  const r = ordenarFilas(filas, columnas, { clave: 'horas', dir: 'desc' })
  assert.deepEqual(r.map(f => f.horas), [18.5, 14, 13.5, null])
})

test('ordena números de menor a mayor y deja lo vacío al final', () => {
  const r = ordenarFilas(filas, columnas, { clave: 'horas', dir: 'asc' })
  assert.deepEqual(r.map(f => f.horas), [13.5, 14, 18.5, null])
})

test('ordena texto en español, con acentos en su lugar', () => {
  const r = ordenarFilas(filas, columnas, { clave: 'nombre', dir: 'asc' })
  assert.deepEqual(r.map(f => f.nombre), ['Álvarez', 'Benítez', 'Funes', 'Sosa'])
})

test('no modifica el arreglo original', () => {
  const copia = [...filas]
  ordenarFilas(filas, columnas, { clave: 'nombre', dir: 'desc' })
  assert.deepEqual(filas, copia)
})

test('el click en un encabezado numérico va de mayor a menor, invierte y vuelve al original', () => {
  const uno = siguienteOrden(null, 'horas', true)
  assert.deepEqual(uno, { clave: 'horas', dir: 'desc' })
  const dos = siguienteOrden(uno, 'horas', true)
  assert.deepEqual(dos, { clave: 'horas', dir: 'asc' })
  assert.equal(siguienteOrden(dos, 'horas', true), null)
})

test('el click en un encabezado de texto empieza de A a Z', () => {
  assert.deepEqual(siguienteOrden({ clave: 'horas', dir: 'desc' }, 'nombre', false), { clave: 'nombre', dir: 'asc' })
})
