// Tests de las filas del listado de Comprobantes (node --test, sin
// dependencias). Las filas de entrada tienen la forma de `ComprobanteFila`
// del backend (app/modulos/facturacion/schemas.py, plan E2, sección 3.2), y
// los campos se prueban contra opcionesCascada del núcleo, que es lo que usa
// la barra común para armar las opciones de cada filtro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMPOS_COMPROBANTES, ALERTAS_COMPROBANTES, textoMes, filaDelListado,
  pasaBusquedaYAlertas, pasaCampos, filtrarComprobantes,
} from './listado.js'
import { opcionesCascada } from '../../core/ui/opcionesCascada.js'

// Una fila tal como la devuelve GET /api/facturacion/comprobantes.
const fila = (cambios = {}) => ({
  id: 1,
  tipo: 'factura',
  numero: '0001-00001234',
  fecha: '2025-08-20',
  mes: '2025-08',
  cliente_id: 12,
  cliente_nombre: 'CLIENTE UNO',
  empresa_emisora: 'EMPRESA A',
  es_historico: false,
  pendiente_de_facturar: false,
  cantidad_lineas: 3,
  cantidad_adjuntos: 1,
  total_neto: '1500.00',
  ...cambios,
})

// Un histórico sin número ni Empresa, como los que deja la migración.
const historicoSinNumero = (cambios = {}) => fila({
  id: 9, numero: null, fecha: null, empresa_emisora: null,
  es_historico: true, cantidad_adjuntos: 0, ...cambios,
})

const opciones = (filas, filtros = {}) =>
  opcionesCascada(filas.map(filaDelListado), filtros, CAMPOS_COMPROBANTES)

// ─── Campos de la barra común ───────────────────────────────────────────────

test('CAMPOS_COMPROBANTES: Cliente, Empresa emisora, Tipo, Mes y Adjunto, en ese orden', () => {
  assert.deepEqual(CAMPOS_COMPROBANTES.map(c => c.label),
    ['Cliente', 'Empresa emisora', 'Tipo', 'Mes', 'Adjunto'])
  for (const c of CAMPOS_COMPROBANTES) {
    assert.equal(typeof c.key, 'string')
    assert.equal(typeof c.field, 'string')
  }
})

test('textoMes: "AAAA-MM" pasa a "ago 2025", y sin mes no hay texto', () => {
  assert.equal(textoMes('2025-08'), 'ago 2025')
  assert.equal(textoMes('2026-01'), 'ene 2026')
  assert.equal(textoMes('2025-12'), 'dic 2025')
  assert.equal(textoMes(null), null)
  assert.equal(textoMes(''), null)
})

test('las opciones de la barra salen con los textos que ve el usuario', () => {
  const filas = [
    fila(),
    fila({ id: 2, tipo: 'nota_credito', cliente_nombre: 'CLIENTE DOS', empresa_emisora: 'EMPRESA B',
      mes: '2026-01', cantidad_adjuntos: 0, total_neto: '-200.00' }),
  ]
  const o = opciones(filas)
  assert.deepEqual(o.cliente, ['CLIENTE DOS', 'CLIENTE UNO'])
  assert.deepEqual(o.empresa, ['EMPRESA A', 'EMPRESA B'])
  assert.deepEqual(o.tipo, ['Factura', 'Nota de crédito'])
  assert.deepEqual(o.mes, ['ene 2026', 'ago 2025'])
  assert.deepEqual(o.adjunto, ['Con adjunto', 'Sin adjunto'])
})

test('el filtro Mes ofrece los meses por fecha, del más nuevo al más viejo', () => {
  const meses = ['2025-08', '2026-04', '2025-12', '2026-01', '2025-09', '2026-02']
  const filas = meses.map((mes, i) => fila({ id: i + 1, mes }))
  assert.deepEqual(opciones(filas).mes,
    ['abr 2026', 'feb 2026', 'ene 2026', 'dic 2025', 'sep 2025', 'ago 2025'])
})

