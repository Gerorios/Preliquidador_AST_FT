// Tests de las filas, los cuadros de Alertas, los filtros y los totales del
// Resumen (node --test, sin dependencias; plan E3, FA3). Las filas de entrada
// tienen la forma de cada fila de GET /api/facturacion/resumen (plan E3,
// sección 3.2, ruta 13), y los campos se prueban contra opcionesCascada del
// núcleo, que es lo que usa la barra común para armar las opciones de cada
// filtro.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CAMPOS_RESUMEN, filaDelResumen, datosParaFiltros, filtrarResumen,
  contarAlertas, totales,
} from './resumen.js'
import { delMesMasNuevo } from './listado.js'
import { opcionesCascada } from '../../core/ui/opcionesCascada.js'

// Una fila tal como la manda el backend: las medidas y el neto como texto
// decimal, y los estados ordenados por urgencia.
const fila = (cambios = {}) => ({
  cliente_id: 12,
  cliente_nombre: 'CLIENTE UNO',
  mes: '2026-09',
  horas_peon: '120.50',
  horas_tractor: '8.00',
  tancadas: '0',
  plantas: '0',
  hectareas: '4.25',
  facturado_neto: '1500.00',
  estados: ['facturada'],
  diferencia_revisada: false,
  comprobantes_sin_adjunto: [],
  ...cambios,
})

const filas = lista => lista.map(filaDelResumen)

const opciones = (lista, filtros = {}) =>
  opcionesCascada(datosParaFiltros(filas(lista)), filtros, CAMPOS_RESUMEN)

// ─── delMesMasNuevo, ahora exportada de listado.js ──────────────────────────

test('delMesMasNuevo: del mes más nuevo al más viejo, y lo que no es un mes al final', () => {
  const meses = ['ago 2025', 'Sin mes', 'ene 2026', 'dic 2025']
  assert.deepEqual(meses.sort(delMesMasNuevo), ['ene 2026', 'dic 2025', 'ago 2025', 'Sin mes'])
})

// ─── filaDelResumen ─────────────────────────────────────────────────────────

test('filaDelResumen: conserva los campos de la API y suma el texto del mes', () => {
  const f = filaDelResumen(fila())
  assert.equal(f.cliente_id, 12)
  assert.equal(f.horas_peon, '120.50')
  assert.equal(f.facturado_neto, '1500.00')
  assert.deepEqual(f.estados, ['facturada'])
  assert.equal(f.mes_texto, 'sep 2026')
})

test('filaDelResumen: las etiquetas de los estados, de la más urgente a la menos', () => {
  const f = filaDelResumen(fila({ estados: ['falta_comprobante', 'con_diferencia'] }))
  assert.deepEqual(f.estados_texto, ['Con diferencia', 'Falta comprobante'])
  const enCurso = filaDelResumen(fila({ estados: ['mes_en_curso', 'falta_comprobante'] }))
  assert.deepEqual(enCurso.estados_texto, ['Falta comprobante', 'Mes en curso'])
})

test('filaDelResumen: una clave de estado que no se conoce no lleva etiqueta', () => {
  const f = filaDelResumen(fila({ estados: ['facturada', 'otra_cosa'] }))
  assert.deepEqual(f.estados_texto, ['Facturada'])
})

test('filaDelResumen: "Diferencia revisada" sólo cuando llega diferencia_revisada', () => {
  assert.equal(filaDelResumen(fila({ diferencia_revisada: true })).nota, 'Diferencia revisada')
  assert.equal(filaDelResumen(fila()).nota, null)
})

test('filaDelResumen: no cambia la fila que recibe', () => {
  const original = fila({ estados: ['falta_comprobante', 'con_diferencia'] })
  const copia = structuredClone(original)
  filaDelResumen(original)
  assert.deepEqual(original, copia)
})

// ─── CAMPOS_RESUMEN ─────────────────────────────────────────────────────────

test('CAMPOS_RESUMEN: Mes, Cliente y Estado, en ese orden', () => {
  assert.deepEqual(CAMPOS_RESUMEN.map(c => c.label), ['Mes', 'Cliente', 'Estado'])
  for (const c of CAMPOS_RESUMEN) {
    assert.equal(typeof c.key, 'string')
    assert.equal(typeof c.field, 'string')
  }
})

test('CAMPOS_RESUMEN: las opciones de Mes van por fecha, del más nuevo al más viejo', () => {
  const o = opciones([
    fila({ mes: '2025-12' }),
    fila({ mes: '2026-09' }),
    fila({ mes: '2026-01' }),
  ])
  assert.deepEqual(o.mes, ['sep 2026', 'ene 2026', 'dic 2025'])
})

