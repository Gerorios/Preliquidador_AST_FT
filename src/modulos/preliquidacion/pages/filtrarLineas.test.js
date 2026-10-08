// Tests del filtrado de líneas en cliente que comparten Revisión y
// Verificación (node --test, sin dependencias). Los datos son inventados.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAMPOS_LINEAS, pasaBusquedaYAlertas, pasaCampos, filtrarLineas } from './filtrarLineas.js'

// Arma líneas con id correlativo a partir de una lista de campos parciales.
const lineasDe = (parciales) => parciales.map((p, i) => ({ id: i + 1, ...p }))
const ids = (lineas) => lineas.map(l => l.id)

// Una línea por cada tipo de alerta, más una sin ninguna (id 6).
const lineasConAlertas = () => lineasDe([
  { linea_incompleta: true },
  { alerta_legajo: true },
  { alerta_empresa: true },
  { es_duplicado: true },
  { es_posible_duplicado: true },
  {},
])

test('sin búsqueda ni filtros devuelve todas las líneas', () => {
  const lineas = lineasDe([
    { nombre_empleado: 'Ana Prueba', nombre_cliente: 'Cliente Uno' },
    { nombre_empleado: 'Beto Ejemplo', nombre_cliente: 'Cliente Dos' },
    { nombre_empleado: 'Caro Ficticia', es_duplicado: true },
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, '', {})), [1, 2, 3])
})

test('la búsqueda no distingue mayúsculas y mira empleado, legajos, tarea, cliente y finca', () => {
  const lineas = lineasDe([
    { nombre_empleado: 'ZORRO Prueba' },
    { legajo_campo: 'L-ZORRO-1' },
    { legajo_asignado: 'zorro-2' },
    { nombre_tarea: 'Poda Zorro' },
    { nombre_cliente: 'Cliente zOrRo' },
    { nombre_finca: 'Finca Zorro' },
    { nombre_empleado: 'Otro Nombre', nombre_finca: 'Finca Lejana' },
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, 'zorro', {})), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(ids(filtrarLineas(lineas, 'ZORRO', {})), [1, 2, 3, 4, 5, 6])
})

test('la búsqueda no mira el supervisor', () => {
  // La segunda línea es de control: coincide por empleado, así el test no
  // pasa con un filtrado que devuelva siempre vacío.
  const lineas = lineasDe([
    { nombre_empleado: 'Ana Prueba', nombre_supervisor: 'Supervisor Zorro' },
    { nombre_empleado: 'Zorro Ejemplo', nombre_supervisor: 'Supervisor Otro' },
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, 'zorro', {})), [2])
})

test('varios valores de un mismo campo se unen y dos campos se intersectan', () => {
  const lineas = lineasDe([
    { nombre_cliente: 'Cliente A', nombre_finca: 'Finca X' },
    { nombre_cliente: 'Cliente B', nombre_finca: 'Finca X' },
    { nombre_cliente: 'Cliente C', nombre_finca: 'Finca X' },
    { nombre_cliente: 'Cliente A', nombre_finca: 'Finca Y' },
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { cliente: ['Cliente A', 'Cliente B'] })), [1, 2, 4])
  assert.deepEqual(
    ids(filtrarLineas(lineas, '', { cliente: ['Cliente A', 'Cliente B'], finca: ['Finca X'] })),
    [1, 2],
  )
})

test('un campo con arreglo vacío o ausente no filtra', () => {
  const lineas = lineasDe([
    { nombre_cliente: 'Cliente A' },
    { nombre_cliente: 'Cliente B' },
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { cliente: [] })), [1, 2])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { cliente: undefined })), [1, 2])
  assert.equal(pasaCampos(lineas[0], { cliente: [] }), true)
  assert.equal(pasaCampos(lineas[0], {}), true)
})

test('cada alerta deja sólo sus líneas', () => {
  const lineas = lineasConAlertas()
  assert.deepEqual(ids(filtrarLineas(lineas, '', { alerta: 'incompleta' })), [1])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { alerta: 'alerta_legajo' })), [2])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { alerta: 'alerta_empresa' })), [3])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { alerta: 'es_duplicado' })), [4])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { alerta: 'es_posible_duplicado' })), [5])
})

test('solo_alertas incluye duplicado, posible, legajo e incompleta, y no la que sólo tiene alerta de empresa', () => {
  const lineas = lineasConAlertas()
  assert.deepEqual(ids(filtrarLineas(lineas, '', { solo_alertas: true })), [1, 2, 4, 5])
})

test('nombre_empleado filtra por parte del nombre sin distinguir mayúsculas', () => {
  const lineas = lineasDe([
    { nombre_empleado: 'Ana Prueba' },
    { nombre_empleado: 'Mariana Ejemplo' },
    { nombre_empleado: 'Beto Ficticio' },
    {},
  ])
  assert.deepEqual(ids(filtrarLineas(lineas, '', { nombre_empleado: 'ANA' })), [1, 2])
})

test('con campos sin empresa, el filtro de empresa se ignora', () => {
  assert.ok(CAMPOS_LINEAS.some(c => c.key === 'empresa'))
  const sinEmpresa = CAMPOS_LINEAS.filter(c => c.key !== 'empresa')
  const lineas = lineasDe([
    { empresa_asignada: 'Empresa Uno' },
    { empresa_asignada: 'Empresa Dos' },
  ])
  const filtros = { empresa: ['Empresa Uno'] }
  assert.deepEqual(ids(filtrarLineas(lineas, '', filtros)), [1])
  assert.deepEqual(ids(filtrarLineas(lineas, '', filtros, sinEmpresa)), [1, 2])
})

test('pasaBusquedaYAlertas ignora los campos (cliente, finca...)', () => {
  const linea = { id: 1, nombre_cliente: 'Cliente A', nombre_finca: 'Finca X' }
  const filtros = { cliente: ['Cliente B'], finca: ['Finca Y'] }
  assert.equal(pasaBusquedaYAlertas(linea, '', filtros), true)
  assert.equal(pasaCampos(linea, filtros), false)
})
