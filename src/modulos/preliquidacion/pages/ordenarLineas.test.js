// Tests del orden por columna de la tabla de Revisión (node --test, sin
// dependencias). Los números van como strings a propósito: así llegan los
// Decimal del backend, y comparar strings daría "95" > "120".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COLUMNAS_ORDEN, alertaDe, siguienteOrden, ordenarLineas } from './ordenarLineas.js'

// Arma líneas con id correlativo a partir de una lista de campos parciales.
const lineasDe = (parciales) => parciales.map((p, i) => ({ id: i + 1, ...p }))
const ids = (lineas) => lineas.map(l => l.id)
const asc = (clave) => ({ clave, dir: 'asc' })
const desc = (clave) => ({ clave, dir: 'desc' })

test('COLUMNAS_ORDEN tiene las 15 columnas de la tabla', () => {
  assert.deepEqual(Object.keys(COLUMNAS_ORDEN).sort(), [
    'alerta', 'cliente_finca', 'conceptos', 'empleado', 'empresa', 'fecha',
    'grupo_pago', 'hsjornal', 'hsmaquina', 'importe', 'legajo', 'supervisor',
    'tancadas', 'tarea', 'unidades',
  ])
})

test('siguienteOrden: asc, desc y vuelta al orden original', () => {
  const primero = siguienteOrden(null, 'fecha')
  assert.deepEqual(primero, { clave: 'fecha', dir: 'asc' })
  const segundo = siguienteOrden(primero, 'fecha')
  assert.deepEqual(segundo, { clave: 'fecha', dir: 'desc' })
  assert.equal(siguienteOrden(segundo, 'fecha'), null)
})

test('siguienteOrden: otra columna activa arranca en asc', () => {
  assert.deepEqual(siguienteOrden(asc('fecha'), 'empleado'), { clave: 'empleado', dir: 'asc' })
  assert.deepEqual(siguienteOrden(desc('fecha'), 'empleado'), { clave: 'empleado', dir: 'asc' })
})

test('ordenarLineas sin orden devuelve la misma referencia', () => {
  const lineas = lineasDe([{ fecha_tarea: '2026-09-02' }, { fecha_tarea: '2026-09-01' }])
  assert.equal(ordenarLineas(lineas, null), lineas)
})

test('ordenarLineas con orden no muta la entrada', () => {
  const lineas = lineasDe([{ fecha_tarea: '2026-09-02' }, { fecha_tarea: '2026-09-01' }])
  const copia = [...lineas]
  const resultado = ordenarLineas(lineas, asc('fecha'))
  assert.notEqual(resultado, lineas)
  assert.deepEqual(lineas, copia)
  assert.deepEqual(ids(resultado), [2, 1])
})

test('fecha: asc y desc, vacías al final', () => {
  const lineas = lineasDe([
    { fecha_tarea: '2026-09-03' },
    { fecha_tarea: null },
    { fecha_tarea: '2026-09-01' },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('fecha'))), [3, 1, 2])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('fecha'))), [1, 3, 2])
})

test('texto: sin mayúsculas ni acentos, estable, vacíos al final', () => {
  const lineas = lineasDe([
    { nombre_empleado: 'Benítez' },
    { nombre_empleado: '' },
    { nombre_empleado: 'alvarez' },
    { nombre_empleado: null },
    { nombre_empleado: 'Álvarez' },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('empleado'))), [3, 5, 1, 2, 4])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('empleado'))), [1, 3, 5, 2, 4])
})

test('texto: tarea, empresa, supervisor y grupo de pago usan su campo', () => {
  const casos = [
    ['tarea', 'nombre_tarea'],
    ['empresa', 'empresa_asignada'],
    ['supervisor', 'nombre_supervisor'],
    ['grupo_pago', 'grupo_pago_aplicado'],
  ]
  for (const [clave, campo] of casos) {
    const lineas = lineasDe([{ [campo]: 'Zeta' }, { [campo]: null }, { [campo]: 'alfa' }])
    assert.deepEqual(ids(ordenarLineas(lineas, asc(clave))), [3, 1, 2], clave)
    assert.deepEqual(ids(ordenarLineas(lineas, desc(clave))), [1, 3, 2], clave)
  }
})

