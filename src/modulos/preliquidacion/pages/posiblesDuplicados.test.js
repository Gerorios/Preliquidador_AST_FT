// Tests del agrupado de la sección "Posibles duplicados" de Verificación
// (node --test, sin dependencias). Los decimales van como strings a propósito:
// así llegan los Decimal del backend. Datos inventados.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agruparPosiblesDuplicados } from './posiblesDuplicados.js'

let proximoId = 1

// Línea de campo con los campos de la clave del backend
// (`clave_posible_duplicado`) más los que muestra la sección.
const linea = (kw = {}) => ({
  id: proximoId++,
  planilla: 'P-0001',
  fecha_tarea: '2026-08-20',
  legajo_campo: '1234',
  legajo_asignado: null,
  nombre_empleado: 'GOMEZ ANA',
  nombre_tarea: 'DESMALEZADO',
  nombre_cliente: 'CLIENTE UNO',
  nombre_finca: 'FINCA NORTE',
  nombre_tractor: 'TRACTOR 7',
  nombre_supervisor: 'SUPERVISOR X',
  tancadas: null,
  unidades: '500',
  hsjornal: '8',
  hsmaquina: '4',
  importe_total: '400',
  es_duplicado: false,
  es_posible_duplicado: false,
  ...kw,
})

const ids = (item) => item.lineas.map(l => l.id)

test('sin líneas marcadas: lista vacía', () => {
  assert.deepEqual(agruparPosiblesDuplicados([]), [])
  const a = linea()
  const b = linea({ hsmaquina: '5' })
  assert.deepEqual(agruparPosiblesDuplicados([a, b]), [])
})

test('par marcado: un item con persona, día, líneas e importe en duda', () => {
  const a = linea({ hsmaquina: '4', importe_total: '400', es_posible_duplicado: true })
  const b = linea({ hsmaquina: '5', importe_total: '500', es_posible_duplicado: true })
  const r = agruparPosiblesDuplicados([a, b])
  assert.equal(r.length, 1)
  assert.deepEqual(r[0], {
    clave: `${a.id}-${b.id}`,
    legajo: '1234',
    nombre_empleado: 'GOMEZ ANA',
    fecha: '2026-08-20',
    lineas: [a, b],
    valor: 400,
  })
})

test('legajo: el asignado manda sobre el de campo', () => {
  const a = linea({ legajo_asignado: '9999', es_posible_duplicado: true })
  const b = linea({ legajo_asignado: '9999', hsmaquina: '5', es_posible_duplicado: true })
  assert.equal(agruparPosiblesDuplicados([a, b])[0].legajo, '9999')
})

test('duplicadas más una posible con la misma clave: un item con las tres', () => {
  const a = linea({ hsmaquina: '4', importe_total: '400', es_duplicado: true })
  const b = linea({ hsmaquina: '4', importe_total: '400', es_duplicado: true })
  const c = linea({ hsmaquina: '5', importe_total: '500.50', es_posible_duplicado: true })
  const r = agruparPosiblesDuplicados([a, b, c])
  assert.equal(r.length, 1)
  assert.deepEqual(ids(r[0]), [a.id, b.id, c.id])
  // Suma 1300.50 menos la de mayor importe (500.50).
  assert.equal(r[0].valor, 800)
})

test('importe en duda a dos decimales, sin error de punto flotante', () => {
  const a = linea({ importe_total: '0.1', es_posible_duplicado: true })
  const b = linea({ hsmaquina: '5', importe_total: '0.2', es_posible_duplicado: true })
  const c = linea({ hsmaquina: '6', importe_total: '0.3', es_posible_duplicado: true })
  // 0.1 + 0.2 + 0.3 - 0.3 da 0.30000000000000004 en punto flotante.
  assert.equal(agruparPosiblesDuplicados([a, b, c])[0].valor, 0.3)
})

test('misma persona y día en dos fincas: dos items', () => {
  const a = linea({ nombre_finca: 'FINCA NORTE', es_posible_duplicado: true })
  const b = linea({ nombre_finca: 'FINCA NORTE', hsmaquina: '5', es_posible_duplicado: true })
  const c = linea({ nombre_finca: 'FINCA SUR', es_posible_duplicado: true })
  const d = linea({ nombre_finca: 'FINCA SUR', hsmaquina: '5', es_posible_duplicado: true })
  const r = agruparPosiblesDuplicados([a, b, c, d])
  assert.equal(r.length, 2)
  assert.deepEqual(r.map(ids).sort(), [[a.id, b.id], [c.id, d.id]].sort())
})

test('normaliza mayúsculas y espacios en los nombres, y sólo espacios en el legajo', () => {
  const a = linea({
    planilla: 'p-0001', nombre_empleado: ' gomez ana ', nombre_tarea: 'desmalezado',
    nombre_cliente: 'Cliente Uno', nombre_finca: ' finca norte ', nombre_tractor: 'tractor 7 ',
    legajo_campo: ' 1234 ', es_posible_duplicado: true,
  })
  const b = linea({ hsmaquina: '5', es_posible_duplicado: true })
  const r = agruparPosiblesDuplicados([a, b])
  assert.equal(r.length, 1)
  assert.deepEqual(ids(r[0]), [a.id, b.id])
})

test('cantidades: el mismo valor con y sin decimales es la misma clave', () => {
  const a = linea({ unidades: '500', tancadas: null, es_posible_duplicado: true })
  const b = linea({ unidades: '500.00', tancadas: null, hsmaquina: '5', es_posible_duplicado: true })
  assert.equal(agruparPosiblesDuplicados([a, b]).length, 1)
})

test('otra cantidad, planilla o tractor: no agrupa', () => {
  for (const campo of [{ unidades: '501' }, { planilla: 'P-0002' }, { nombre_tractor: 'TRACTOR 8' }]) {
    const a = linea({ es_posible_duplicado: true })
    const b = linea({ ...campo, hsmaquina: '5', es_posible_duplicado: true })
    assert.deepEqual(agruparPosiblesDuplicados([a, b]), [], JSON.stringify(campo))
  }
})

test('sin cantidad mayor a 0: no agrupa', () => {
  const a = linea({ unidades: '0', tancadas: null, es_posible_duplicado: true })
  const b = linea({ unidades: '0.00', tancadas: null, hsmaquina: '5', es_posible_duplicado: true })
  assert.deepEqual(agruparPosiblesDuplicados([a, b]), [])
})

test('una línea marcada cuya compañera se filtró: se oculta', () => {
  const a = linea({ es_posible_duplicado: true })
  assert.deepEqual(agruparPosiblesDuplicados([a]), [])
})

test('grupo de sólo duplicadas, sin posible: no aparece', () => {
  const a = linea({ es_duplicado: true })
  const b = linea({ es_duplicado: true })
  assert.deepEqual(agruparPosiblesDuplicados([a, b]), [])
})

test('orden por importe en duda, de mayor a menor', () => {
  const chicoA = linea({ legajo_campo: '1', importe_total: '100', es_posible_duplicado: true })
  const chicoB = linea({ legajo_campo: '1', hsmaquina: '5', importe_total: '150', es_posible_duplicado: true })
  const grandeA = linea({ legajo_campo: '2', importe_total: '900', es_posible_duplicado: true })
  const grandeB = linea({ legajo_campo: '2', hsmaquina: '5', importe_total: '1000', es_posible_duplicado: true })
  const r = agruparPosiblesDuplicados([chicoA, chicoB, grandeA, grandeB])
  assert.deepEqual(r.map(i => i.valor), [900, 100])
})
