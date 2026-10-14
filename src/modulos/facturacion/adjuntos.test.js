// Tests de las reglas de los Adjuntos de un Comprobante (node --test, sin
// dependencias; plan E2, FB1). Las constantes y los mensajes de validarArchivo
// son los de app/modulos/facturacion/config.py y adjuntos_service.py del
// backend: si difieren, el front deja pasar un archivo que el backend frena, o
// frena uno que el backend aceptaría.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TAMANO_MAXIMO,
  MAXIMO_POR_COMPROBANTE,
  EXTENSIONES,
  validarArchivo,
  mensajeDeAdjunto,
} from './adjuntos.js'

const MB = 1024 * 1024

// Lo que importa de un File: el nombre y el tamaño en bytes.
const archivo = (name, size = 1000) => ({ name, size })

// ─── Constantes ─────────────────────────────────────────────────────────────

test('constantes: las mismas que el backend', () => {
  assert.equal(TAMANO_MAXIMO, 10 * MB)
  assert.equal(MAXIMO_POR_COMPROBANTE, 5)
  assert.deepEqual(EXTENSIONES, ['.pdf', '.png', '.jpg', '.jpeg'])
})

// ─── validarArchivo ─────────────────────────────────────────────────────────

test('validarArchivo: PDF, PNG, JPG y JPEG sirven', () => {
  for (const nombre of ['factura.pdf', 'foto.png', 'foto.jpg', 'foto.jpeg']) {
    assert.equal(validarArchivo(archivo(nombre), 0), null, nombre)
  }
})

test('validarArchivo: la extensión no distingue mayúsculas', () => {
  for (const nombre of ['FACTURA.PDF', 'Foto.Png', 'foto.JPG', 'foto.JpEg']) {
    assert.equal(validarArchivo(archivo(nombre), 0), null, nombre)
  }
})

test('validarArchivo: cuenta la extensión del último punto', () => {
  assert.equal(validarArchivo(archivo('factura 0001.2026.pdf'), 0), null)
  assert.equal(validarArchivo(archivo('factura.pdf.exe'), 0),
    'Sólo se aceptan archivos .pdf, .png, .jpg o .jpeg.')
})

test('validarArchivo: otra extensión, o ninguna, no sirve', () => {
  for (const nombre of ['planilla.xlsx', 'logo.svg', 'foto.heic', 'factura', 'factura.', '.pdf.txt']) {
    assert.equal(validarArchivo(archivo(nombre), 0),
      'Sólo se aceptan archivos .pdf, .png, .jpg o .jpeg.', nombre)
  }
})

test('validarArchivo: exactamente 10 MB sirve, un byte más no', () => {
  assert.equal(validarArchivo(archivo('factura.pdf', 10 * MB), 0), null)
  assert.equal(validarArchivo(archivo('factura.pdf', 10 * MB + 1), 0),
    'El archivo pesa más de 10 MB, el máximo por adjunto.')
})

test('validarArchivo: con 4 adjuntos todavía entra uno, con 5 no', () => {
  assert.equal(validarArchivo(archivo('factura.pdf'), 4), null)
  assert.equal(validarArchivo(archivo('factura.pdf'), 5),
    'Un comprobante admite hasta 5 adjuntos. Quitá uno para subir otro.')
  assert.equal(validarArchivo(archivo('factura.pdf'), 6),
    'Un comprobante admite hasta 5 adjuntos. Quitá uno para subir otro.')
})

test('validarArchivo: con varios problemas, el orden del backend (límite, tamaño, extensión)', () => {
  const grandeYMalNombrado = archivo('planilla.xlsx', 11 * MB)
  assert.equal(validarArchivo(grandeYMalNombrado, 5),
    'Un comprobante admite hasta 5 adjuntos. Quitá uno para subir otro.')
  assert.equal(validarArchivo(grandeYMalNombrado, 0),
    'El archivo pesa más de 10 MB, el máximo por adjunto.')
})

// ─── mensajeDeAdjunto ───────────────────────────────────────────────────────
// Primero el `detail.mensaje` del backend, que llega al subir y al quitar; si
// no hay, por status: la descarga se pide como blob (sin detail legible), y
// un 413 de nginx llega en HTML. El status puede venir como lo deja el
// interceptor de src/core/api.js (error.status) o como lo deja axios
// (error.response.status). Plan E2, FB1, "Lo decidido al ejecutarlo".

const comoApi = status => Object.assign(new Error('mensaje del interceptor'), { status })
const comoAxios = status => Object.assign(new Error('Request failed'), { response: { status } })

