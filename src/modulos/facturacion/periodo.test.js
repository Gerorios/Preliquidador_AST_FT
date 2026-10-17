// Tests de los períodos del Resumen (node --test, sin dependencias; plan E3,
// FA1, y Ticket 4 de la spec de la E3a por grupo: el filtro por día). `hoy` va
// siempre fijo y armado con la hora local (new Date(año, mes, día)), para que
// el resultado no dependa del huso de la máquina que corre los tests. Los días
// viajan como "AAAA-MM-DD", igual que `desde` y `hasta` de
// GET /api/facturacion/resumen.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATAJOS_RESUMEN, ATAJO_INICIAL, MESES_MAXIMOS, periodoDeAtajo, rangoValido, topeDelPeriodo,
} from './periodo.js'

// Los meses de Date van de 0 a 11: acá se escriben de 1 a 12, como en el texto.
const dia = (anio, mes, d) => new Date(anio, mes - 1, d)

const OCTUBRE = dia(2026, 10, 14)
const OCTUBRE_2DA = dia(2026, 10, 20)
const ENERO = dia(2027, 1, 5)
const FEBRERO = dia(2027, 2, 20)

// ─── Atajos ─────────────────────────────────────────────────────────────────

test('ATAJOS_RESUMEN: los seis atajos de la spec, en el orden de la barra', () => {
  assert.deepEqual(ATAJOS_RESUMEN.map(a => a.label), [
    'Quincena pasada', 'Esta quincena', 'Mes pasado', 'Este mes', 'Últimos 3 meses', 'Este año',
  ])
  for (const a of ATAJOS_RESUMEN) assert.equal(typeof a.id, 'string')
})

test('ATAJO_INICIAL: el Resumen arranca en el mes pasado', () => {
  assert.equal(ATAJOS_RESUMEN.find(a => a.id === ATAJO_INICIAL)?.label, 'Mes pasado')
})

test('periodoDeAtajo: en la 1.ª quincena de octubre, cada atajo da sus días', () => {
  const de = id => periodoDeAtajo(id, OCTUBRE)
  // La quincena pasada es la 2.ª de septiembre.
  assert.deepEqual(de('quincena_pasada'), { desde: '2026-09-16', hasta: '2026-09-30' })
  // Esta quincena, entera: los Comprobantes cubren quincenas enteras.
  assert.deepEqual(de('esta_quincena'), { desde: '2026-10-01', hasta: '2026-10-15' })
  assert.deepEqual(de('mes_pasado'), { desde: '2026-09-01', hasta: '2026-09-30' })
  assert.deepEqual(de('este_mes'), { desde: '2026-10-01', hasta: '2026-10-31' })
  // Los tres meses cerrados, sin el mes en curso (como el mockup aprobado).
  assert.deepEqual(de('ultimos_3'), { desde: '2026-07-01', hasta: '2026-09-30' })
  // Del 1 de enero al fin del mes en curso.
  assert.deepEqual(de('este_anio'), { desde: '2026-01-01', hasta: '2026-10-31' })
})

test('periodoDeAtajo: en la 2.ª quincena, la pasada es la 1.ª del mes', () => {
  assert.deepEqual(periodoDeAtajo('quincena_pasada', OCTUBRE_2DA), { desde: '2026-10-01', hasta: '2026-10-15' })
  assert.deepEqual(periodoDeAtajo('esta_quincena', OCTUBRE_2DA), { desde: '2026-10-16', hasta: '2026-10-31' })
  // El 15 es todavía la 1.ª; el 16, la 2.ª.
  assert.deepEqual(periodoDeAtajo('esta_quincena', dia(2026, 10, 15)), { desde: '2026-10-01', hasta: '2026-10-15' })
  assert.deepEqual(periodoDeAtajo('esta_quincena', dia(2026, 10, 16)), { desde: '2026-10-16', hasta: '2026-10-31' })
})

test('periodoDeAtajo: en enero, lo pasado es de diciembre y "Este año" es sólo enero', () => {
  assert.deepEqual(periodoDeAtajo('quincena_pasada', ENERO), { desde: '2026-12-16', hasta: '2026-12-31' })
  assert.deepEqual(periodoDeAtajo('mes_pasado', ENERO), { desde: '2026-12-01', hasta: '2026-12-31' })
  assert.deepEqual(periodoDeAtajo('este_mes', ENERO), { desde: '2027-01-01', hasta: '2027-01-31' })
  assert.deepEqual(periodoDeAtajo('este_anio', ENERO), { desde: '2027-01-01', hasta: '2027-01-31' })
  assert.deepEqual(periodoDeAtajo('ultimos_3', ENERO), { desde: '2026-10-01', hasta: '2026-12-31' })
})

