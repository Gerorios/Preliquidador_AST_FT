// Tests de tarjetas del Inicio y aterrizaje por permisos de pantalla (ADR-0020;
// node --test, sin dependencias propias). Los descriptores son falsos pero
// copian la forma que tienen los de `src/modulos/*/rutas.jsx` desde el par 3.3:
// cada entrada de `nav` declara su `pantalla`, y el descriptor declara la del
// panel gerencial en `gerencial: { ruta, pantalla }`. Los permisos de las tres
// personas "semilla" son los de la migración core/002 (plan, sección 2.5).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { homeDeModulo, menuDe, tarjetasDe } from './accesos.js'

const preliquidacion = {
  clave: 'preliquidacion',
  nombre: 'Preliquidación',
  descripcion: () => 'Descripción de Preliquidación.',
  icono: 'preliquidacion',
  activo: true,
  prefijo: '/preliquidacion',
  nav: [
    { to: '/preliquidacion/dashboard',            label: 'Inicio',        icono: 'inicio',        modulo: 'preliquidacion', pantalla: 'inicio' },
    { to: '/preliquidacion/conceptos',            label: 'Conceptos',     icono: 'conceptos',     modulo: 'preliquidacion', pantalla: 'conceptos' },
    { to: '/preliquidacion/verificacion',         label: 'Verificación',  icono: 'verificacion',  modulo: 'preliquidacion', pantalla: 'verificacion' },
    { to: '/preliquidacion/categorias-operarios', label: 'Mantenimiento', icono: 'mantenimiento', modulo: 'preliquidacion', pantalla: 'mantenimiento' },
  ],
  gerencial: { ruta: '/gerencial', pantalla: 'gerencial' },
}

const terceros = {
  clave: 'terceros',
  nombre: 'Liquidación Terceros',
  descripcion: () => 'Descripción de Terceros.',
  icono: 'terceros',
  activo: true,
  prefijo: '/terceros',
  nav: [
    { to: '/terceros/inicio',         label: 'Inicio',         icono: 'inicio',       modulo: 'terceros', pantalla: 'inicio' },
    { to: '/terceros/quincena',       label: 'Quincena',       icono: 'gerencial',    modulo: 'terceros', pantalla: 'quincena' },
    { to: '/terceros/tarifario',      label: 'Tarifario',      icono: 'conceptos',    modulo: 'terceros', pantalla: 'tarifario' },
    { to: '/terceros/estaciones',     label: 'Estaciones',     icono: 'conceptos',    modulo: 'terceros', pantalla: 'estaciones' },
    { to: '/terceros/verificaciones', label: 'Verificaciones', icono: 'verificacion', modulo: 'terceros', pantalla: 'verificaciones' },
  ],
  gerencial: null,
}

const DESCRIPTORES = [preliquidacion, terceros]

const persona = (permisos) => ({ id: 10, nombre: 'Prueba', rol: 'usuario', permisos })

// Semilla de core/002 (plan, sección 2.5).
const preliquidador = persona({
  preliquidacion: { inicio: 'editar', revision: 'editar', verificacion: 'editar', mantenimiento: 'editar', conceptos: 'editar' },
})
const gerente = persona({ preliquidacion: { gerencial: 'ver', conceptos: 'editar' } })
const liquidador = persona({
  terceros: { inicio: 'editar', quincena: 'editar', tarifario: 'editar', estaciones: 'editar', verificaciones: 'ver' },
})
const admin = { id: 1, nombre: 'Admin', rol: 'admin', permisos: {} }

const claves = (tarjetas) => tarjetas.map(t => t.clave)
const rutaDe = (tarjetas, clave) => tarjetas.find(t => t.clave === clave)?.ruta

test('Preliquidador: sólo la tarjeta de Preliquidación, que aterriza en su Inicio', () => {
  assert.equal(homeDeModulo(preliquidacion, preliquidador), '/preliquidacion/dashboard')
  const tarjetas = tarjetasDe(DESCRIPTORES, preliquidador)
  assert.deepEqual(claves(tarjetas), ['preliquidacion'])
  assert.equal(rutaDe(tarjetas, 'preliquidacion'), '/preliquidacion/dashboard')
})

test('Gerente: Preliquidación aterriza en Conceptos, más la tarjeta Gerencial', () => {
  assert.equal(homeDeModulo(preliquidacion, gerente), '/preliquidacion/conceptos')
  const tarjetas = tarjetasDe(DESCRIPTORES, gerente)
  assert.deepEqual(claves(tarjetas), ['preliquidacion', 'gerencial'])
  assert.equal(rutaDe(tarjetas, 'preliquidacion'), '/preliquidacion/conceptos')
  assert.equal(rutaDe(tarjetas, 'gerencial'), '/gerencial')
})

