// Tests de los estados del Resumen (node --test, sin dependencias; plan E3,
// FA2). Las claves son las de `estados` de cada fila de GET
// /api/facturacion/resumen (plan E3, sección 3.2, ruta 13); la etiqueta, el
// badge y el orden salen de la tabla del mockup aprobado del Resumen. El
// permiso llega como un booleano, como `editable` de las páginas del módulo.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ESTADOS, estadoMasUrgente, rutaDelDetalle, accionDeFila, destinoDeEtiqueta, textoDeEstado,
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

test('ESTADOS: las siete claves del backend, con la etiqueta, el badge y el orden del mockup', () => {
  // Sin comparar (Ticket 4 de la spec de la E3a por grupo) va entre Falta
  // comprobante y Facturada, como en el backend: no pide hacer nada, avisa.
  assert.deepEqual(ESTADOS, {
    pendiente_de_facturar: { etiqueta: 'Pendiente de facturar', badge: 'badge-danger', orden: 0 },
    con_diferencia: { etiqueta: 'Con diferencia', badge: 'badge-warn', orden: 1 },
    falta_comprobante: { etiqueta: 'Falta comprobante', badge: 'badge-info', orden: 2 },
    sin_comparar: { etiqueta: 'Sin comparar en este período', badge: 'badge-muted', orden: 3 },
    facturada: { etiqueta: 'Facturada', badge: 'badge-green', orden: 4 },
    mes_en_curso: { etiqueta: 'Mes en curso', badge: 'badge-muted', orden: 5 },
    antes_del_corte: { etiqueta: 'Antes del corte', badge: 'badge-muted', orden: 6 },
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

test('rutaDelDetalle: con el filtro de la fila, lo lleva como desde y hasta', () => {
  // El Detalle se abre con el mismo período que muestra la fila (decisión 5).
  assert.equal(rutaDelDetalle(fila(['facturada'], { desde: '2026-09-01', hasta: '2026-09-10' })),
    `${DETALLE}?desde=2026-09-01&hasta=2026-09-10`)
  // Sólo con los dos: con uno solo, el mes entero.
  assert.equal(rutaDelDetalle(fila(['facturada'], { desde: '2026-09-01' })), DETALLE)
})

test('Sin comparar: el botón y la etiqueta van como en Facturada', () => {
  const f = fila(['sin_comparar'])
  assert.deepEqual(accionDeFila(f, true), { texto: 'Ver detalle', destino: DETALLE, primaria: false })
  assert.equal(destinoDeEtiqueta('sin_comparar', f, true), null)
  assert.equal(textoDeEstado('sin_comparar', f), 'Sin comparar en este período')
  // Más urgente que Facturada y menos que Falta comprobante.
  assert.equal(estadoMasUrgente(['facturada', 'sin_comparar']), 'sin_comparar')
  assert.equal(estadoMasUrgente(['sin_comparar', 'falta_comprobante']), 'falta_comprobante')
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

// ─── textoDeEstado (decisión 2 de la spec de la E3a por grupo) ──────────────

test('textoDeEstado: Con diferencia dice cuántas líneas superan', () => {
  assert.equal(textoDeEstado('con_diferencia', fila(['con_diferencia'], { lineas_superan: 1 })),
    'Con diferencia · 1 línea supera')
  // Cuenta líneas (grupo, unidad): un grupo con dos unidades que superan, 2.
  assert.equal(textoDeEstado('con_diferencia', fila(['con_diferencia'], { lineas_superan: 3 })),
    'Con diferencia · 3 líneas superan')
})

test('textoDeEstado: sin líneas que superen, Con diferencia va sola', () => {
  assert.equal(textoDeEstado('con_diferencia', fila(['con_diferencia'], { lineas_superan: 0 })),
    'Con diferencia')
  assert.equal(textoDeEstado('con_diferencia', fila(['con_diferencia'])), 'Con diferencia')
})

test('textoDeEstado: los demás estados, su etiqueta; una clave que no conoce, null', () => {
  const conLineas = fila(['facturada', 'falta_comprobante'], { lineas_superan: 2 })
  assert.equal(textoDeEstado('facturada', conLineas), 'Facturada')
  assert.equal(textoDeEstado('falta_comprobante', conLineas), 'Falta comprobante')
  assert.equal(textoDeEstado('otra_cosa', conLineas), null)
  assert.equal(textoDeEstado('constructor', conLineas), null)
})