test('periodoDeAtajo: "Últimos 3 meses" cruza el año', () => {
  assert.deepEqual(periodoDeAtajo('ultimos_3', FEBRERO), { desde: '2026-11-01', hasta: '2027-01-31' })
})

test('periodoDeAtajo: el fin de febrero, con y sin año bisiesto', () => {
  assert.deepEqual(periodoDeAtajo('mes_pasado', dia(2028, 3, 1)), { desde: '2028-02-01', hasta: '2028-02-29' })
  assert.deepEqual(periodoDeAtajo('quincena_pasada', dia(2027, 3, 3)), { desde: '2027-02-16', hasta: '2027-02-28' })
})

test('periodoDeAtajo: el primer y el último día del mes no cambian el mes', () => {
  assert.deepEqual(periodoDeAtajo('mes_pasado', dia(2026, 3, 1)), { desde: '2026-02-01', hasta: '2026-02-28' })
  assert.deepEqual(periodoDeAtajo('mes_pasado', dia(2026, 3, 31)), { desde: '2026-02-01', hasta: '2026-02-28' })
})

test('periodoDeAtajo: un atajo que no existe no da período', () => {
  assert.equal(periodoDeAtajo('otro', OCTUBRE), null)
  assert.equal(periodoDeAtajo(undefined, OCTUBRE), null)
})

test('periodoDeAtajo: todos los atajos dan un rango válido', () => {
  for (const hoy of [OCTUBRE, OCTUBRE_2DA, ENERO, FEBRERO, dia(2026, 12, 31)]) {
    for (const a of ATAJOS_RESUMEN) {
      const { desde, hasta } = periodoDeAtajo(a.id, hoy)
      assert.equal(rangoValido(desde, hasta, hoy), true, `${a.id} el ${hoy.toDateString()}`)
    }
  }
})

// ─── topeDelPeriodo y rangoValido ───────────────────────────────────────────

test('topeDelPeriodo: el último día del mes en curso', () => {
  assert.equal(topeDelPeriodo(OCTUBRE), '2026-10-31')
  assert.equal(topeDelPeriodo(dia(2027, 2, 1)), '2027-02-28')
})

test('MESES_MAXIMOS: el Resumen pide hasta 12 meses, como el backend', () => {
  assert.equal(MESES_MAXIMOS, 12)
})

test('rangoValido: un día, una parte del mes y hasta el fin del mes en curso valen', () => {
  assert.equal(rangoValido('2026-10-10', '2026-10-10', OCTUBRE), true)
  assert.equal(rangoValido('2026-10-01', '2026-10-10', OCTUBRE), true)
  assert.equal(rangoValido('2026-09-20', '2026-10-31', OCTUBRE), true)
})

test('rangoValido: hasta antes de desde no vale', () => {
  assert.equal(rangoValido('2026-10-11', '2026-10-10', OCTUBRE), false)
  assert.equal(rangoValido('2027-01-01', '2026-12-31', ENERO), false)
})

test('rangoValido: cuenta los meses que toca: 12 valen y 13 no', () => {
  assert.equal(rangoValido('2025-11-30', '2026-10-01', OCTUBRE), true)
  assert.equal(rangoValido('2025-10-31', '2026-10-01', OCTUBRE), false)
  assert.equal(rangoValido('2025-10-01', '2026-09-30', OCTUBRE), true)
  assert.equal(rangoValido('2025-09-30', '2026-09-01', OCTUBRE), false)
})

test('rangoValido: un hasta después del mes en curso no vale', () => {
  assert.equal(rangoValido('2026-10-01', '2026-11-01', OCTUBRE), false)
  assert.equal(rangoValido('2026-11-01', '2026-11-10', OCTUBRE), false)
  assert.equal(rangoValido('2026-12-01', '2027-01-01', dia(2026, 12, 31)), false)
  assert.equal(rangoValido('2026-12-01', '2027-01-31', ENERO), true)
})

test('rangoValido: un día mal escrito, que no existe o vacío no vale', () => {
  const malos = ['2026-10', '2026-13-01', '2026-02-30', '2026-10-32', '2026-10-1', '2026/10/01', 'x', '', null, undefined]
  for (const malo of malos) {
    assert.equal(rangoValido(malo, '2026-10-10', OCTUBRE), false, `desde ${malo}`)
    assert.equal(rangoValido('2026-10-01', malo, OCTUBRE), false, `hasta ${malo}`)
  }
})
