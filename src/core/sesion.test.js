// Tests de la sesión al día (ADR-0020; node --test). `GET /auth/me` devuelve
// {id, nombre, email, rol, permisos} y no trae `password_inicial`, que viene
// sólo en el login: la sesión guardada lo conserva y el resto sale de /auth/me.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fusionarSesion } from './sesion.js'

const guardado = {
  id: 5,
  nombre: 'Ana',
  email: 'ana@x.com',
  rol: 'usuario',
  password_inicial: true,
  permisos: { preliquidacion: { conceptos: 'editar', gerencial: 'ver' } },
}

test('conserva password_inicial del guardado, que /auth/me no trae', () => {
  const me = { id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', permisos: {} }
  assert.equal(fusionarSesion(guardado, me).password_inicial, true)
  assert.equal(fusionarSesion({ ...guardado, password_inicial: false }, me).password_inicial, false)
})

test('toma los permisos de /auth/me: se suma una pantalla y se pierde otra', () => {
  const me = {
    id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario',
    permisos: { preliquidacion: { verificacion: 'ver', gerencial: 'ver' } },
  }
  assert.deepEqual(fusionarSesion(guardado, me).permisos, {
    preliquidacion: { verificacion: 'ver', gerencial: 'ver' },
  })
})

test('toma el rol, el nombre y el email de /auth/me', () => {
  const me = { id: 5, nombre: 'Ana María', email: 'ana.maria@x.com', rol: 'admin', permisos: {} }
  const nuevo = fusionarSesion(guardado, me)
  assert.equal(nuevo.rol, 'admin')
  assert.equal(nuevo.nombre, 'Ana María')
  assert.equal(nuevo.email, 'ana.maria@x.com')
})

test('no arrastra campos viejos del guardado que /auth/me ya no devuelve', () => {
  const me = { id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', permisos: {} }
  const nuevo = fusionarSesion({ ...guardado, modulos: { preliquidacion: 'gerente' } }, me)
  assert.equal('modulos' in nuevo, false)
})

test('sin password_inicial guardado no lo inventa', () => {
  const { password_inicial: _, ...sinMarca } = guardado
  const me = { id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', permisos: {} }
  assert.equal('password_inicial' in fusionarSesion(sinMarca, me), false)
})

test('sin sesión guardada devuelve lo de /auth/me', () => {
  const me = { id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', permisos: {} }
  assert.deepEqual(fusionarSesion(null, me), me)
})

test('no modifica los objetos que recibe', () => {
  const me = { id: 5, nombre: 'Ana', email: 'ana@x.com', rol: 'usuario', permisos: {} }
  const copiaGuardado = structuredClone(guardado)
  const copiaMe = structuredClone(me)
  fusionarSesion(guardado, me)
  assert.deepEqual(guardado, copiaGuardado)
  assert.deepEqual(me, copiaMe)
})
