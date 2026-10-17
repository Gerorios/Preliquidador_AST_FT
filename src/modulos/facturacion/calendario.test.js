// Tests del calendario del período del Resumen (node --test, sin dependencias;
// Ticket 4 del plan del período en curso): los dos clics, dar vuelta, el tope,
// qué atajo coincide, la grilla del mes y el teclado. `hoy` va fijo y armado
// con la hora local; los días viajan como "AAAA-MM-DD".

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  atajosQueCoinciden, clicEnDia, diaDeHoy, diaElegible, etiquetaDia, hayMesSiguiente, mesDeDia, mesVecino,
  moverDia, semanasDelMes, textoPeriodo, tituloMes,
} from './calendario.js'

const dia = (anio, mes, d) => new Date(anio, mes - 1, d)
const OCTUBRE = dia(2026, 10, 14)
const TOPE = '2026-10-31'

// ─── Los dos clics ──────────────────────────────────────────────────────────

test('clicEnDia: el primer clic marca Desde y deja Hasta sin elegir', () => {
  assert.deepEqual(clicEnDia(null, '2026-10-05', TOPE), { desde: '2026-10-05', hasta: null })
})

test('clicEnDia: el segundo clic marca Hasta y completa el rango', () => {
  const primero = clicEnDia(null, '2026-10-01', TOPE)
  assert.deepEqual(clicEnDia(primero, '2026-10-15', TOPE), { desde: '2026-10-01', hasta: '2026-10-15' })
})

test('clicEnDia: un Hasta anterior a Desde se da vuelta', () => {
  const primero = clicEnDia(null, '2026-10-15', TOPE)
  assert.deepEqual(clicEnDia(primero, '2026-09-20', TOPE), { desde: '2026-09-20', hasta: '2026-10-15' })
})

test('clicEnDia: el mismo día dos veces es un rango de un día', () => {
  const primero = clicEnDia(null, '2026-10-07', TOPE)
  assert.deepEqual(clicEnDia(primero, '2026-10-07', TOPE), { desde: '2026-10-07', hasta: '2026-10-07' })
})

test('clicEnDia: con un rango completo (por ejemplo, el de un atajo), el clic arranca otro', () => {
  const atajo = { desde: '2026-09-01', hasta: '2026-09-30' }
  assert.deepEqual(clicEnDia(atajo, '2026-10-02', TOPE), { desde: '2026-10-02', hasta: null })
})

test('clicEnDia: un día después del tope no se elige y no cambia nada', () => {
  const primero = { desde: '2026-10-01', hasta: null }
  assert.equal(clicEnDia(primero, '2026-11-01', TOPE), primero)
  assert.equal(clicEnDia(null, '2026-11-01', TOPE), null)
})

test('diaElegible: hasta el tope incluido, nada después', () => {
  assert.equal(diaElegible('2026-10-31', TOPE), true)
  assert.equal(diaElegible('2025-01-01', TOPE), true)
  assert.equal(diaElegible('2026-11-01', TOPE), false)
})

test('diaDeHoy: el día de hoy con la hora local, para marcarlo en el calendario', () => {
  assert.equal(diaDeHoy(OCTUBRE), '2026-10-14')
  assert.equal(diaDeHoy(dia(2027, 1, 5)), '2027-01-05')
})

// ─── Qué atajo coincide ─────────────────────────────────────────────────────

test('atajosQueCoinciden: el atajo cuyo rango es el elegido', () => {
  assert.deepEqual(atajosQueCoinciden('2026-09-01', '2026-09-30', OCTUBRE), ['mes_pasado'])
  assert.deepEqual(atajosQueCoinciden('2026-10-01', '2026-10-15', OCTUBRE), ['esta_quincena'])
  assert.deepEqual(atajosQueCoinciden('2026-09-16', '2026-09-30', OCTUBRE), ['quincena_pasada'])
})

test('atajosQueCoinciden: un rango a mano que no es de ningún atajo no marca ninguno', () => {
  assert.deepEqual(atajosQueCoinciden('2026-09-01', '2026-09-29', OCTUBRE), [])
  assert.deepEqual(atajosQueCoinciden('', '', OCTUBRE), [])
})

test('atajosQueCoinciden: en enero, Este mes y Este año son el mismo rango y se marcan los dos', () => {
  assert.deepEqual(atajosQueCoinciden('2027-01-01', '2027-01-31', dia(2027, 1, 20)), ['este_mes', 'este_anio'])
})

// ─── La grilla del mes ──────────────────────────────────────────────────────

test('mesDeDia y mesVecino: el mes a la vista y el anterior y el siguiente, cruzando el año', () => {
  assert.deepEqual(mesDeDia('2026-10-14'), { anio: 2026, mes: 10 })
  assert.deepEqual(mesVecino({ anio: 2026, mes: 1 }, -1), { anio: 2025, mes: 12 })
  assert.deepEqual(mesVecino({ anio: 2026, mes: 12 }, 1), { anio: 2027, mes: 1 })
})

test('hayMesSiguiente: no se pasa del mes del tope', () => {
  assert.equal(hayMesSiguiente({ anio: 2026, mes: 9 }, TOPE), true)
  assert.equal(hayMesSiguiente({ anio: 2026, mes: 10 }, TOPE), false)
})

test('semanasDelMes: semanas de lunes a domingo, con huecos antes del 1 y después del último', () => {
  // Octubre de 2026 empieza un jueves y termina un sábado.
  const semanas = semanasDelMes({ anio: 2026, mes: 10 })
  assert.equal(semanas.length, 5)
  for (const s of semanas) assert.equal(s.length, 7)
  assert.deepEqual(semanas[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
  assert.deepEqual(semanas[4], ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', null])
})

test('semanasDelMes: febrero de un año bisiesto tiene 29 días', () => {
  const dias = semanasDelMes({ anio: 2028, mes: 2 }).flat().filter(Boolean)
  assert.equal(dias.length, 29)
  assert.equal(dias.at(-1), '2028-02-29')
})

// ─── Teclado ────────────────────────────────────────────────────────────────

test('moverDia: las flechas mueven de a un día o de a una semana, cruzando meses y años', () => {
  assert.equal(moverDia('2026-10-31', 1), '2026-11-01')
  assert.equal(moverDia('2026-10-01', -1), '2026-09-30')
  assert.equal(moverDia('2026-12-29', 7), '2027-01-05')
  assert.equal(moverDia('2026-03-02', -7), '2026-02-23')
})

// ─── Textos ─────────────────────────────────────────────────────────────────

test('textoPeriodo: el campo muestra Desde y Hasta con el formato de fecha del módulo', () => {
  assert.equal(textoPeriodo('2026-10-01', '2026-10-15'), '01/10/2026 – 15/10/2026')
  assert.equal(textoPeriodo('', ''), 'Elegí el período')
})

test('tituloMes y etiquetaDia: el mes a la vista y el nombre completo del día para lectores de pantalla', () => {
  assert.equal(tituloMes({ anio: 2026, mes: 10 }), 'Octubre 2026')
  assert.equal(etiquetaDia('2026-10-14'), 'miércoles 14 de octubre de 2026')
  assert.equal(etiquetaDia('2026-11-01'), 'domingo 1 de noviembre de 2026')
})