test('Liquidador de terceros: sólo la tarjeta de Terceros, que aterriza en su Inicio', () => {
  assert.equal(homeDeModulo(terceros, liquidador), '/terceros/inicio')
  assert.equal(homeDeModulo(preliquidacion, liquidador), null)
  const tarjetas = tarjetasDe(DESCRIPTORES, liquidador)
  assert.deepEqual(claves(tarjetas), ['terceros'])
  assert.equal(rutaDe(tarjetas, 'terceros'), '/terceros/inicio')
})

test('las tarjetas tienen la forma que consume el Inicio', () => {
  const [tarjeta, gerencial] = tarjetasDe(DESCRIPTORES, gerente)
  assert.deepEqual(tarjeta, {
    clave: 'preliquidacion', nombre: 'Preliquidación', descripcion: 'Descripción de Preliquidación.',
    icono: 'preliquidacion', ruta: '/preliquidacion/conceptos', familia: 'modulo',
  })
  assert.deepEqual(gerencial, {
    clave: 'gerencial', nombre: 'Gerencial', icono: 'gerencial', familia: 'gerencial',
    descripcion: 'Indicadores, evolución y desvíos de Preliquidación.', ruta: '/gerencial',
  })
})

test('Gerente + Verificación (Ver): su menú tiene Conceptos y Verificación, y sigue aterrizando en Conceptos', () => {
  const conVerificacion = persona({ preliquidacion: { gerencial: 'ver', conceptos: 'editar', verificacion: 'ver' } })
  assert.deepEqual(menuDe(preliquidacion, conVerificacion).map(n => n.to),
    ['/preliquidacion/conceptos', '/preliquidacion/verificacion'])
  assert.equal(homeDeModulo(preliquidacion, conVerificacion), '/preliquidacion/conceptos')
  assert.deepEqual(claves(tarjetasDe(DESCRIPTORES, conVerificacion)), ['preliquidacion', 'gerencial'])
})

test('sólo Vista gerencial: sólo la tarjeta Gerencial, sin la del módulo (pregunta 3)', () => {
  const soloGerencial = persona({ preliquidacion: { gerencial: 'ver' } })
  assert.equal(homeDeModulo(preliquidacion, soloGerencial), null)
  assert.deepEqual(menuDe(preliquidacion, soloGerencial), [])
  const tarjetas = tarjetasDe(DESCRIPTORES, soloGerencial)
  assert.deepEqual(claves(tarjetas), ['gerencial'])
  assert.equal(rutaDe(tarjetas, 'gerencial'), '/gerencial')
})

test('sin permisos no hay tarjetas (y por eso el Login no deja entrar)', () => {
  for (const usuario of [persona({}), { id: 11, rol: 'usuario' }, null, undefined]) {
    assert.deepEqual(tarjetasDe(DESCRIPTORES, usuario), [])
  }
})

test('admin: todas las tarjetas, más Gerencial y Administración', () => {
  const tarjetas = tarjetasDe(DESCRIPTORES, admin)
  assert.deepEqual(claves(tarjetas), ['preliquidacion', 'terceros', 'gerencial', 'administracion'])
  assert.equal(rutaDe(tarjetas, 'preliquidacion'), '/preliquidacion/dashboard')
  assert.equal(rutaDe(tarjetas, 'terceros'), '/terceros/inicio')
  assert.equal(rutaDe(tarjetas, 'administracion'), '/administracion')
  assert.equal(tarjetas.find(t => t.clave === 'administracion').familia, 'administracion')
})

test('un módulo inactivo no da tarjeta, ni la suya ni la de su panel gerencial', () => {
  const inactivo = { ...preliquidacion, activo: false }
  assert.deepEqual(claves(tarjetasDe([inactivo, terceros], gerente)), [])
  assert.deepEqual(claves(tarjetasDe([inactivo, terceros], admin)), ['terceros', 'administracion'])
})

test('Revisión no tiene entrada de menú: verla sola no da tarjeta', () => {
  const soloRevision = persona({ preliquidacion: { revision: 'editar' } })
  assert.equal(homeDeModulo(preliquidacion, soloRevision), null)
  assert.deepEqual(tarjetasDe(DESCRIPTORES, soloRevision), [])
})
