// Tests de los textos y formatos de la pantalla del Resumen (node --test, sin
// dependencias; plan E3, FA5): la hora de lectura del campo, las medidas de la
// tabla, el texto de cada cuadro de Alertas y el formulario del pie (Umbral de
// diferencia y Mes de corte). Las respuestas tienen la forma de las rutas 13 y
// 17 del plan E3 (sección 3.2).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  horaDeLectura, textoMedida, medidaVacia, textoDeCuadro, textoUmbral,
  umbralParaEditar, leerConfiguracion, textoUltimoCambio, OTRO_PERIODO, periodoElegido,
} from './vistaResumen.js'

// Una zona fija, así el test no depende de la PC donde corre (UTC-3).
const ZONA = 'America/Argentina/Buenos_Aires'

test('horaDeLectura lee `leido_en` como UTC aunque venga sin zona', () => {
  assert.equal(horaDeLectura('2026-10-15T13:42:07', ZONA), '10:42')
  assert.equal(horaDeLectura('2026-10-15T13:42:07.123456', ZONA), '10:42')
})

test('horaDeLectura respeta la zona si viene', () => {
  assert.equal(horaDeLectura('2026-10-15T13:42:07Z', ZONA), '10:42')
  assert.equal(horaDeLectura('2026-10-15T13:42:07+00:00', ZONA), '10:42')
})

test('horaDeLectura va en 24 horas y con dos dígitos', () => {
  assert.equal(horaDeLectura('2026-10-15T12:05:00', ZONA), '09:05')
  assert.equal(horaDeLectura('2026-10-15T20:30:00', ZONA), '17:30')
})

test('horaDeLectura sin una fecha que se lea da null', () => {
  assert.equal(horaDeLectura(null, ZONA), null)
  assert.equal(horaDeLectura('', ZONA), null)
  assert.equal(horaDeLectura('ayer', ZONA), null)
})

test('textoMedida muestra el decimal en es-AR, hasta dos decimales y sin ceros de más', () => {
  assert.equal(textoMedida('1739.00'), '1.739')
  assert.equal(textoMedida('120.50'), '120,5')
  assert.equal(textoMedida('4.25'), '4,25')
  assert.equal(textoMedida('12345678.75'), '12.345.678,75')
})

test('textoMedida y medidaVacia: cero, vacío o ilegible es una raya', () => {
  for (const valor of ['0', '0.00', '-0.00', null, undefined, '', 'abc']) {
    assert.equal(textoMedida(valor), '—', String(valor))
    assert.equal(medidaVacia(valor), true, String(valor))
  }
  assert.equal(medidaVacia('0.01'), false)
  assert.equal(medidaVacia('-3.00'), false)
})

test('textoDeCuadro: el texto de cada Alerta en singular y en plural', () => {
  assert.equal(textoDeCuadro('pendiente_de_facturar', 1), 'cliente pendiente de facturar')
  assert.equal(textoDeCuadro('pendiente_de_facturar', 3), 'clientes pendientes de facturar')
  assert.equal(textoDeCuadro('pendiente_de_facturar', 0), 'clientes pendientes de facturar')
  assert.equal(textoDeCuadro('con_diferencia', 1), 'cliente con diferencia')
  assert.equal(textoDeCuadro('con_diferencia', 4), 'clientes con diferencia')
  assert.equal(textoDeCuadro('falta_comprobante', 1), 'factura sin comprobante (PDF)')
  assert.equal(textoDeCuadro('falta_comprobante', 2), 'facturas sin comprobante (PDF)')
})

test('textoUmbral: el Umbral del pie, sin ceros de más', () => {
  assert.equal(textoUmbral('5.00'), '5 %')
  assert.equal(textoUmbral('2.50'), '2,5 %')
  assert.equal(textoUmbral('12.75'), '12,75 %')
  assert.equal(textoUmbral(null), null)
  assert.equal(textoUmbral('x'), null)
})