test('legajo: numérico, asignado antes que el de campo, vacíos al final', () => {
  const lineas = lineasDe([
    { legajo_asignado: '120', legajo_campo: '1' },
    { legajo_asignado: null, legajo_campo: '95' },
    { legajo_asignado: '7', legajo_campo: null },
    { legajo_asignado: '', legajo_campo: '' },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('legajo'))), [3, 2, 1, 4])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('legajo'))), [1, 2, 3, 4])
})

test('cliente · finca: mismo cliente desempata por finca, vacíos al final', () => {
  const lineas = lineasDe([
    { nombre_cliente: 'Beta', nombre_finca: 'X' },
    { nombre_cliente: 'Alfa', nombre_finca: 'Zorro' },
    { nombre_cliente: null, nombre_finca: 'W' },
    { nombre_cliente: 'Alfa', nombre_finca: 'Yunque' },
    { nombre_cliente: 'Alfa', nombre_finca: null },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('cliente_finca'))), [4, 2, 5, 1, 3])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('cliente_finca'))), [1, 2, 4, 5, 3])
})

test('numéricos: con Number(), 0 y vacíos al final en su orden original', () => {
  const casos = [
    ['hsjornal', 'hsjornal'],
    ['hsmaquina', 'hsmaquina'],
    ['tancadas', 'tancadas'],
    ['unidades', 'unidades'],
    ['importe', 'importe_total'],
  ]
  for (const [clave, campo] of casos) {
    const lineas = lineasDe([
      { [campo]: '12.50' },
      { [campo]: '9' },
      { [campo]: null },
      { [campo]: '0' },
      { [campo]: '' },
    ])
    assert.deepEqual(ids(ordenarLineas(lineas, asc(clave))), [2, 1, 3, 4, 5], clave)
    assert.deepEqual(ids(ordenarLineas(lineas, desc(clave))), [1, 2, 3, 4, 5], clave)
  }
})

test('conceptos: por cantidad, sin conceptos al final', () => {
  const lineas = lineasDe([
    { conceptos: [{}, {}] },
    { conceptos: [] },
    {},
    { conceptos: [{}] },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('conceptos'))), [4, 1, 2, 3])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('conceptos'))), [1, 4, 2, 3])
})

test('alertaDe: precedencia DUPLICADO, INCOMPLETA, LEGAJO, EMPRESA', () => {
  assert.equal(alertaDe({ es_duplicado: true, alerta_legajo: true }), 'DUPLICADO')
  assert.equal(alertaDe({ linea_incompleta: true, alerta_legajo: true, alerta_empresa: true }), 'INCOMPLETA')
  assert.equal(alertaDe({ alerta_legajo: true, alerta_empresa: true }), 'LEGAJO')
  assert.equal(alertaDe({ alerta_empresa: true }), 'EMPRESA')
  assert.equal(alertaDe({}), null)
})

test('alerta: por gravedad, sin alerta al final en asc y desc', () => {
  const lineas = lineasDe([
    {},
    { alerta_empresa: true },
    { es_duplicado: true, alerta_legajo: true },
    { alerta_legajo: true },
    { linea_incompleta: true },
    { es_duplicado: true },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('alerta'))), [3, 6, 5, 4, 2, 1])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('alerta'))), [2, 4, 5, 3, 6, 1])
})

test('alertaDe: POSIBLE DUPLICADO va después de DUPLICADO y antes de INCOMPLETA', () => {
  assert.equal(alertaDe({ es_duplicado: true, es_posible_duplicado: true }), 'DUPLICADO')
  assert.equal(alertaDe({ es_posible_duplicado: true, linea_incompleta: true }), 'POSIBLE DUPLICADO')
  assert.equal(alertaDe({ es_posible_duplicado: true, alerta_legajo: true, alerta_empresa: true }), 'POSIBLE DUPLICADO')
})

test('alerta: POSIBLE DUPLICADO se ordena entre DUPLICADO e INCOMPLETA', () => {
  const lineas = lineasDe([
    { linea_incompleta: true },
    {},
    { es_posible_duplicado: true },
    { es_duplicado: true },
    { alerta_empresa: true },
  ])
  assert.deepEqual(ids(ordenarLineas(lineas, asc('alerta'))), [4, 3, 1, 5, 2])
  assert.deepEqual(ids(ordenarLineas(lineas, desc('alerta'))), [5, 1, 3, 4, 2])
})
