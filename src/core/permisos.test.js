// Tests de los permisos por pantalla (ADR-0020; node --test, sin dependencias
// propias). La sesión trae `usuario.rol` ('admin' | 'usuario') y
// `usuario.permisos = { <modulo>: { <pantalla>: 'ver' | 'editar' } }`; el admin
// trae `permisos: {}` y puede todo. Editar incluye Ver.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { puedeVer, puedeEditar, puedeVerAlguna } from './permisos.js'

const admin = { id: 1, rol: 'admin', permisos: {} }
const gerente = {
  id: 2,
  rol: 'usuario',
  permisos: { preliquidacion: { conceptos: 'editar', gerencial: 'ver' } },
}

test('el admin ve y edita todo, aunque traiga permisos vacíos', () => {
  assert.equal(puedeVer(admin, 'preliquidacion', 'revision'), true)
  assert.equal(puedeEditar(admin, 'preliquidacion', 'revision'), true)
  assert.equal(puedeVer(admin, 'terceros', 'tarifario'), true)
  assert.equal(puedeVerAlguna(admin, 'terceros', ['inicio']), true)
})

test('Editar incluye Ver', () => {
  assert.equal(puedeVer(gerente, 'preliquidacion', 'conceptos'), true)
  assert.equal(puedeEditar(gerente, 'preliquidacion', 'conceptos'), true)
})

test('Ver no alcanza para editar', () => {
  assert.equal(puedeVer(gerente, 'preliquidacion', 'gerencial'), true)
  assert.equal(puedeEditar(gerente, 'preliquidacion', 'gerencial'), false)
})

test('una pantalla sin fila no da nada', () => {
  assert.equal(puedeVer(gerente, 'preliquidacion', 'revision'), false)
  assert.equal(puedeEditar(gerente, 'preliquidacion', 'revision'), false)
})

test('sin permisos no ve nada', () => {
  const sinPermisos = { id: 3, rol: 'usuario' }
  assert.equal(puedeVer(sinPermisos, 'preliquidacion', 'inicio'), false)
  assert.equal(puedeEditar(sinPermisos, 'preliquidacion', 'inicio'), false)
  assert.equal(puedeVerAlguna(sinPermisos, 'preliquidacion', ['inicio', 'revision']), false)
  const vacios = { id: 4, rol: 'usuario', permisos: {} }
  assert.equal(puedeVer(vacios, 'preliquidacion', 'inicio'), false)
})

test('sin usuario no ve nada', () => {
  for (const usuario of [null, undefined]) {
    assert.equal(puedeVer(usuario, 'preliquidacion', 'inicio'), false)
    assert.equal(puedeEditar(usuario, 'preliquidacion', 'inicio'), false)
    assert.equal(puedeVerAlguna(usuario, 'preliquidacion', ['inicio']), false)
  }
})

test('un módulo ajeno no da nada', () => {
  assert.equal(puedeVer(gerente, 'terceros', 'conceptos'), false)
  assert.equal(puedeEditar(gerente, 'terceros', 'conceptos'), false)
  assert.equal(puedeVerAlguna(gerente, 'terceros', ['conceptos', 'gerencial']), false)
})

test('un nivel desconocido no da nada', () => {
  const raro = { id: 5, rol: 'usuario', permisos: { preliquidacion: { inicio: 'operador' } } }
  assert.equal(puedeVer(raro, 'preliquidacion', 'inicio'), false)
  assert.equal(puedeEditar(raro, 'preliquidacion', 'inicio'), false)
})

test('puedeVerAlguna: alcanza con una de las pantallas', () => {
  assert.equal(puedeVerAlguna(gerente, 'preliquidacion', ['inicio', 'revision', 'gerencial']), true)
  assert.equal(puedeVerAlguna(gerente, 'preliquidacion', ['inicio', 'revision', 'verificacion', 'mantenimiento']), false)
})

test('puedeVerAlguna: la lista vacía no da nada', () => {
  assert.equal(puedeVerAlguna(gerente, 'preliquidacion', []), false)
})