test('el campo Mes trae su `orden`: un comparador del mes más nuevo al más viejo', () => {
  const mes = CAMPOS_COMPROBANTES.find(c => c.key === 'mes')
  assert.equal(typeof mes.orden, 'function')
  assert.deepEqual(['ago 2025', 'may 2026', 'mar 2026', 'dic 2024', 'ene 2025'].sort(mes.orden),
    ['may 2026', 'mar 2026', 'ago 2025', 'ene 2025', 'dic 2024'])
  for (const c of CAMPOS_COMPROBANTES.filter(c => c.key !== 'mes')) assert.equal(c.orden, undefined)
})

test('un histórico sin Empresa emisora aparece como "Sin empresa"', () => {
  const o = opciones([fila(), historicoSinNumero()])
  assert.deepEqual(o.empresa, ['EMPRESA A', 'Sin empresa'])
  assert.equal(filaDelListado(historicoSinNumero()).empresa_texto, 'Sin empresa')
})

test('filtrar por "Sin empresa" trae sólo los históricos', () => {
  const filas = [fila(), historicoSinNumero()].map(filaDelListado)
  const filtradas = filtrarComprobantes(filas, '', { empresa: ['Sin empresa'] })
  assert.deepEqual(filtradas.map(f => f.id), [9])
})

// ─── "Sin adjunto" ──────────────────────────────────────────────────────────

test('"Sin adjunto" excluye a los históricos: en el campo Adjunto', () => {
  const filas = [
    fila({ id: 1, cantidad_adjuntos: 0 }),
    historicoSinNumero({ id: 2 }),
    fila({ id: 3, es_historico: true, empresa_emisora: null, cantidad_adjuntos: 0 }),
  ].map(filaDelListado)
  const filtradas = filtrarComprobantes(filas, '', { adjunto: ['Sin adjunto'] })
  assert.deepEqual(filtradas.map(f => f.id), [1])
})

test('un histórico con adjuntos cuenta como "Con adjunto"', () => {
  const f = filaDelListado(historicoSinNumero({ cantidad_adjuntos: 2 }))
  assert.equal(f.adjunto_texto, 'Con adjunto')
})

test('ALERTAS_COMPROBANTES: la Alerta "Sin adjunto", con la forma que espera la barra', () => {
  assert.equal(ALERTAS_COMPROBANTES.length, 1)
  const [a] = ALERTAS_COMPROBANTES
  assert.equal(a.label, 'Sin adjunto')
  assert.equal(typeof a.value, 'string')
  assert.equal(typeof a.tono, 'string')
})

test('la Alerta "Sin adjunto" trae los cargados a mano sin adjunto y nunca un histórico', () => {
  const alerta = ALERTAS_COMPROBANTES[0].value
  const filas = [
    fila({ id: 1, cantidad_adjuntos: 0 }),
    fila({ id: 2, cantidad_adjuntos: 1 }),
    historicoSinNumero({ id: 3 }),
    fila({ id: 4, tipo: 'nota_credito', cantidad_adjuntos: 0, total_neto: '-10.00' }),
  ].map(filaDelListado)
  const filtradas = filtrarComprobantes(filas, '', { alerta })
  assert.deepEqual(filtradas.map(f => f.id), [1, 4])
})

// ─── Número y Pendiente de facturar ─────────────────────────────────────────

test('un Comprobante con número lo muestra tal cual, sin etiqueta', () => {
  const f = filaDelListado(fila())
  assert.equal(f.numero_texto, '0001-00001234')
  assert.equal(f.etiqueta, null)
})

test('un histórico sin número muestra "Sin número"', () => {
  const f = filaDelListado(historicoSinNumero())
  assert.equal(f.numero_texto, 'Sin número')
  assert.equal(f.etiqueta, null)
})

