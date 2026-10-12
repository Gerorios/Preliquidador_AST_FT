import { test } from 'node:test'
import assert from 'node:assert/strict'
import { debeTragar } from './bloqueoTeclado.js'

const tecla = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra })

test('mientras se guarda, se tragan las teclas que mueven el foco o activan algo', () => {
  for (const key of ['Tab', 'Enter', ' ', 'Escape', 'ArrowDown', 'a', '1', 'Backspace']) {
    assert.equal(debeTragar(tecla(key)), true, key)
  }
  assert.equal(debeTragar(tecla('Tab', { shiftKey: true })), true, 'Shift+Tab')
})

test('se tragan las teclas que abren la lista de un select o cambian un campo', () => {
  assert.equal(debeTragar(tecla('F4')), true, 'F4')
  assert.equal(debeTragar(tecla('ArrowDown', { altKey: true })), true, 'Alt+Flecha abajo')
  assert.equal(debeTragar(tecla('v', { ctrlKey: true })), true, 'Ctrl+V')
  assert.equal(debeTragar(tecla('x', { ctrlKey: true })), true, 'Ctrl+X')
  assert.equal(debeTragar(tecla('z', { ctrlKey: true })), true, 'Ctrl+Z')
  assert.equal(debeTragar(tecla('Backspace', { ctrlKey: true })), true, 'Ctrl+Backspace')
  // AltGr en Windows llega como Ctrl+Alt: escribe @ # [ ] en un campo de texto.
  assert.equal(debeTragar(tecla('@', { ctrlKey: true, altKey: true })), true, 'AltGr+@')
  assert.equal(debeTragar(tecla('c', { ctrlKey: true, altKey: true })), true, 'AltGr+C')
})

test('los atajos del navegador de la lista blanca siguen andando', () => {
  assert.equal(debeTragar(tecla('r', { ctrlKey: true })), false, 'Ctrl+R')
  assert.equal(debeTragar(tecla('R', { ctrlKey: true, shiftKey: true })), false, 'Ctrl+Shift+R')
  assert.equal(debeTragar(tecla('r', { metaKey: true })), false, 'Cmd+R')
  assert.equal(debeTragar(tecla('c', { ctrlKey: true })), false, 'Ctrl+C')
  assert.equal(debeTragar(tecla('f', { ctrlKey: true })), false, 'Ctrl+F')
  assert.equal(debeTragar(tecla('F5')), false, 'F5')
  assert.equal(debeTragar(tecla('F5', { ctrlKey: true })), false, 'Ctrl+F5')
  assert.equal(debeTragar(tecla('F12')), false, 'F12')
})