test('CAMPOS_RESUMEN: las opciones de Cliente, sin repetir', () => {
  const o = opciones([
    fila({ cliente_nombre: 'CLIENTE DOS' }),
    fila({ cliente_nombre: 'CLIENTE UNO', mes: '2026-08' }),
    fila({ cliente_nombre: 'CLIENTE DOS', mes: '2026-08' }),
  ])
  assert.deepEqual(o.cliente, ['CLIENTE DOS', 'CLIENTE UNO'])
})

test('CAMPOS_RESUMEN: las opciones de Estado van por urgencia, como en el mockup', () => {
  const o = opciones([
    fila({ estados: ['facturada'] }),
    fila({ estados: ['antes_del_corte'], mes: '2026-08' }),
    fila({ estados: ['con_diferencia', 'falta_comprobante'], cliente_nombre: 'CLIENTE DOS' }),
    fila({ estados: ['pendiente_de_facturar'], cliente_nombre: 'CLIENTE TRES' }),
  ])
  assert.deepEqual(o.estado,
    ['Pendiente de facturar', 'Con diferencia', 'Falta comprobante', 'Facturada', 'Antes del corte'])
})

// ─── datosParaFiltros ───────────────────────────────────────────────────────

test('datosParaFiltros: repite cada fila una vez por estado, con su etiqueta', () => {
  const datos = datosParaFiltros(filas([
    fila({ estados: ['con_diferencia', 'falta_comprobante'] }),
    fila({ estados: ['facturada'], cliente_nombre: 'CLIENTE DOS' }),
  ]))
  assert.deepEqual(
    datos.map(d => [d.cliente_nombre, d.estado_texto]),
    [
      ['CLIENTE UNO', 'Con diferencia'],
      ['CLIENTE UNO', 'Falta comprobante'],
      ['CLIENTE DOS', 'Facturada'],
    ],
  )
})

test('datosParaFiltros: con un estado elegido, las otras opciones salen de las filas que lo tienen', () => {
  // Con Falta comprobante elegido, el Cliente que sólo tiene Con diferencia
  // no se ofrece; el que tiene los dos estados, sí.
  const o = opciones([
    fila({ estados: ['con_diferencia', 'falta_comprobante'] }),
    fila({ estados: ['con_diferencia'], cliente_nombre: 'CLIENTE DOS' }),
  ], { estado: ['Falta comprobante'] })
  assert.deepEqual(o.cliente, ['CLIENTE UNO'])
})

test('datosParaFiltros: con un Cliente elegido, se ofrecen todos sus estados', () => {
  const o = opciones([
    fila({ estados: ['con_diferencia', 'falta_comprobante'] }),
    fila({ estados: ['facturada'], cliente_nombre: 'CLIENTE DOS' }),
  ], { cliente: ['CLIENTE UNO'] })
  assert.deepEqual(o.estado, ['Con diferencia', 'Falta comprobante'])
})

test('datosParaFiltros: una fila sin estados conocidos igual ofrece su Mes y su Cliente', () => {
  const datos = datosParaFiltros(filas([fila({ estados: [] })]))
  assert.equal(datos.length, 1)
  assert.equal(datos[0].cliente_nombre, 'CLIENTE UNO')
  assert.equal(datos[0].estado_texto, null)
})

// ─── filtrarResumen ─────────────────────────────────────────────────────────

const LISTA = [
  fila({ cliente_nombre: 'CLIENTE UNO', mes: '2026-09', estados: ['con_diferencia', 'falta_comprobante'] }),
  fila({ cliente_nombre: 'CLIENTE DOS', mes: '2026-09', estados: ['pendiente_de_facturar'] }),
  fila({ cliente_nombre: 'CLIENTE UNO', mes: '2026-08', estados: ['facturada'], diferencia_revisada: true }),
  fila({ cliente_nombre: 'CLIENTE TRES', mes: '2026-08', estados: ['falta_comprobante'] }),
]

const clientesYMeses = lista => lista.map(f => `${f.cliente_nombre} ${f.mes}`)

test('filtrarResumen: sin filtros quedan todas, en el orden en que vinieron', () => {
  assert.deepEqual(clientesYMeses(filtrarResumen(filas(LISTA), {})), [
    'CLIENTE UNO 2026-09', 'CLIENTE DOS 2026-09', 'CLIENTE UNO 2026-08', 'CLIENTE TRES 2026-08',
  ])
})

test('filtrarResumen: por Mes y por Cliente', () => {
  assert.deepEqual(clientesYMeses(filtrarResumen(filas(LISTA), { mes: ['ago 2026'] })),
    ['CLIENTE UNO 2026-08', 'CLIENTE TRES 2026-08'])
  assert.deepEqual(clientesYMeses(filtrarResumen(filas(LISTA), { cliente: ['CLIENTE UNO'] })),
    ['CLIENTE UNO 2026-09', 'CLIENTE UNO 2026-08'])
  assert.deepEqual(
    clientesYMeses(filtrarResumen(filas(LISTA), { mes: ['sep 2026'], cliente: ['CLIENTE UNO'] })),
    ['CLIENTE UNO 2026-09'])
})

