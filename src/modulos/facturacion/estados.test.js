// Tests de los estados del Resumen (node --test, sin dependencias; plan E3,
// FA2). Las claves son las de `estados` de cada fila de GET
// /api/facturacion/resumen (plan E3, sección 3.2, ruta 13); la etiqueta, el
// badge y el orden salen de la tabla del mockup aprobado del Resumen. El
// permiso llega como un booleano, como `editable` de las páginas del módulo.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTADOS, estadoMasUrgente, rutaDelDetalle, accionDeFila, destinoDeEtiqueta,
} from './estados.js'

// Una fila como la manda el backend, con lo que usan estas funciones.
const fila = (estados, extra = {}) => ({
  cliente_id: 12,
  cliente_nombre: 'Cliente de prueba',
  mes: '2026-09',
  estados,
  diferencia_revisada: false,
  comprobantes_sin_adjunto: [],
  ...extra,
})

const DETALLE = '/facturacion/resumen/12/2026-09'
const CARGAR = '/facturacion/comprobantes/nuevo?tipo=factura&cliente=12&mes=2026-09'
const SIN_ADJUNTO = [{ id: 40, tipo: 'factura', numero: '0001-00000040' }, { id: 41, tipo: 'factura', numero: '0001-00000041' }]

// ─── Mapa clave → etiqueta, badge y orden ───────────────────────────────────

test('ESTADOS: las seis claves del backend, con la etiqueta, el badge y el orden del mockup', () => {
  assert.deepEqual(ESTADOS, {
    pendiente_de_facturar: { etiqueta: 'Pendiente de facturar', badge: 'badge-danger', orden: 0 },
    con_diferencia: { etiqueta: 'Con diferencia', badge: 'badge-warn', orden: 1 },
    falta_comprobante: { etiqueta: 'Falta comprobante', badge: 'badge-info', orden: 2 },
    facturada: { etiqueta: 'Facturada', badge: 'badge-green', orden: 3 },
    mes_en_curso: { etiqueta: 'Mes en curso', badge: 'badge-muted', orden: 4 },
    antes_del_corte: { etiqueta: 'Antes del corte', badge: 'badge-muted', orden: 5 },
  })
})

// ─── Estado más urgente ─────────────────────────────────────────────────────

test('estadoMasUrgente: con un solo estado, ese', () => {
  assert.equal(estadoMasUrgente(['facturada']), 'facturada')
  assert.equal(estadoMasUrgente(['antes_del_corte']), 'antes_del_corte')
})

test('estadoMasUrgente: con varios, el de menor orden, sin importar cómo vengan', () => {
  assert.equal(estadoMasUrgente(['con_diferencia', 'falta_comprobante']), 'con_diferencia')
  assert.equal(estadoMasUrgente(['falta_comprobante', 'con_diferencia']), 'con_diferencia')
  // En el mes en curso, Falta comprobante es lo que hay que hacer (mockup).
  assert.equal(estadoMasUrgente(['mes_en_curso', 'falta_comprobante']), 'falta_comprobante')
})

test('estadoMasUrgente: una clave que no conoce no cuenta; sin ninguna conocida, null', () => {
  assert.equal(estadoMasUrgente(['otra_cosa', 'facturada']), 'facturada')
  assert.equal(estadoMasUrgente(['otra_cosa']), null)
  assert.equal(estadoMasUrgente(['constructor', 'toString']), null)
  assert.equal(estadoMasUrgente([]), null)
  assert.equal(estadoMasUrgente(undefined), null)
})

// ─── Ruta del Detalle ───────────────────────────────────────────────────────

test('rutaDelDetalle: /facturacion/resumen/{cliente_id}/{mes}', () => {
  assert.equal(rutaDelDetalle(fila(['facturada'])), DETALLE)
})

// ─── Acción de cada fila ────────────────────────────────────────────────────

test('accionDeFila: Pendiente de facturar con Editar en comprobantes, "Cargar factura" al alta con tipo, cliente y mes', () => {
  assert.deepEqual(accionDeFila(fila(['pendiente_de_facturar']), true),
    { texto: 'Cargar factura', destino: CARGAR, primaria: true })
})

test('accionDeFila: Pendiente de facturar sin Editar en comprobantes, "Ver detalle"', () => {
  assert.deepEqual(accionDeFila(fila(['pendiente_de_facturar']), false),
    { texto: 'Ver detalle', destino: DETALLE, primaria: false })
})

