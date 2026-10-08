// Tests de las opciones en cascada de la barra de filtros (node --test, sin
// dependencias). Cada filtro ofrece sólo los valores que quedan con los DEMÁS
// filtros activos; el propio no achica su lista. Datos inventados.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opcionesCascada } from './opcionesCascada.js'

const CAMPOS = [
  { key: 'cliente', field: 'nombre_cliente' },
  { key: 'finca', field: 'nombre_finca' },
  { key: 'tarea', field: 'nombre_tarea' },
]

const DATOS = [
  { nombre_cliente: 'Olivares Sur', nombre_finca: 'La Loma', nombre_tarea: 'Poda' },
  { nombre_cliente: 'Olivares Sur', nombre_finca: 'El Bajo', nombre_tarea: 'Cosecha' },
  { nombre_cliente: 'Agro Norte', nombre_finca: 'San Pedro', nombre_tarea: 'Poda' },
  { nombre_cliente: 'Agro Norte', nombre_finca: 'Las Tunas', nombre_tarea: 'Riego' },
  { nombre_cliente: 'Bodega Este', nombre_finca: 'La Loma', nombre_tarea: 'Riego' },
]

test('sin filtros: por cada campo, los valores distintos y ordenados', () => {
  const op = opcionesCascada(DATOS, {}, CAMPOS)
  assert.deepEqual(op, {
    cliente: ['Agro Norte', 'Bodega Este', 'Olivares Sur'],
    finca: ['El Bajo', 'La Loma', 'Las Tunas', 'San Pedro'],
    tarea: ['Cosecha', 'Poda', 'Riego'],
  })
})

test('vacíos y null no se ofrecen', () => {
  const datos = [
    { nombre_cliente: 'Agro Norte', nombre_finca: '', nombre_tarea: null },
    { nombre_cliente: null, nombre_finca: 'San Pedro', nombre_tarea: 'Poda' },
    { nombre_cliente: '', nombre_finca: null },
  ]
  const op = opcionesCascada(datos, {}, CAMPOS)
  assert.deepEqual(op, {
    cliente: ['Agro Norte'],
    finca: ['San Pedro'],
    tarea: ['Poda'],
  })
})

test('con un cliente elegido, finca sólo ofrece sus fincas y cliente no se achica', () => {
  const op = opcionesCascada(DATOS, { cliente: ['Olivares Sur'] }, CAMPOS)
  assert.deepEqual(op.finca, ['El Bajo', 'La Loma'])
  assert.deepEqual(op.tarea, ['Cosecha', 'Poda'])
  assert.deepEqual(op.cliente, ['Agro Norte', 'Bodega Este', 'Olivares Sur'])
})

test('dos filtros activos se cruzan para el tercero', () => {
  const op = opcionesCascada(
    DATOS,
    { cliente: ['Olivares Sur', 'Bodega Este'], tarea: ['Riego', 'Poda'] },
    CAMPOS,
  )
  // Olivares Sur + Poda -> La Loma; Bodega Este + Riego -> La Loma.
  assert.deepEqual(op.finca, ['La Loma'])
  // Cada filtro activo se calcula con el otro: tarea con los dos clientes,
  // cliente con las dos tareas.
  assert.deepEqual(op.tarea, ['Cosecha', 'Poda', 'Riego'])
  assert.deepEqual(op.cliente, ['Agro Norte', 'Bodega Este', 'Olivares Sur'])
})

test('con prefiltro, sólo cuentan las filas que lo cumplen', () => {
  const soloRiego = l => l.nombre_tarea === 'Riego'
  const op = opcionesCascada(DATOS, {}, CAMPOS, soloRiego)
  assert.deepEqual(op, {
    cliente: ['Agro Norte', 'Bodega Este'],
    finca: ['La Loma', 'Las Tunas'],
    tarea: ['Riego'],
  })
})

test('con prefiltro null se usan todas las filas', () => {
  const op = opcionesCascada(DATOS, { cliente: ['Agro Norte'] }, CAMPOS, null)
  assert.deepEqual(op, {
    cliente: ['Agro Norte', 'Bodega Este', 'Olivares Sur'],
    finca: ['Las Tunas', 'San Pedro'],
    tarea: ['Poda', 'Riego'],
  })
})
