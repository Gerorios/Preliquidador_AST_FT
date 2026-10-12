// Tests de las Unidades de facturación del front y de los helpers de la
// pantalla Unidad de medida por defecto (node --test, sin dependencias).
// Las nueve claves son el espejo de app/modulos/facturacion/unidades.py
// (plan E1, D5). Las tareas son inventadas y tienen la forma del contrato
// de GET /api/facturacion/tareas (plan E1, 2.5).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  UNIDADES, UNIDADES_COSECHA, ETIQUETAS,
  VALOR_SIN_DEFINIR, VALOR_NO_FACTURABLE,
  valorDeTarea, cuerpoDesdeValor, etiquetaDe, filtrarTareas, contarSinDefinir,
  vecinoAlSalir, recorreConTecla,
} from './unidades.js'

// Arma una tarea del contrato con tarea_id correlativo a partir de campos parciales.
const tareasDe = (parciales) => parciales.map((p, i) => ({
  tarea_id: i + 1,
  nombre: `Tarea ${i + 1}`,
  grupo_tarea: null,
  unidad_sugerida: null,
  no_facturable: false,
  sin_definir: !p.unidad_sugerida && !p.no_facturable,
  ...p,
}))
const ids = (tareas) => tareas.map(t => t.tarea_id)

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

test('los valores de Sin definir y No facturable no chocan con ninguna unidad', () => {
  assert.notEqual(VALOR_SIN_DEFINIR, VALOR_NO_FACTURABLE)
  assert.ok(!UNIDADES.includes(VALOR_SIN_DEFINIR))
  assert.ok(!UNIDADES.includes(VALOR_NO_FACTURABLE))
})

test('valorDeTarea y cuerpoDesdeValor van y vuelven en los cuatro casos', () => {
  const casos = [
    { cuerpo: { unidad_sugerida: null, no_facturable: false }, valor: VALOR_SIN_DEFINIR },
    { cuerpo: { unidad_sugerida: 'hectareas', no_facturable: false }, valor: 'hectareas' },
    { cuerpo: { unidad_sugerida: 'bins_c', no_facturable: false }, valor: 'bins_c' },
    { cuerpo: { unidad_sugerida: null, no_facturable: true }, valor: VALOR_NO_FACTURABLE },
  ]
  for (const { cuerpo, valor } of casos) {
    const [tarea] = tareasDe([cuerpo])
    assert.equal(valorDeTarea(tarea), valor)
    assert.deepEqual(cuerpoDesdeValor(valor), cuerpo)
    assert.deepEqual(cuerpoDesdeValor(valorDeTarea(tarea)), cuerpo)
  }
})

test('etiquetaDe da el texto de la tarea en los cuatro casos', () => {
  const [sinDefinir, agricola, cosecha, noFacturable] = tareasDe([
    {},
    { unidad_sugerida: 'horas_peon' },
    { unidad_sugerida: 'bins_m' },
    { no_facturable: true },
  ])
  assert.equal(etiquetaDe(sinDefinir), 'Sin definir')
  assert.equal(etiquetaDe(agricola), 'Horas de peón')
  assert.equal(etiquetaDe(cosecha), 'Bins M')
  assert.equal(etiquetaDe(noFacturable), 'No facturable')
})

test('filtrarTareas sin texto ni chip devuelve todas, en el mismo orden', () => {
  const tareas = tareasDe([{}, { no_facturable: true }, { unidad_sugerida: 'plantas' }])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: '', soloSinDefinir: false })), [1, 2, 3])
  assert.deepEqual(ids(filtrarTareas(tareas, {})), [1, 2, 3])
})

test('filtrarTareas busca por nombre o grupo de tareas, sin distinguir mayúsculas', () => {
  const tareas = tareasDe([
    { nombre: 'PODA DE PRUEBA', grupo_tarea: 'GRUPO UNO' },
    { nombre: 'RIEGO EJEMPLO', grupo_tarea: 'PODA' },
    { nombre: 'COSECHA FICTICIA', grupo_tarea: null },
    { nombre: 'OTRA TAREA', grupo_tarea: 'GRUPO DOS' },
  ])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: 'poda' })), [1, 2])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: 'Grupo' })), [1, 4])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: 'ficticia' })), [3])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: 'nada que ver' })), [])
})

test('filtrarTareas con el chip deja sólo las sin definir, y se combina con el texto', () => {
  const tareas = tareasDe([
    { nombre: 'PODA UNO' },
    { nombre: 'PODA DOS', unidad_sugerida: 'horas_peon' },
    { nombre: 'RIEGO UNO' },
    { nombre: 'PODA TRES', no_facturable: true },
  ])
  assert.deepEqual(ids(filtrarTareas(tareas, { soloSinDefinir: true })), [1, 3])
  assert.deepEqual(ids(filtrarTareas(tareas, { texto: 'poda', soloSinDefinir: true })), [1])
})

test('contarSinDefinir cuenta las tareas sin Unidad sugerida y sin la marca', () => {
  assert.equal(contarSinDefinir([]), 0)
  const tareas = tareasDe([{}, { unidad_sugerida: 'viajes' }, {}, { no_facturable: true }, {}])
  assert.equal(contarSinDefinir(tareas), 3)
})

// Con "Sólo sin definir", la tarea recién definida sale de la vista y el foco
// pasa a la que queda en su lugar (plan E1, 3.7, paso R2).
test('vecinoAlSalir: si la tarea sale de la vista, el foco va a la siguiente', () => {
  const antes = tareasDe([{}, {}, {}])
  const despues = antes.filter(t => t.tarea_id !== 2)
  assert.deepEqual(vecinoAlSalir(antes, despues, 2), { sale: true, vecino: 3 })
  assert.deepEqual(vecinoAlSalir(antes, despues.filter(t => t.tarea_id !== 1), 1), { sale: true, vecino: 3 })
})

test('vecinoAlSalir: si era la última, va a la anterior; si no queda ninguna, a nadie', () => {
  const antes = tareasDe([{}, {}, {}])
  assert.deepEqual(vecinoAlSalir(antes, antes.slice(0, 2), 3), { sale: true, vecino: 2 })
  const sola = tareasDe([{}])
  assert.deepEqual(vecinoAlSalir(sola, [], 1), { sale: true, vecino: null })
})

test('vecinoAlSalir: si la tarea sigue en la vista, o no estaba, no sale', () => {
  const antes = tareasDe([{}, {}, {}])
  assert.deepEqual(vecinoAlSalir(antes, antes, 2), { sale: false, vecino: null })
  assert.deepEqual(vecinoAlSalir(antes.slice(0, 2), antes.slice(0, 2), 3), { sale: false, vecino: null })
})

// Las teclas con las que el select cerrado cambia de opción: ese cambio queda
// pendiente y se guarda al salir del select o con Enter (plan E1, 3.7, paso R2).
test('recorreConTecla: flechas, Inicio/Fin, páginas y letras recorren las opciones', () => {
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'h', 'N', 'á']) {
    assert.equal(recorreConTecla({ key }), true, key)
  }
})

test('recorreConTecla: las teclas que abren la lista, Enter, Tab y los atajos no', () => {
  for (const tecla of [
    { key: ' ' }, { key: 'Enter' }, { key: 'Tab' }, { key: 'Escape' }, { key: 'F4' },
    { key: 'ArrowDown', altKey: true }, { key: 'c', ctrlKey: true }, { key: 'v', metaKey: true },
    { key: 'Shift' },
  ]) {
    assert.equal(recorreConTecla(tecla), false, JSON.stringify(tecla))
  }
})
