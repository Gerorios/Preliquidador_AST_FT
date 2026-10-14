// Tests de las Unidades de facturación del front (node --test, sin
// dependencias). Las nueve claves son el espejo de
// app/modulos/facturacion/unidades.py (plan E1, D5).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UNIDADES, UNIDADES_COSECHA, ETIQUETAS } from './unidades.js'

test('las nueve unidades van con su etiqueta, en el orden de D5', () => {
  assert.deepEqual(UNIDADES, [
    'horas_peon', 'horas_tractor', 'plantas', 'hectareas', 'tancadas',
    'bins', 'bins_c', 'bins_m', 'viajes',
  ])
  assert.deepEqual(UNIDADES.map(u => ETIQUETAS[u]), [
    'Horas de peón', 'Horas de tractor', 'Plantas', 'Hectáreas', 'Tancadas',
    'Bins', 'Bins C', 'Bins M', 'Viajes',
  ])
  assert.equal(Object.keys(ETIQUETAS).length, 9)
})

test('las de cosecha son las últimas cuatro', () => {
  assert.deepEqual(UNIDADES_COSECHA, ['bins', 'bins_c', 'bins_m', 'viajes'])
  assert.deepEqual(UNIDADES_COSECHA, UNIDADES.slice(-4))
})
