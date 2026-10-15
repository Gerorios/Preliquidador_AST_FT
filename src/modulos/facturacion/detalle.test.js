// Tests de la lógica del Detalle (node --test, sin dependencias; plan E3,
// FA4). El detalle de entrada tiene la forma de GET
// /api/facturacion/resumen/{cliente_id}/{mes} (plan E3, sección 3.2, ruta 14).
// Los textos de los avisos salen del mockup aprobado del Detalle y del boceto
// F0 de la E3a. El permiso llega como un booleano, como en estados.js.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LARGO_COMENTARIO, textoPct, bannerDeDetalle, puedeRevisar, validarComentario, totalPartes,
  claveDeFila, filasQueSuperan, revisadaEnFila, unidadesPorTarea, textoDiferencia,
  textoDiferenciaPesos, textoComprobante, textoMesLargo, signoDeDiferencia,
} from './detalle.js'

// Una fila de la tabla del Detalle, con lo que usan estas funciones.
const tarea = (tarea_id, tarea_nombre, unidad, extra = {}) => ({
  tarea_id,
  tarea_nombre,
  unidad,
  sin_unidad_sugerida: false,
  en_varias_unidades: false,
  campo: '100.00',
  facturado: '100.00',
  diferencia: '0.00',
  diferencia_pct: '0.00',
  supera: false,
  precio: '10.00',
  partes: [],
  ...extra,
})

// El detalle de un mes controlado, sin nada que supere.
const detalle = (cambios = {}) => ({
  cliente_id: 12,
  cliente_nombre: 'Cliente de prueba',
  mes: '2026-10',
  umbral_pct: '5.00',
  mes_corte: '2026-10',
  leido_en: '2026-11-12T13:00:00',
  estados: ['facturada'],
  diferencia_revisada: false,
  se_puede_revisar: false,
  comprobantes: [],
  grupos: [{ grupo: 'Grupo uno', tareas: [tarea(1, 'Tarea uno', 'horas_peon')] }],
  total: {},
  revision: null,
  ...cambios,
})

// Una Revisión vigente. 15:00 UTC es el mismo día en cualquier huso de
// América, así la fecha del test no depende de la PC.
const revision = (tareas, extra = {}) => ({
  id: 7,
  comentario: 'el campo cargó dos veces un parte',
  creada_en: '2026-11-10T15:00:00',
  creada_por_nombre: 'Persona de prueba',
  tareas,
  ...extra,
})

const SUPERA = { supera: true, facturado: '90.00', diferencia: '-10.00', diferencia_pct: '-10.00' }

// ─── textoPct ───────────────────────────────────────────────────────────────

test('textoPct: una raya cuando el % viene null (el campo es 0)', () => {
  assert.equal(textoPct(null), '—')
  assert.equal(textoPct(undefined), '—')
})

test('textoPct: en es-AR, con signo y el %', () => {
  assert.equal(textoPct('-8.50'), '-8,5 %')
  assert.equal(textoPct('12.25'), '+12,25 %')
  assert.equal(textoPct('10.00'), '+10,0 %')
})

test('textoPct: muestra los dos decimales del backend, así un 5,04 % que supera el 5 % no se ve como 5,0 %', () => {
  assert.equal(textoPct('5.04'), '+5,04 %')
})

test('textoPct: el cero va sin signo, y lo que no es un número da una raya', () => {
  assert.equal(textoPct('0.00'), '0,0 %')
  assert.equal(textoPct('-0.00'), '0,0 %')
  assert.equal(textoPct('x'), '—')
})

// ─── bannerDeDetalle: revisada ──────────────────────────────────────────────