const MENSAJES = {
  403: 'No tenés permiso para esto en los adjuntos. Si lo necesitás, pedíselo a quien administra el sistema.',
  404: 'Ese adjunto ya no está. Actualizá la pantalla y, si sigue apareciendo, quitalo y volvé a subirlo.',
  413: 'El archivo pesa más de 10 MB, el máximo por adjunto.',
  503: 'Los adjuntos no están habilitados en este servidor. Avisale a quien administra el sistema.',
}
const OTRO = 'No se pudo completar la operación con el adjunto. Probá de nuevo en un rato.'

test('mensajeDeAdjunto: 403, 404, 413 y 503, con el status del interceptor', () => {
  for (const [status, mensaje] of Object.entries(MENSAJES)) {
    assert.equal(mensajeDeAdjunto(comoApi(Number(status))), mensaje, status)
  }
})

test('mensajeDeAdjunto: 403, 404, 413 y 503, con el status de axios', () => {
  for (const [status, mensaje] of Object.entries(MENSAJES)) {
    assert.equal(mensajeDeAdjunto(comoAxios(Number(status))), mensaje, status)
  }
})

test('mensajeDeAdjunto: cualquier otro status da el mensaje general', () => {
  for (const status of [400, 409, 422, 500, 502, 504]) {
    assert.equal(mensajeDeAdjunto(comoApi(status)), OTRO, String(status))
  }
})

test('mensajeDeAdjunto: sin respuesta (red caída o tiempo agotado) da el mensaje general', () => {
  assert.equal(mensajeDeAdjunto(new Error('Network Error')), OTRO)
  assert.equal(mensajeDeAdjunto(comoApi(undefined)), OTRO)
  assert.equal(mensajeDeAdjunto(null), OTRO)
  assert.equal(mensajeDeAdjunto(undefined), OTRO)
})

test('mensajeDeAdjunto: usa detail.mensaje y nunca el texto del error', () => {
  // Sin detail (descarga como blob), el texto del error no sirve: va el del status.
  const sinDetail = Object.assign(new Error('[object Blob]'), { status: 404, detail: undefined })
  assert.equal(mensajeDeAdjunto(sinDetail), MENSAJES[404])
  // Con detail.mensaje, ése y no el texto del error.
  const conDetail = Object.assign(new Error('texto del interceptor'), {
    status: 404, detail: { tipo: 'archivo_no_encontrado', mensaje: 'Mensaje del backend.' },
  })
  assert.equal(mensajeDeAdjunto(conDetail), 'Mensaje del backend.')
})

test('mensajeDeAdjunto: el detail.mensaje del backend gana sobre el status', () => {
  const casos = [
    [422, 'adjunto_invalido', 'El archivo dice ser PDF pero por dentro es PNG. Cambiale la extensión o subí el archivo correcto.'],
    [409, 'limite_adjuntos', 'Un comprobante admite hasta 5 adjuntos. Quitá uno para subir otro.'],
    [413, 'adjunto_muy_grande', 'El archivo pesa más de 10 MB, el máximo por adjunto.'],
    [503, 'adjuntos_sin_configurar', 'Los adjuntos no están habilitados en este servidor: falta configurar FACTURACION_ADJUNTOS_DIR.'],
  ]
  for (const [status, tipo, mensaje] of casos) {
    const error = Object.assign(new Error('x'), { status, detail: { tipo, mensaje } })
    assert.equal(mensajeDeAdjunto(error), mensaje, tipo)
  }
})

test('mensajeDeAdjunto: detail sin mensaje, con mensaje vacío o en texto cae al status', () => {
  const con = detail => Object.assign(new Error('x'), { status: 503, detail })
  assert.equal(mensajeDeAdjunto(con({ tipo: 'adjuntos_sin_configurar' })), MENSAJES[503])
  assert.equal(mensajeDeAdjunto(con({ tipo: 'adjuntos_sin_configurar', mensaje: '' })), MENSAJES[503])
  assert.equal(mensajeDeAdjunto(con({ tipo: 'adjuntos_sin_configurar', mensaje: '   ' })), MENSAJES[503])
  assert.equal(mensajeDeAdjunto(con({ tipo: 'adjuntos_sin_configurar', mensaje: 42 })), MENSAJES[503])
  // Un detail de texto (el 404 común del backend) o la lista de validación de FastAPI.
  assert.equal(mensajeDeAdjunto(con('No existe ese adjunto.')), MENSAJES[503])
  assert.equal(mensajeDeAdjunto(con([{ msg: 'Field required' }])), MENSAJES[503])
})
