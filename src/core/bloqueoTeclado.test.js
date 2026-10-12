import { test } from 'node:test'
import assert from 'node:assert/strict'
import { debeTragar } from './bloqueoTeclado.js'

const tecla = (key, extra = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, ...extra })

test('mientras se guarda, se tragan las teclas que mueven el foco o activan algo', () => {
  for (const key of ['Tab', 'Enter', ' ', 'Escape', 'ArrowDown', 'a', '1', 'Backspace']) {
    assert.equal(debeTragar(tecla(key)), true, key)
  }
  assert.equal(debeTragar(tecla('Tab', { shiftKey: true })), true, 'Shift+Tab')
})

test('los atajos del navegador siguen andando', () => {
  assert.equal(debeTragar(tecla('r', { ctrlKey: true })), false, 'Ctrl+R')
  assert.equal(debeTragar(tecla('c', { ctrlKey: true })), false, 'Ctrl+C')
  assert.equal(debeTragar(tecla('r', { metaKey: true })), false, 'Cmd+R')
  assert.equal(debeTragar(tecla('ArrowLeft', { altKey: true })), false, 'Alt+Flecha')
  assert.equal(debeTragar(tecla('F5')), false, 'F5')
  assert.equal(debeTragar(tecla('F12')), false, 'F12')
})