const revisada = (extra = {}) => detalle({
  estados: ['facturada'],
  diferencia_revisada: true,
  grupos: [{ grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'horas_peon', SUPERA)] }],
  revision: revision([{ tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' }], extra),
})

test('bannerDeDetalle: revisada, con quién, cuándo y el comentario, y Deshacer con permiso', () => {
  assert.deepEqual(bannerDeDetalle(revisada(), true), {
    tipo: 'ok',
    titulo: 'Revisada',
    texto: 'por Persona de prueba el 10/11/2026: “el campo cargó dos veces un parte”',
    deshacer: true,
  })
})

test('bannerDeDetalle: revisada, sin Deshacer cuando no se puede Editar en Resumen', () => {
  assert.equal(bannerDeDetalle(revisada(), false).deshacer, false)
})

test('bannerDeDetalle: revisada por alguien que ya no está, sin el nombre', () => {
  const banner = bannerDeDetalle(revisada({ creada_por_nombre: null }), true)
  assert.equal(banner.texto, 'el 10/11/2026: “el campo cargó dos veces un parte”')
})

// ─── bannerDeDetalle: con diferencia y una Revisión anterior que no cubre ───

test('bannerDeDetalle: con diferencia y una Revisión que no cubre lo que supera ahora', () => {
  const d = detalle({
    estados: ['con_diferencia'],
    se_puede_revisar: true,
    grupos: [
      { grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'horas_peon', SUPERA)] },
      { grupo: 'Grupo dos', tareas: [tarea(2, 'Pulverización', 'tancadas', SUPERA), tarea(3, 'Riego', 'horas_peon')] },
    ],
    revision: revision([{ tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' }]),
  })
  assert.deepEqual(bannerDeDetalle(d, true), {
    tipo: 'warn',
    titulo: '2 tareas superan el 5 %.',
    texto: 'Hubo una Revisión el 10/11/2026 (Persona de prueba: “el campo cargó dos veces un parte”) '
      + 'que cubría Poda. Ahora supera también Pulverización: hace falta revisarlo de nuevo o corregirlo.',
    deshacer: false,
  })
})

test('bannerDeDetalle: si lo que cubría la Revisión ya no supera, no dice "también"', () => {
  const d = detalle({
    estados: ['con_diferencia'],
    grupos: [{ grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'horas_peon'), tarea(2, 'Riego', 'horas_peon', SUPERA)] }],
    revision: revision([{ tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' }]),
  })
  const banner = bannerDeDetalle(d, true)
  assert.equal(banner.titulo, '1 tarea supera el 5 %.')
  assert.match(banner.texto, /que cubría Poda\. Ahora supera Riego: hace falta/)
})

test('bannerDeDetalle: una tarea en dos unidades se nombra con su unidad, y la cubierta es la de su unidad', () => {
  const VARIAS = { en_varias_unidades: true }
  const d = detalle({
    estados: ['con_diferencia'],
    grupos: [{ grupo: 'Grupo uno', tareas: [
      tarea(1, 'Poda', 'horas_peon', { ...SUPERA, ...VARIAS }),
      tarea(1, 'Poda', 'hectareas', { ...SUPERA, ...VARIAS }),
    ] }],
    revision: revision([{ tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' }]),
  })
  const banner = bannerDeDetalle(d, true)
  assert.match(banner.texto, /que cubría Poda \(Horas de peón\)\. Ahora supera también Poda \(Hectáreas\):/)
})

test('bannerDeDetalle: varias tareas se nombran con comas y "y"', () => {
  const d = detalle({
    estados: ['con_diferencia'],
    grupos: [{ grupo: 'Grupo uno', tareas: [
      tarea(1, 'Poda', 'horas_peon', SUPERA),
      tarea(2, 'Riego', 'horas_peon', SUPERA),
      tarea(3, 'Raleo', 'plantas', SUPERA),
      tarea(4, 'Desbrote', 'horas_peon', SUPERA),
    ] }],
    revision: revision([
      { tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' },
      { tarea_id: 2, tarea_nombre: 'Riego', unidad: 'horas_peon' },
    ]),
  })
  const banner = bannerDeDetalle(d, true)
  assert.equal(banner.titulo, '4 tareas superan el 5 %.')
  assert.match(banner.texto, /que cubría Poda y Riego\. Ahora supera también Raleo y Desbrote:/)
})

// ─── bannerDeDetalle: con diferencia sin Revisión ───────────────────────────

test('bannerDeDetalle: con diferencia y sin Revisión, el texto del mockup con el Umbral', () => {
  const d = detalle({
    estados: ['con_diferencia', 'falta_comprobante'],
    umbral_pct: '2.50',
    grupos: [{ grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'horas_peon', SUPERA), tarea(2, 'Riego', 'horas_peon')] }],
  })
  assert.deepEqual(bannerDeDetalle(d, true), {
    tipo: 'warn',
    titulo: '1 tarea supera el 2,5 %.',
    texto: 'Tocá una tarea para ver sus partes y consultarlo con el campo. Se cierra sola si se '
      + 'corrige el parte o se carga una nota de crédito o una factura corregida.',
    deshacer: false,
  })
})

// ─── bannerDeDetalle: sin control ───────────────────────────────────────────

test('bannerDeDetalle: Antes del corte, info con el Mes de corte', () => {
  const d = detalle({ mes: '2026-09', estados: ['antes_del_corte'] })
  assert.deepEqual(bannerDeDetalle(d, true), {
    tipo: 'info',
    titulo: 'Este mes no se controla:',
    texto: 'es anterior al Mes de corte (oct 2026). Los números se ven igual, sin "Supera" ni Revisión.',
    deshacer: false,
  })
})

test('bannerDeDetalle: Antes del corte sin el Mes de corte en la respuesta, sin el paréntesis', () => {
  const d = detalle({ mes: '2026-09', estados: ['antes_del_corte'], mes_corte: undefined })
  assert.equal(bannerDeDetalle(d, true).texto,
    'es anterior al Mes de corte. Los números se ven igual, sin "Supera" ni Revisión.')
})

test('bannerDeDetalle: Mes en curso, info, también con Falta comprobante', () => {
  const esperado = {
    tipo: 'info',
    titulo: 'Mes en curso:',
    texto: 'todavía no se compara lo trabajado con lo facturado. Sólo se controla que cada factura tenga su PDF.',
    deshacer: false,
  }
  assert.deepEqual(bannerDeDetalle(detalle({ estados: ['mes_en_curso'] }), true), esperado)
  assert.deepEqual(bannerDeDetalle(detalle({ estados: ['mes_en_curso', 'falta_comprobante'] }), true), esperado)
})

// ─── bannerDeDetalle: sin aviso ─────────────────────────────────────────────

test('bannerDeDetalle: sin aviso en Facturada, en Pendiente de facturar y sin detalle', () => {
  assert.equal(bannerDeDetalle(detalle(), true), null)
  assert.equal(bannerDeDetalle(detalle({ estados: ['pendiente_de_facturar'] }), true), null)
  assert.equal(bannerDeDetalle(null, true), null)
})

test('bannerDeDetalle: Facturada con una Revisión vigente que ya no hace falta (nada supera) no avisa', () => {
  const d = detalle({
    diferencia_revisada: false,
    revision: revision([{ tarea_id: 1, tarea_nombre: 'Tarea uno', unidad: 'horas_peon' }]),
  })
  assert.equal(bannerDeDetalle(d, true), null)
})

// ─── puedeRevisar ───────────────────────────────────────────────────────────

test('puedeRevisar: sólo si el backend dice que se puede y se puede Editar en Resumen', () => {
  assert.equal(puedeRevisar(detalle({ se_puede_revisar: true }), true), true)
  assert.equal(puedeRevisar(detalle({ se_puede_revisar: true }), false), false)
  assert.equal(puedeRevisar(detalle({ se_puede_revisar: false }), true), false)
  assert.equal(puedeRevisar(null, true), false)
})

// ─── validarComentario ──────────────────────────────────────────────────────

test('LARGO_COMENTARIO: el del backend', () => {
  assert.equal(LARGO_COMENTARIO, 500)
})

test('validarComentario: obligatorio; vacío o sólo espacios no sirve', () => {
  for (const texto of ['', '   \n ', null, undefined]) {
    assert.equal(validarComentario(texto), 'Escribí por qué queda así.')
  }
})

test('validarComentario: hasta 500 caracteres, sin contar los espacios de los bordes', () => {
  assert.equal(validarComentario('Ya avisé al supervisor.'), null)
  assert.equal(validarComentario('a'.repeat(500)), null)
  assert.equal(validarComentario(`  ${'a'.repeat(500)}\n`), null)
  assert.equal(validarComentario('a'.repeat(501)), 'El comentario puede tener hasta 500 caracteres.')
})

test('validarComentario: cuenta caracteres como el backend, no unidades de UTF-16', () => {
  // Cada "😀" es un carácter para Python y MySQL, pero dos para `length`.
  assert.equal(validarComentario('😀'.repeat(500)), null)
  assert.notEqual(validarComentario('😀'.repeat(501)), null)
})

// ─── totalPartes ────────────────────────────────────────────────────────────

test('totalPartes: suma la cantidad de los partes, como texto decimal', () => {
  const partes = [
    { fecha: '2026-10-02', donde: 'Finca uno', supervisor: 'Supervisor uno', cantidad: '4.5' },
    { fecha: '2026-10-09', donde: 'Finca dos', supervisor: 'Supervisor dos', cantidad: '3.25' },
    { fecha: '2026-10-16', donde: 'Finca uno', supervisor: 'Supervisor uno', cantidad: '12' },
  ]
  assert.equal(totalPartes(partes), '19.75')
})

test('totalPartes: suma exacta, sin el error de los números de punto flotante', () => {
  assert.equal(totalPartes([{ cantidad: '0.1' }, { cantidad: '0.2' }]), '0.3')
})

test('totalPartes: sin partes, o con una cantidad que no es un número, no suma', () => {
  assert.equal(totalPartes([]), '0')
  assert.equal(totalPartes(undefined), '0')
  assert.equal(totalPartes([{ cantidad: '2.00' }, { cantidad: null }]), '2.00')
})

// ─── Lo que usa la pantalla del Detalle (FA6) ───────────────────────────────

test('claveDeFila: una fila es (tarea, unidad); sin unidad, la tarea sola', () => {
  assert.equal(claveDeFila(tarea(4, 'Poda', 'horas_peon')), '4|horas_peon')
  assert.equal(claveDeFila(tarea(4, 'Poda', 'plantas')), '4|plantas')
  assert.equal(claveDeFila(tarea(9, 'Desmalezado', null)), '9|')
})

test('filasQueSuperan: las filas que superan, de todos los grupos y en orden', () => {
  const d = detalle({
    grupos: [
      { grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'horas_peon', SUPERA), tarea(2, 'Riego', 'horas_peon')] },
      { grupo: 'Grupo dos', tareas: [tarea(3, 'Rastra', 'horas_tractor', SUPERA)] },
    ],
  })
  assert.deepEqual(filasQueSuperan(d).map(t => t.tarea_nombre), ['Poda', 'Rastra'])
  assert.deepEqual(filasQueSuperan(detalle()), [])
  assert.deepEqual(filasQueSuperan(null), [])
})

test('revisadaEnFila: sólo una fila que supera y que la Revisión cubre, por (tarea, unidad)', () => {
  const r = revision([{ tarea_id: 1, tarea_nombre: 'Poda', unidad: 'horas_peon' }])
  assert.equal(revisadaEnFila(tarea(1, 'Poda', 'horas_peon', SUPERA), r), true)
  // La misma tarea en otra unidad no está cubierta.
  assert.equal(revisadaEnFila(tarea(1, 'Poda', 'plantas', SUPERA), r), false)
  // Cubierta, pero ya no supera: no lleva la etiqueta.
  assert.equal(revisadaEnFila(tarea(1, 'Poda', 'horas_peon'), r), false)
  assert.equal(revisadaEnFila(tarea(2, 'Riego', 'horas_peon', SUPERA), r), false)
  assert.equal(revisadaEnFila(tarea(1, 'Poda', 'horas_peon', SUPERA), null), false)
})

test('unidadesPorTarea: en cuántas filas (unidades) está cada tarea', () => {
  const d = detalle({
    grupos: [
      { grupo: 'Grupo uno', tareas: [tarea(1, 'Poda', 'plantas'), tarea(2, 'Riego', 'horas_peon')] },
      { grupo: 'Grupo dos', tareas: [tarea(1, 'Poda', 'hectareas')] },
    ],
  })
  const cuantas = unidadesPorTarea(d)
  assert.equal(cuantas.get(1), 2)
  assert.equal(cuantas.get(2), 1)
  assert.equal(unidadesPorTarea(null).size, 0)
})

test('textoDiferencia: con signo y en es-AR; cero sin signo; null o basura, una raya', () => {
  assert.equal(textoDiferencia('-52.00'), '-52')
  assert.equal(textoDiferencia('42.5'), '+42,5')
  assert.equal(textoDiferencia('1234.25'), '+1.234,25')
  assert.equal(textoDiferencia('0.00'), '0')
  assert.equal(textoDiferencia('-0.00'), '0')
  assert.equal(textoDiferencia(null), '—')
  assert.equal(textoDiferencia('abc'), '—')
})

test('textoDiferenciaPesos: pesos con signo; cero sin signo; null, una raya', () => {
  // Intl separa el signo $ del número con un espacio duro, como formatoPesos.
  const NBSP = ' '
  assert.equal(textoDiferenciaPesos('-1234.5'), `-$${NBSP}1.234,50`)
  assert.equal(textoDiferenciaPesos('300'), `+$${NBSP}300,00`)
  assert.equal(textoDiferenciaPesos('0.00'), `$${NBSP}0,00`)
  assert.equal(textoDiferenciaPesos('-0.00'), `$${NBSP}0,00`)
  assert.equal(textoDiferenciaPesos(null), '—')
})

test('textoComprobante: el tipo y el número; sin número lo dice', () => {
  assert.equal(textoComprobante({ tipo: 'factura', numero: '0003-00001231' }), 'Factura 0003-00001231')
  assert.equal(textoComprobante({ tipo: 'nota_credito', numero: '0003-00000012' }), 'Nota de crédito 0003-00000012')
  assert.equal(textoComprobante({ tipo: 'factura', numero: null }), 'Factura sin número')
})

test('textoMesLargo: "2026-10" a "octubre 2026"; lo que no es un mes queda como vino', () => {
  assert.equal(textoMesLargo('2026-10'), 'octubre 2026')
  assert.equal(textoMesLargo('2027-01'), 'enero 2027')
  assert.equal(textoMesLargo('2026-13'), '2026-13')
  assert.equal(textoMesLargo('otra cosa'), 'otra cosa')
})

test('signoDeDiferencia: de menos o de más, para el tono; cero, null o basura, sin tono', () => {
  assert.equal(signoDeDiferencia('-52.00'), 'menos')
  assert.equal(signoDeDiferencia('0.5'), 'mas')
  assert.equal(signoDeDiferencia('0.00'), null)
  assert.equal(signoDeDiferencia('-0.00'), null)
  assert.equal(signoDeDiferencia(null), null)
  assert.equal(signoDeDiferencia('abc'), null)
})