test('umbralParaEditar: el Umbral en el campo, con coma y dos decimales', () => {
  assert.equal(umbralParaEditar('5.00'), '5,00')
  assert.equal(umbralParaEditar('12.5'), '12,50')
  assert.equal(umbralParaEditar('7'), '7,00')
  assert.equal(umbralParaEditar(null), '')
  assert.equal(umbralParaEditar('x'), '')
})

test('leerConfiguracion arma el body del PUT con el Umbral con punto', () => {
  assert.deepEqual(leerConfiguracion('5,00', '2026-10'),
    { datos: { umbral_pct: '5.00', mes_corte: '2026-10' }, errores: {} })
  assert.deepEqual(leerConfiguracion(' 7,5 ', '2026-09'),
    { datos: { umbral_pct: '7.5', mes_corte: '2026-09' }, errores: {} })
})

test('leerConfiguracion: un Umbral vacío o ilegible es un error de su campo', () => {
  for (const umbral of ['', '   ', 'cinco', '5.5']) {
    const { datos, errores } = leerConfiguracion(umbral, '2026-10')
    assert.equal(datos, null, umbral)
    assert.match(errores.umbral_pct, /número/, umbral)
    assert.equal(errores.mes_corte, undefined, umbral)
  }
})

test('leerConfiguracion: sin Mes de corte, o mal escrito, es un error de su campo', () => {
  for (const mes of ['', null, '2026-13', '2026-1']) {
    const { datos, errores } = leerConfiguracion('5,00', mes)
    assert.equal(datos, null, String(mes))
    assert.match(errores.mes_corte, /Mes de corte/, String(mes))
    assert.equal(errores.umbral_pct, undefined, String(mes))
  }
})

test('leerConfiguracion junta los dos errores', () => {
  const { errores } = leerConfiguracion('', '')
  assert.ok(errores.umbral_pct)
  assert.ok(errores.mes_corte)
})

test('textoUltimoCambio: quién y cuándo, con la hora de la PC', () => {
  assert.equal(
    textoUltimoCambio({ actualizado_en: '2026-10-14T12:15:00', actualizado_por_nombre: 'Persona Admin' }, ZONA),
    'Último cambio: Persona Admin, 14/10/2026 09:15',
  )
})

test('textoUltimoCambio sin quién dice sólo cuándo, y sin cuándo da null', () => {
  assert.equal(
    textoUltimoCambio({ actualizado_en: '2026-10-14T12:15:00', actualizado_por_nombre: null }, ZONA),
    'Último cambio: 14/10/2026 09:15',
  )
  assert.equal(textoUltimoCambio({ actualizado_en: null, actualizado_por_nombre: 'Persona Admin' }, ZONA), null)
  assert.equal(textoUltimoCambio(null, ZONA), null)
  assert.equal(textoUltimoCambio({}, ZONA), null)
})

test('periodoElegido: un atajo se calcula con el día de hoy', () => {
  const hoy = new Date(2026, 0, 20)
  assert.deepEqual(periodoElegido({ atajo: 'mes_pasado' }, hoy), { desde: '2025-12', hasta: '2025-12' })
  assert.deepEqual(periodoElegido({ atajo: 'este_anio', desde: '2020-01', hasta: '2020-02' }, hoy),
    { desde: '2026-01', hasta: '2026-01' })
})

test('periodoElegido: "Otro período" usa Desde y Hasta tal cual', () => {
  const hoy = new Date(2026, 9, 15)
  assert.deepEqual(periodoElegido({ atajo: OTRO_PERIODO, desde: '2026-03', hasta: '2026-05' }, hoy),
    { desde: '2026-03', hasta: '2026-05' })
  assert.deepEqual(periodoElegido({ atajo: OTRO_PERIODO }, hoy), { desde: '', hasta: '' })
})

test('periodoElegido: un atajo que no existe vuelve al inicial, el mes pasado', () => {
  assert.deepEqual(periodoElegido({ atajo: 'viejo' }, new Date(2026, 9, 15)), { desde: '2026-09', hasta: '2026-09' })
  assert.deepEqual(periodoElegido(undefined, new Date(2026, 9, 15)), { desde: '2026-09', hasta: '2026-09' })
})
