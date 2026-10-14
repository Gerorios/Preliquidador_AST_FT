// Tests de los períodos del Resumen (node --test, sin dependencias; plan E3,
// FA1). `hoy` va siempre fijo y armado con la hora local (new Date(año, mes,
// día)), para que el resultado no dependa del huso de la máquina que corre los
// tests. Los meses viajan como "AAAA-MM", igual que `desde` y `hasta` de
// GET /api/facturacion/resumen (plan E3, sección 3.2, ruta 13).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ATAJOS_RESUMEN, ATAJO_INICIAL, MESES_MAXIMOS, periodoDeAtajo, rangoValido,
} from './periodo.js'

// Los meses de Date van de 0 a 11: acá se escriben de 1 a 12, como en el texto.
const dia = (anio, mes, d) => new Date(anio, mes - 1, d)

const OCTUBRE = dia(2026, 10, 14)
const ENERO = dia(2027, 1, 5)
const FEBRERO = dia(2027, 2, 20)

// ─── Atajos ─────────────────────────────────────────────────────────────────

test('ATAJOS_RESUMEN: Mes pasado, Este mes, Últimos 3 meses y Este año, en ese orden', () => {
  assert.deepEqual(ATAJOS_RESUMEN.map(a => a.label),
    ['Mes pasado', 'Este mes', 'Últimos 3 meses', 'Este año'])
  for (const a of ATAJOS_RESUMEN) assert.equal(typeof a.id, 'string')
})

test('ATAJO_INICIAL: el Resumen arranca en el mes pasado', () => {
  assert.equal(ATAJOS_RESUMEN.find(a => a.id === ATAJO_INICIAL)?.label, 'Mes pasado')
})

test('periodoDeAtajo: en octubre, cada atajo da su rango de meses', () => {
  assert.deepEqual(periodoDeAtajo('mes_pasado', OCTUBRE), { desde: '2026-09', hasta: '2026-09' })
  assert.deepEqual(periodoDeAtajo('este_mes', OCTUBRE), { desde: '2026-10', hasta: '2026-10' })
  // Los tres meses cerrados, sin el mes en curso (como el mockup aprobado).
  assert.deepEqual(periodoDeAtajo('ultimos_3', OCTUBRE), { desde: '2026-07', hasta: '2026-09' })
  // De enero al mes en curso, incluido.
  assert.deepEqual(periodoDeAtajo('este_anio', OCTUBRE), { desde: '2026-01', hasta: '2026-10' })
})

test('periodoDeAtajo: en enero, el mes pasado es diciembre y "Este año" es sólo enero', () => {
  assert.deepEqual(periodoDeAtajo('mes_pasado', ENERO), { desde: '2026-12', hasta: '2026-12' })
  assert.deepEqual(periodoDeAtajo('este_mes', ENERO), { desde: '2027-01', hasta: '2027-01' })
  assert.deepEqual(periodoDeAtajo('este_anio', ENERO), { desde: '2027-01', hasta: '2027-01' })
  assert.deepEqual(periodoDeAtajo('ultimos_3', ENERO), { desde: '2026-10', hasta: '2026-12' })
})

test('periodoDeAtajo: "Últimos 3 meses" cruza el año', () => {
  assert.deepEqual(periodoDeAtajo('ultimos_3', FEBRERO), { desde: '2026-11', hasta: '2027-01' })
})

test('periodoDeAtajo: el primer y el último día del mes no cambian el mes', () => {
  assert.deepEqual(periodoDeAtajo('mes_pasado', dia(2026, 3, 1)), { desde: '2026-02', hasta: '2026-02' })
  assert.deepEqual(periodoDeAtajo('mes_pasado', dia(2026, 3, 31)), { desde: '2026-02', hasta: '2026-02' })
})

test('periodoDeAtajo: un atajo que no existe no da período', () => {
  assert.equal(periodoDeAtajo('otro', OCTUBRE), null)
  assert.equal(periodoDeAtajo(undefined, OCTUBRE), null)
})

test('periodoDeAtajo: todos los atajos dan un rango válido', () => {
  for (const hoy of [OCTUBRE, ENERO, FEBRERO, dia(2026, 12, 31)]) {
    for (const a of ATAJOS_RESUMEN) {
      const { desde, hasta } = periodoDeAtajo(a.id, hoy)
      assert.equal(rangoValido(desde, hasta, hoy), true, `${a.id} el ${hoy.toDateString()}`)
    }
  }
})

// ─── rangoValido ────────────────────────────────────────────────────────────

test('MESES_MAXIMOS: el Resumen pide hasta 12 meses, como el backend', () => {
  assert.equal(MESES_MAXIMOS, 12)
})

test('rangoValido: un mes solo y hasta el mes en curso valen', () => {
  assert.equal(rangoValido('2026-09', '2026-09', OCTUBRE), true)
  assert.equal(rangoValido('2026-10', '2026-10', OCTUBRE), true)
  assert.equal(rangoValido('2025-12', '2026-10', OCTUBRE), true)
})

test('rangoValido: hasta antes de desde no vale', () => {
  assert.equal(rangoValido('2026-09', '2026-08', OCTUBRE), false)
  assert.equal(rangoValido('2027-01', '2026-12', ENERO), false)
})

test('rangoValido: 12 meses valen y 13 no, también cruzando el año', () => {
  assert.equal(rangoValido('2025-11', '2026-10', OCTUBRE), true)
  assert.equal(rangoValido('2025-10', '2026-10', OCTUBRE), false)
  assert.equal(rangoValido('2025-10', '2026-09', OCTUBRE), true)
  assert.equal(rangoValido('2025-09', '2026-09', OCTUBRE), false)
})

test('rangoValido: un hasta después del mes en curso no vale', () => {
  assert.equal(rangoValido('2026-10', '2026-11', OCTUBRE), false)
  assert.equal(rangoValido('2026-11', '2026-11', OCTUBRE), false)
  assert.equal(rangoValido('2026-12', '2027-01', dia(2026, 12, 31)), false)
  assert.equal(rangoValido('2026-12', '2027-01', ENERO), true)
})

test('rangoValido: un mes mal escrito o vacío no vale', () => {
  for (const malo of ['2026-13', '2026-00', '2026-9', '2026/09', 'x', '', null, undefined]) {
    assert.equal(rangoValido(malo, '2026-09', OCTUBRE), false, `desde ${malo}`)
    assert.equal(rangoValido('2026-09', malo, OCTUBRE), false, `hasta ${malo}`)
  }
})
