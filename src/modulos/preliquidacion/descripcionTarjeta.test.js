// Tests de la descripción de la tarjeta de Preliquidación en el Inicio
// (node --test, sin dependencias propias). Las entradas de menú son falsas pero
// copian el `nav` de rutas.jsx, en su orden; las de cada persona salen de
// `menuDe`, como en el descriptor. Respuesta 6 del plan del esquema de permisos.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { menuDe } from '../../core/accesos.js'
import { descripcionTarjeta } from './descripcionTarjeta.js'

const preliquidacion = {
  clave: 'preliquidacion',
  nav: [
    { to: '/preliquidacion/dashboard',            label: 'Inicio',        icono: 'inicio',        modulo: 'preliquidacion', pantalla: 'inicio' },
    { to: '/preliquidacion/conceptos',            label: 'Conceptos',     icono: 'conceptos',     modulo: 'preliquidacion', pantalla: 'conceptos' },
    { to: '/preliquidacion/verificacion',         label: 'Verificación',  icono: 'verificacion',  modulo: 'preliquidacion', pantalla: 'verificacion' },
    { to: '/preliquidacion/categorias-operarios', label: 'Mantenimiento', icono: 'mantenimiento', modulo: 'preliquidacion', pantalla: 'mantenimiento' },
  ],
}

const TEXTO_PRELIQUIDADOR = 'Sueldos por quincena: generar, revisar, verificar y exportar.'
const TEXTO_GERENTE = 'Maestro de conceptos y precios por quincena.'

const persona = (permisos) => ({ id: 10, nombre: 'Prueba', rol: 'usuario', permisos: { preliquidacion: permisos } })
const descripcionPara = (usuario) => descripcionTarjeta(menuDe(preliquidacion, usuario))

test('Preliquidador (semilla): el texto de hoy', () => {
  const preliquidador = persona({ inicio: 'editar', revision: 'editar', verificacion: 'editar', mantenimiento: 'editar', conceptos: 'editar' })
  assert.equal(descripcionPara(preliquidador), TEXTO_PRELIQUIDADOR)
})

test('admin: el texto de hoy del Preliquidador', () => {
  assert.equal(descripcionPara({ id: 1, rol: 'admin', permisos: {} }), TEXTO_PRELIQUIDADOR)
})

test('ve Inicio, aunque sea sólo con Ver: el texto del Preliquidador', () => {
  assert.equal(descripcionPara(persona({ inicio: 'ver' })), TEXTO_PRELIQUIDADOR)
  assert.equal(descripcionPara(persona({ inicio: 'ver', revision: 'ver', gerencial: 'ver' })), TEXTO_PRELIQUIDADOR)
})

test('Gerente (semilla): el texto de hoy del gerente', () => {
  assert.equal(descripcionPara(persona({ gerencial: 'ver', conceptos: 'editar' })), TEXTO_GERENTE)
})

test('sólo Conceptos, con Ver: el texto del gerente', () => {
  assert.equal(descripcionPara(persona({ conceptos: 'ver' })), TEXTO_GERENTE)
})

test('otra combinación: la lista de pantallas de menú, en el orden del menú', () => {
  assert.equal(descripcionPara(persona({ gerencial: 'ver', verificacion: 'ver', conceptos: 'editar' })),
    'Pantallas: Conceptos y Verificación.')
  assert.equal(descripcionPara(persona({ mantenimiento: 'editar', verificacion: 'ver', conceptos: 'ver' })),
    'Pantallas: Conceptos, Verificación y Mantenimiento.')
})

test('una sola pantalla que no es Inicio ni Conceptos: la lista con un nombre', () => {
  assert.equal(descripcionPara(persona({ verificacion: 'ver' })), 'Pantallas: Verificación.')
  assert.equal(descripcionPara(persona({ mantenimiento: 'editar', gerencial: 'ver' })), 'Pantallas: Mantenimiento.')
})