test('un histórico pendiente de facturar lleva además la etiqueta "Pendiente de facturar"', () => {
  const f = filaDelListado(historicoSinNumero({ pendiente_de_facturar: true }))
  assert.equal(f.numero_texto, 'Sin número')
  assert.equal(f.etiqueta, 'Pendiente de facturar')
})

test('filaDelListado conserva los campos de la API', () => {
  const original = fila()
  const f = filaDelListado(original)
  for (const [k, v] of Object.entries(original)) assert.deepEqual(f[k], v)
})

// ─── Búsqueda ───────────────────────────────────────────────────────────────

test('la búsqueda encuentra por número, sin distinguir mayúsculas y por una parte', () => {
  const filas = [
    fila({ id: 1, numero: 'A-0001-00001234' }),
    fila({ id: 2, numero: 'A-0001-00009999' }),
  ].map(filaDelListado)
  assert.deepEqual(filtrarComprobantes(filas, '1234', {}).map(f => f.id), [1])
  assert.deepEqual(filtrarComprobantes(filas, 'a-0001', {}).map(f => f.id), [1, 2])
})

test('la búsqueda encuentra por Cliente, sin distinguir mayúsculas', () => {
  const filas = [
    fila({ id: 1, cliente_nombre: 'CLIENTE UNO' }),
    fila({ id: 2, cliente_nombre: 'OTRO' }),
  ].map(filaDelListado)
  assert.deepEqual(filtrarComprobantes(filas, 'cliente u', {}).map(f => f.id), [1])
})

test('la búsqueda no rompe con un histórico sin número', () => {
  const filas = [historicoSinNumero({ id: 1 }), fila({ id: 2, numero: '55' })].map(filaDelListado)
  assert.deepEqual(filtrarComprobantes(filas, '55', {}).map(f => f.id), [2])
  assert.deepEqual(filtrarComprobantes(filas, 'cliente uno', {}).map(f => f.id), [1, 2])
})

test('sin búsqueda ni filtros pasan todas, en el orden que vinieron', () => {
  const filas = [fila({ id: 3 }), historicoSinNumero({ id: 1 }), fila({ id: 2 })].map(filaDelListado)
  assert.deepEqual(filtrarComprobantes(filas, '', {}).map(f => f.id), [3, 1, 2])
})

// ─── Combinación, como la usa la barra ──────────────────────────────────────

test('pasaBusquedaYAlertas y pasaCampos se combinan como filtrarComprobantes', () => {
  const filas = [
    fila({ id: 1, tipo: 'factura', cantidad_adjuntos: 0 }),
    fila({ id: 2, tipo: 'nota_credito', cantidad_adjuntos: 0, total_neto: '-1.00' }),
    fila({ id: 3, tipo: 'factura', cliente_nombre: 'OTRO', cantidad_adjuntos: 0 }),
  ].map(filaDelListado)
  const filtros = { tipo: ['Factura'], alerta: ALERTAS_COMPROBANTES[0].value }
  const esperado = filas.filter(f => pasaBusquedaYAlertas(f, 'cliente', filtros) && pasaCampos(f, filtros))
  assert.deepEqual(esperado.map(f => f.id), [1])
  assert.deepEqual(filtrarComprobantes(filas, 'cliente', filtros).map(f => f.id), [1])
})

test('las opciones de cada filtro salen sólo de lo que pasa la búsqueda y la Alerta', () => {
  const filas = [
    fila({ id: 1, cliente_nombre: 'CLIENTE UNO', cantidad_adjuntos: 0 }),
    fila({ id: 2, cliente_nombre: 'CLIENTE DOS', cantidad_adjuntos: 1 }),
  ].map(filaDelListado)
  const filtros = { alerta: ALERTAS_COMPROBANTES[0].value }
  const prefiltro = f => pasaBusquedaYAlertas(f, '', filtros)
  const o = opcionesCascada(filas, filtros, CAMPOS_COMPROBANTES, prefiltro)
  assert.deepEqual(o.cliente, ['CLIENTE UNO'])
})
