// Reglas de los Adjuntos de un Comprobante (plan E2, FB1): qué archivo se
// puede subir y qué decirle a la persona cuando un pedido falla. Lógica pura,
// sin React ni axios, para que la cargue `node --test`.
//
// Las constantes y los mensajes de validarArchivo son los del backend
// (app/modulos/facturacion/config.py y services/adjuntos_service.py). El front
// controla antes de subir para no mandar 10 MB que el backend va a rechazar, y
// porque un 413 de nginx llega en HTML, sin un mensaje que se pueda mostrar.
// El backend controla igual: el contenido (un ".pdf" que por dentro es otra
// cosa) sólo lo ve él.

export const TAMANO_MAXIMO = 10 * 1024 * 1024
export const MAXIMO_POR_COMPROBANTE = 5
// Sin SVG (puede llevar scripts) ni HEIC (el navegador no lo muestra).
export const EXTENSIONES = ['.pdf', '.png', '.jpg', '.jpeg']

const MENSAJE_EXTENSION = 'Sólo se aceptan archivos .pdf, .png, .jpg o .jpeg.'
const MENSAJE_TAMANO =
  `El archivo pesa más de ${TAMANO_MAXIMO / (1024 * 1024)} MB, el máximo por adjunto.`
const MENSAJE_LIMITE =
  `Un comprobante admite hasta ${MAXIMO_POR_COMPROBANTE} adjuntos. Quitá uno para subir otro.`

// La extensión del último punto del último tramo del nombre, en minúsculas,
// o '' si no tiene: la misma lectura que `_extension` del backend.
function extension(nombre) {
  const base = String(nombre ?? '').trim().replace(/\\/g, '/').split('/').pop()
  const punto = base.lastIndexOf('.')
  return punto === -1 ? '' : base.slice(punto).toLowerCase()
}

/**
 * Si el archivo se puede subir a un Comprobante que ya tiene `cantidad`
 * adjuntos: null si sirve, o el mensaje para mostrar. Con varios problemas
 * avisa el primero en el orden del backend (límite, tamaño, extensión), para
 * que el front y el backend digan lo mismo. Exactamente 10 MB sirve.
 */
export function validarArchivo(file, cantidad) {
  if (cantidad >= MAXIMO_POR_COMPROBANTE) return MENSAJE_LIMITE
  if (file?.size > TAMANO_MAXIMO) return MENSAJE_TAMANO
  if (!EXTENSIONES.includes(extension(file?.name))) return MENSAJE_EXTENSION
  return null
}

const MENSAJES_POR_STATUS = {
  403: 'No tenés permiso para esto en los adjuntos. Si lo necesitás, pedíselo a quien administra el sistema.',
  // Cubre los dos 404: el adjunto (o su Comprobante) ya no existe, o la fila
  // existe y el archivo no está en el servidor (`archivo_no_encontrado`).
  404: 'Ese adjunto ya no está. Actualizá la pantalla y, si sigue apareciendo, quitalo y volvé a subirlo.',
  413: MENSAJE_TAMANO,
  503: 'Los adjuntos no están habilitados en este servidor. Avisale a quien administra el sistema.',
}
const MENSAJE_GENERAL = 'No se pudo completar la operación con el adjunto. Probá de nuevo en un rato.'

/**
 * El mensaje para un pedido de adjuntos que falló. Primero el `mensaje` del
 * `detail` del backend, que llega al subir y al quitar y explica el caso (un
 * ".pdf" que por dentro es otra cosa). Si no hay, por el status: la descarga
 * se pide como blob (el JSON del error llega como Blob y no se lee sin
 * esperar), un 413 de nginx llega en HTML y el 404 común trae sólo texto.
 * Nunca usa `error.message`, que en esos casos no dice nada útil. Lee el
 * status como lo deja el interceptor de `src/core/api.js` (`error.status`) o
 * como lo deja axios (`error.response.status`). Sin respuesta (red caída,
 * tiempo agotado) o con cualquier otro status, el mensaje general.
 * Un solo lugar elige el mensaje (plan E2, FB1, "Lo decidido al ejecutarlo").
 */
export function mensajeDeAdjunto(error) {
  const delBackend = error?.detail?.mensaje
  if (typeof delBackend === 'string' && delBackend.trim()) return delBackend
  const status = error?.status ?? error?.response?.status
  return MENSAJES_POR_STATUS[status] ?? MENSAJE_GENERAL
}