test('filtrarResumen: una fila pasa si alguno de sus estados está elegido', () => {
  assert.deepEqual(
    clientesYMeses(filtrarResumen(filas(LISTA), { estado: ['Falta comprobante'] })),
    ['CLIENTE UNO 2026-09', 'CLIENTE TRES 2026-08'])
  assert.deepEqual(
    clientesYMeses(filtrarResumen(filas(LISTA), { estado: ['Pendiente de facturar', 'Facturada'] })),
    ['CLIENTE DOS 2026-09', 'CLIENTE UNO 2026-08'])
})

test('filtrarResumen: la Alerta de los cuadros deja las filas que tienen ese estado', () => {
  assert.deepEqual(
    clientesYMeses(filtrarResumen(filas(LISTA), { alerta: 'con_diferencia' })),
    ['CLIENTE UNO 2026-09'])
  assert.deepEqual(
    clientesYMeses(filtrarResumen(filas(LISTA), { alerta: 'falta_comprobante', mes: ['ago 2026'] })),
    ['CLIENTE TRES 2026-08'])
})

test('filtrarResumen: un filtro vacío no filtra', () => {
  assert.equal(filtrarResumen(filas(LISTA), { mes: [], cliente: [], estado: [] }).length, 4)
})

// ─── contarAlertas ──────────────────────────────────────────────────────────

test('contarAlertas: cuenta filas (mes y Cliente) por cada Alerta, por separado', () => {
  assert.deepEqual(contarAlertas(filas(LISTA), {}), {
    pendiente_de_facturar: 1,
    con_diferencia: 1,
    falta_comprobante: 2,
  })
})

test('contarAlertas: sin Alertas, todo en cero', () => {
  assert.deepEqual(contarAlertas(filas([fila()]), {}), {
    pendiente_de_facturar: 0,
    con_diferencia: 0,
    falta_comprobante: 0,
  })
})

test('contarAlertas: aplica el Mes y el Cliente', () => {
  assert.deepEqual(contarAlertas(filas(LISTA), { mes: ['ago 2026'] }), {
    pendiente_de_facturar: 0,
    con_diferencia: 0,
    falta_comprobante: 1,
  })
  assert.deepEqual(contarAlertas(filas(LISTA), { cliente: ['CLIENTE DOS'] }), {
    pendiente_de_facturar: 1,
    con_diferencia: 0,
    falta_comprobante: 0,
  })
})

test('contarAlertas: no aplica el Estado ni la Alerta, así el número del cuadro no cambia al tocarlo', () => {
  const sinFiltro = contarAlertas(filas(LISTA), {})
  assert.deepEqual(contarAlertas(filas(LISTA), { alerta: 'con_diferencia' }), sinFiltro)
  assert.deepEqual(contarAlertas(filas(LISTA), { estado: ['Facturada'] }), sinFiltro)
})

// ─── totales ────────────────────────────────────────────────────────────────

test('totales: suma cada medida y el neto de las filas que recibe, y las cuenta', () => {
  const t = totales(filas([
    fila(),
    fila({ horas_peon: '0.25', horas_tractor: '1.5', tancadas: '3', plantas: '1200',
      hectareas: '0.75', facturado_neto: '250.50' }),
  ]))
  assert.deepEqual(t, {
    cantidad: 2,
    horas_peon: '120.75',
    horas_tractor: '9.50',
    tancadas: '3',
    plantas: '1200',
    hectareas: '5.00',
    facturado_neto: '1750.50',
  })
})

test('totales: el neto viene con signo y una Nota de crédito resta', () => {
  const t = totales(filas([fila({ facturado_neto: '100.00' }), fila({ facturado_neto: '-250.50' })]))
  assert.equal(t.facturado_neto, '-150.50')
})

test('totales: suma exacta, sin el error de los números de punto flotante', () => {
  const t = totales(filas([fila({ horas_peon: '0.1' }), fila({ horas_peon: '0.2' })]))
  assert.equal(t.horas_peon, '0.3')
  // Más de 2^53 centavos: con Number se perdería el último dígito.
  const grande = totales(filas([
    fila({ facturado_neto: '90071992547409.91' }),
    fila({ facturado_neto: '0.01' }),
  ]))
  assert.equal(grande.facturado_neto, '90071992547409.92')
})

test('totales: sin filas, todo en cero', () => {
  assert.deepEqual(totales([]), {
    cantidad: 0,
    horas_peon: '0',
    horas_tractor: '0',
    tancadas: '0',
    plantas: '0',
    hectareas: '0',
    facturado_neto: '0',
  })
})

test('totales: un valor que no es un número no suma', () => {
  const t = totales(filas([fila({ plantas: null }), fila({ plantas: '10' })]))
  assert.equal(t.plantas, '10')
})
