// Tests del aviso de lo que no entra en el filtro (node --test, sin
// dependencias; Ticket 4 de la spec de la E3a por grupo, decisión 7). La fila
// tiene la forma de GET /api/facturacion/resumen: `desde` y `hasta` son el
// filtro recortado al mes y `comprobantes_fuera`, los Comprobantes con alguna
// Línea que cae en parte afuera, con el período de esas Líneas.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avisoFueraDelFiltro } from './fueraDelFiltro.js'

const FACTURA = { id: 7, tipo: 'factura', numero: '0001-00001234', desde: '2026-07-01', hasta: '2026-07-15' }

const fila = (comprobantes, extra = {}) => ({
  cliente_id: 12,
  mes: '2026-07',
  desde: '2026-07-01',
  hasta: '2026-07-10',
  estados: ['sin_comparar'],
  comprobantes_fuera: comprobantes,
  ...extra,
})

test('avisoFueraDelFiltro: sin Comprobantes afuera, no hay aviso', () => {
  assert.equal(avisoFueraDelFiltro(fila([])), null)
  assert.equal(avisoFueraDelFiltro(fila(undefined)), null)
  assert.equal(avisoFueraDelFiltro(null), null)
})

test('avisoFueraDelFiltro: una Factura del 1 al 15 con el filtro del 1 al 10, el texto del boceto', () => {
  assert.deepEqual(avisoFueraDelFiltro(fila([FACTURA])), {
    titulo: '1 factura no entra en este filtro',
    comprobantes: [],
    texto: 'La Factura 0001-00001234 cubre del 1 al 15 de julio, y el filtro termina el 10. '
      + 'Para compararla, mirá la quincena entera.',
    boton: { texto: 'Ver del 1 al 15 de julio', desde: '2026-07-01', hasta: '2026-07-15' },
  })
})

test('avisoFueraDelFiltro: si el filtro corta el principio, dice dónde empieza', () => {
  const aviso = avisoFueraDelFiltro(fila([FACTURA], { desde: '2026-07-05', hasta: '2026-07-31' }))
  assert.equal(aviso.texto, 'La Factura 0001-00001234 cubre del 1 al 15 de julio, y el filtro empieza el 5. '
    + 'Para compararla, mirá la quincena entera.')
})

test('avisoFueraDelFiltro: si corta las dos puntas, dice de dónde a dónde va', () => {
  const aviso = avisoFueraDelFiltro(fila([FACTURA], { desde: '2026-07-05', hasta: '2026-07-10' }))
  assert.equal(aviso.texto, 'La Factura 0001-00001234 cubre del 1 al 15 de julio, y el filtro va del 5 al 10. '
    + 'Para compararla, mirá la quincena entera.')
})

test('avisoFueraDelFiltro: una Nota de crédito se nombra como tal; sin número, "sin número"', () => {
  const nota = { id: 8, tipo: 'nota_credito', numero: null, desde: '2026-07-16', hasta: '2026-07-31' }
  const aviso = avisoFueraDelFiltro(fila([nota], { desde: '2026-07-20', hasta: '2026-07-31' }))
  assert.equal(aviso.titulo, '1 nota de crédito no entra en este filtro')
  assert.equal(aviso.texto, 'La Nota de crédito sin número cubre del 16 al 31 de julio, y el filtro empieza el 20. '
    + 'Para compararla, mirá la quincena entera.')
  assert.deepEqual(aviso.boton, { texto: 'Ver del 16 al 31 de julio', desde: '2026-07-16', hasta: '2026-07-31' })
})

test('avisoFueraDelFiltro: con varias, el título las cuenta y la lista nombra cada una', () => {
  const otra = { ...FACTURA, id: 9, numero: '0001-00001240' }
  const aviso = avisoFueraDelFiltro(fila([FACTURA, otra]))
  assert.deepEqual(aviso, {
    titulo: '2 facturas no entran en este filtro',
    comprobantes: [
      'Factura 0001-00001234 cubre del 1 al 15 de julio',
      'Factura 0001-00001240 cubre del 1 al 15 de julio',
    ],
    texto: 'El filtro termina el 10. Para compararlas, mirá la quincena entera.',
    boton: { texto: 'Ver del 1 al 15 de julio', desde: '2026-07-01', hasta: '2026-07-15' },
  })
})

test('avisoFueraDelFiltro: varias notas de crédito, y una factura con una nota, "comprobantes"', () => {
  const nota = { id: 8, tipo: 'nota_credito', numero: '0001-00000050', desde: '2026-07-01', hasta: '2026-07-15' }
  const notas = avisoFueraDelFiltro(fila([nota, { ...nota, id: 10, numero: '0001-00000051' }]))
  assert.equal(notas.titulo, '2 notas de crédito no entran en este filtro')
  assert.equal(notas.texto, 'El filtro termina el 10. Para compararlas, mirá la quincena entera.')
  const mixto = avisoFueraDelFiltro(fila([FACTURA, nota]))
  assert.equal(mixto.titulo, '2 comprobantes no entran en este filtro')
  assert.equal(mixto.texto, 'El filtro termina el 10. Para compararlos, mirá la quincena entera.')
})

test('avisoFueraDelFiltro: si lo que no entra cubre el mes entero, el botón lleva al mes entero', () => {
  // Una factura de cada quincena y el filtro del 10 al 20: no entra ninguna.
  const segunda = { ...FACTURA, id: 9, numero: '0001-00001240', desde: '2026-07-16', hasta: '2026-07-31' }
  const aviso = avisoFueraDelFiltro(fila([FACTURA, segunda], { desde: '2026-07-10', hasta: '2026-07-20' }))
  assert.deepEqual(aviso.comprobantes, [
    'Factura 0001-00001234 cubre del 1 al 15 de julio',
    'Factura 0001-00001240 cubre del 16 al 31 de julio',
  ])
  assert.equal(aviso.texto, 'El filtro va del 10 al 20. Para compararlas, mirá el mes entero.')
  assert.deepEqual(aviso.boton, { texto: 'Ver julio entero', desde: '2026-07-01', hasta: '2026-07-31' })
})

test('avisoFueraDelFiltro: en un mes que no se compara (Antes del corte, en gris), no hay aviso', () => {
  assert.equal(avisoFueraDelFiltro(fila([FACTURA], { estados: ['antes_del_corte', 'falta_comprobante'] })), null)
})

test('avisoFueraDelFiltro: un período en curso se compara, así que el aviso va', () => {
  // El mes en curso se controla como los demás (plan del 2026-10-17): sólo
  // Antes del corte apaga el aviso. Una clave mes_en_curso, si llegara, no.
  const enCurso = { mes: '2026-10', desde: '2026-10-01', hasta: '2026-10-10', en_curso: true }
  const factura = { ...FACTURA, desde: '2026-10-01', hasta: '2026-10-15' }
  for (const estados of [['sin_comparar'], ['mes_en_curso', 'falta_comprobante']]) {
    const aviso = avisoFueraDelFiltro(fila([factura], { ...enCurso, estados }))
    assert.equal(aviso?.titulo, '1 factura no entra en este filtro', estados.join(', '))
  }
})