test('accionDeFila: Con diferencia, "Ver diferencia" al Detalle, con o sin Editar en comprobantes', () => {
  const esperado = { texto: 'Ver diferencia', destino: DETALLE, primaria: true }
  assert.deepEqual(accionDeFila(fila(['con_diferencia']), true), esperado)
  assert.deepEqual(accionDeFila(fila(['con_diferencia']), false), esperado)
  // Con diferencia es más urgente que Falta comprobante.
  assert.deepEqual(accionDeFila(fila(['con_diferencia', 'falta_comprobante'],
    { comprobantes_sin_adjunto: SIN_ADJUNTO }), true), esperado)
})

test('accionDeFila: Falta comprobante con Editar, "Adjuntar PDF" al primer Comprobante sin Adjunto', () => {
  assert.deepEqual(accionDeFila(fila(['falta_comprobante'], { comprobantes_sin_adjunto: SIN_ADJUNTO }), true),
    { texto: 'Adjuntar PDF', destino: '/facturacion/comprobantes/40', primaria: true })
  // También en el mes en curso, donde es lo más urgente.
  assert.deepEqual(accionDeFila(fila(['mes_en_curso', 'falta_comprobante'],
    { mes: '2026-10', comprobantes_sin_adjunto: SIN_ADJUNTO }), true),
    { texto: 'Adjuntar PDF', destino: '/facturacion/comprobantes/40', primaria: true })
})

test('accionDeFila: Falta comprobante sin Editar en comprobantes, "Ver detalle"', () => {
  assert.deepEqual(accionDeFila(fila(['falta_comprobante'], { comprobantes_sin_adjunto: SIN_ADJUNTO }), false),
    { texto: 'Ver detalle', destino: DETALLE, primaria: false })
})

test('accionDeFila: Falta comprobante sin ningún Comprobante en la lista, "Ver detalle"', () => {
  assert.deepEqual(accionDeFila(fila(['falta_comprobante']), true),
    { texto: 'Ver detalle', destino: DETALLE, primaria: false })
})

test('accionDeFila: Facturada, Mes en curso y Antes del corte, "Ver detalle"', () => {
  for (const estado of ['facturada', 'mes_en_curso', 'antes_del_corte']) {
    for (const permiso of [true, false]) {
      assert.deepEqual(accionDeFila(fila([estado]), permiso),
        { texto: 'Ver detalle', destino: DETALLE, primaria: false }, `${estado}, permiso ${permiso}`)
    }
  }
  // Facturada con la diferencia revisada también.
  assert.deepEqual(accionDeFila(fila(['facturada'], { diferencia_revisada: true }), true),
    { texto: 'Ver detalle', destino: DETALLE, primaria: false })
})

test('accionDeFila: sin estados conocidos, "Ver detalle"', () => {
  assert.deepEqual(accionDeFila(fila([]), true), { texto: 'Ver detalle', destino: DETALLE, primaria: false })
})

// ─── Qué etiqueta es link ───────────────────────────────────────────────────

test('destinoDeEtiqueta: Pendiente de facturar es link al alta sólo con Editar en comprobantes', () => {
  const f = fila(['pendiente_de_facturar'])
  assert.equal(destinoDeEtiqueta('pendiente_de_facturar', f, true), CARGAR)
  assert.equal(destinoDeEtiqueta('pendiente_de_facturar', f, false), null)
})

test('destinoDeEtiqueta: Falta comprobante es link al primer Comprobante sin Adjunto sólo con Editar', () => {
  const f = fila(['con_diferencia', 'falta_comprobante'], { comprobantes_sin_adjunto: SIN_ADJUNTO })
  assert.equal(destinoDeEtiqueta('falta_comprobante', f, true), '/facturacion/comprobantes/40')
  assert.equal(destinoDeEtiqueta('falta_comprobante', f, false), null)
  // Sin Comprobante en la lista, no hay a dónde ir.
  assert.equal(destinoDeEtiqueta('falta_comprobante', fila(['falta_comprobante']), true), null)
})

test('destinoDeEtiqueta: Con diferencia es link al Detalle, con o sin Editar en comprobantes', () => {
  const f = fila(['con_diferencia'])
  assert.equal(destinoDeEtiqueta('con_diferencia', f, true), DETALLE)
  assert.equal(destinoDeEtiqueta('con_diferencia', f, false), DETALLE)
})

test('destinoDeEtiqueta: Facturada, Mes en curso y Antes del corte van como texto', () => {
  for (const estado of ['facturada', 'mes_en_curso', 'antes_del_corte']) {
    assert.equal(destinoDeEtiqueta(estado, fila([estado]), true), null, estado)
  }
  assert.equal(destinoDeEtiqueta('otra_cosa', fila(['otra_cosa']), true), null)
  assert.equal(destinoDeEtiqueta('constructor', fila(['constructor']), true), null)
})
