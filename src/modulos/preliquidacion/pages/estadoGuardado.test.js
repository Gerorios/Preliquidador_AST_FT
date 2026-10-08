// Tests de la parte pura del estado guardado por pantalla (node --test, sin
// dependencias): cómo se resuelve el valor nuevo y cuándo se borra todo al
// cambiar la sesión. El authStore es un falso con la forma de zustand.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolverValor, conectarCierreDeSesion } from './estadoGuardado.js'

// Store falso con la interfaz que usa conectarCierreDeSesion: getState() y
// subscribe(fn), que llama a fn(estado, estadoAnterior) como zustand.
function storeFalso(inicial) {
  let estado = inicial
  const listeners = new Set()
  return {
    getState: () => estado,
    subscribe: (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    set: (parcial) => {
      const anterior = estado
      estado = { ...estado, ...parcial }
      listeners.forEach(fn => fn(estado, anterior))
    },
    cantidadListeners: () => listeners.size,
  }
}

// Devuelve una función limpiar que cuenta cuántas veces la llamaron.
function contador() {
  const limpiar = () => { limpiar.veces += 1 }
  limpiar.veces = 0
  return limpiar
}

test('resolverValor: un valor directo reemplaza al previo', () => {
  assert.equal(resolverValor('viejo', 'inicial', 'nuevo'), 'nuevo')
})

test('resolverValor: una función recibe el valor previo', () => {
  assert.equal(resolverValor(2, 0, v => v + 1), 3)
})

test('resolverValor: una función sin previo recibe el inicial', () => {
  assert.equal(resolverValor(undefined, 10, v => v + 1), 11)
})

test('resolverValor: un null guardado no cae al inicial', () => {
  const recibidos = []
  const resultado = resolverValor(null, 'inicial', v => { recibidos.push(v); return 'x' })
  assert.deepEqual(recibidos, [null])
  assert.equal(resultado, 'x')
})

test('conectarCierreDeSesion: cerrar sesión (token a null) limpia', () => {
  const store = storeFalso({ token: 'a', usuario: 'ana' })
  const limpiar = contador()
  conectarCierreDeSesion(store, limpiar)
  store.set({ token: null, usuario: null })
  assert.equal(limpiar.veces, 1)
})

test('conectarCierreDeSesion: cambiar de usuario sin cerrar sesión limpia', () => {
  const store = storeFalso({ token: 'a', usuario: 'ana' })
  const limpiar = contador()
  conectarCierreDeSesion(store, limpiar)
  store.set({ token: 'b', usuario: 'beto' })
  assert.equal(limpiar.veces, 1)
})

test('conectarCierreDeSesion: un cambio que no toca el token no limpia', () => {
  const store = storeFalso({ token: 'a', usuario: 'ana', cargando: false })
  const limpiar = contador()
  conectarCierreDeSesion(store, limpiar)
  assert.equal(store.cantidadListeners(), 1)
  store.set({ cargando: true })
  store.set({ token: 'a' })
  assert.equal(limpiar.veces, 0)
  // El mismo listener sigue atento: un cambio de token después sí limpia.
  store.set({ token: null })
  assert.equal(limpiar.veces, 1)
})

test('conectarCierreDeSesion: después de desuscribir ya no limpia', () => {
  const store = storeFalso({ token: 'a', usuario: 'ana' })
  const limpiar = contador()
  const desuscribir = conectarCierreDeSesion(store, limpiar)
  store.set({ token: 'b' })
  assert.equal(limpiar.veces, 1)
  desuscribir()
  assert.equal(store.cantidadListeners(), 0)
  store.set({ token: null })
  assert.equal(limpiar.veces, 1)
})
