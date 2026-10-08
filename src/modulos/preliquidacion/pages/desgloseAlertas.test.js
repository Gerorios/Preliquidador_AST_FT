// Tests del desglose de alertas del historial (node --test, sin dependencias).
// El desglose sale del item del listado de quincenas; los datos son inventados.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { desgloseAlertas } from './desgloseAlertas.js'

// Item del listado con todas las alertas en cero salvo las que se pasen.
const itemCon = (parcial) => ({
  id: 7,
  lineas_con_alerta: 0,
  incompletas: 0,
  duplicados: 0,
  posibles_duplicados: 0,
  alerta_legajo: 0,
  sin_empresa: 0,
  ...parcial,
})
const claves = (desglose) => desglose.map(t => t.clave)

test('sin item o sin los campos (backend viejo) da una lista vacía', () => {
  assert.deepEqual(desgloseAlertas(null), [])
  assert.deepEqual(desgloseAlertas(undefined), [])
  assert.deepEqual(desgloseAlertas({ id: 3, lineas_con_alerta: 5 }), [])
})

test('sólo los tipos con cantidad mayor a cero, en orden fijo', () => {
  const todos = desgloseAlertas(itemCon({
    sin_empresa: 1,
    alerta_legajo: 2,
    posibles_duplicados: 3,
    duplicados: 4,
    incompletas: 5,
  }))
  assert.deepEqual(claves(todos), [
    'incompletas', 'duplicados', 'posibles_duplicados', 'alerta_legajo', 'sin_empresa',
  ])
  assert.deepEqual(todos.map(t => t.cantidad), [5, 4, 3, 2, 1])

  const algunos = desgloseAlertas(itemCon({ alerta_legajo: 2, incompletas: 1 }))
  assert.deepEqual(claves(algunos), ['incompletas', 'alerta_legajo'])
})

test('con 1 va en singular y con 2 en plural', () => {
  const etiquetas = (cantidad) => desgloseAlertas(itemCon({
    incompletas: cantidad,
    duplicados: cantidad,
    posibles_duplicados: cantidad,
    alerta_legajo: cantidad,
    sin_empresa: cantidad,
  })).map(t => t.etiqueta)
  assert.deepEqual(etiquetas(1), [
    'incompleta', 'duplicada', 'posible duplicado', 'legajo inválido', 'sin empresa',
  ])
  assert.deepEqual(etiquetas(2), [
    'incompletas', 'duplicadas', 'posibles duplicados', 'legajo inválido', 'sin empresa',
  ])
})

test('tono danger para incompletas y duplicadas, warn para el resto', () => {
  const desglose = desgloseAlertas(itemCon({
    incompletas: 1, duplicados: 1, posibles_duplicados: 1, alerta_legajo: 1, sin_empresa: 1,
  }))
  assert.deepEqual(desglose.map(t => t.tono), ['danger', 'danger', 'warn', 'warn', 'warn'])
})

test('cada tipo trae una explicación no vacía', () => {
  const desglose = desgloseAlertas(itemCon({
    incompletas: 1, duplicados: 1, posibles_duplicados: 1, alerta_legajo: 1, sin_empresa: 1,
  }))
  assert.equal(desglose.length, 5)
  for (const t of desglose) {
    assert.equal(typeof t.explicacion, 'string')
    assert.ok(t.explicacion.trim().length > 0, `${t.clave} sin explicación`)
  }
})

test('sin_empresa sale del campo del item', () => {
  const desglose = desgloseAlertas(itemCon({ sin_empresa: 3 }))
  assert.deepEqual(desglose.map(t => [t.clave, t.cantidad, t.etiqueta]), [
    ['sin_empresa', 3, 'sin empresa'],
  ])
})
