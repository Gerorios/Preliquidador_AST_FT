// Lógica del Detalle (plan E3, FA4): el % de diferencia, el aviso de arriba
// según el caso, si se puede dejar una Revisión, el comentario y el total de
// los partes. El detalle es el de GET /api/facturacion/resumen/{cliente_id}/{mes}
// (plan E3, sección 3.2, ruta 14). No importa React, para que lo cargue
// `node --test`.
//
// Los textos de los avisos salen del mockup aprobado del Detalle y del boceto
// F0 de la E3a. El permiso llega como un booleano, como en estados.js: quien
// llama pasa `puedeEditar(usuario, 'facturacion', 'resumen')`.

import { textoMes } from './listado.js'
import { sumarDecimales } from './resumen.js'
import { ETIQUETAS } from './unidades.js'

// El largo máximo del comentario de una Revisión: `LARGO_COMENTARIO` del
// backend (app/modulos/facturacion/config.py) y la columna VARCHAR(500).
export const LARGO_COMENTARIO = 500

const DECIMAL = /^-?\d+(?:\.\d+)?$/

// Con un texto, Intl formatea el decimal exacto, sin pasar por un Number (como
// numeros.js). El backend manda el % con dos decimales: se muestran sin volver
// a redondear, con uno como mínimo, como en el mockup ("-8,5 %").
const PCT = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 1, maximumFractionDigits: 2, signDisplay: 'exceptZero',
})
const UMBRAL = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })

/**
 * El % de diferencia de una fila o del TOTAL: "-8,5 %", "+5,04 %", "0,0 %".
 * Una raya si viene null (el campo es 0) o si no es un número.
 */
export function textoPct(pct) {
  const texto = String(pct ?? '').trim()
  if (!DECIMAL.test(texto)) return '—'
  return `${PCT.format(texto)} %`
}

const textoUmbral = umbral =>
  DECIMAL.test(String(umbral ?? '').trim()) ? `${UMBRAL.format(String(umbral).trim())} %` : null

const FECHA = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// `creada_en` llega en UTC y sin zona, como las demás fechas de alta del
// backend (`fechaHora` de components/Adjuntos.jsx): se lee como UTC y se
// muestra el día de la PC, "10/11/2026".
function textoFecha(texto) {
  if (!texto) return ''
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`
  const fecha = new Date(conZona)
  return Number.isNaN(fecha.getTime()) ? texto : FECHA.format(fecha)
}

// "Poda", "Poda y Riego", "Poda, Riego y Raleo".
function enLista(nombres) {
  if (nombres.length <= 1) return nombres.join('')
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`
}

// Una fila se identifica por (tarea, unidad), como lo que guarda la Revisión
// (plan E3, decisión 3).
const clave = t => `${t.tarea_id}|${t.unidad ?? ''}`

const filasDe = detalle => (detalle?.grupos ?? []).flatMap(g => g.tareas ?? [])

// El nombre de una tarea en un aviso. Si en el mes se facturó en dos
// unidades, lleva la unidad, para saber cuál de las dos filas es.
function nombreDeTarea(t, enVariasUnidades) {
  const nombre = t.tarea_nombre || `Tarea ${t.tarea_id}`
  if (!enVariasUnidades.has(t.tarea_id) || !t.unidad) return nombre
  return `${nombre} (${ETIQUETAS[t.unidad] ?? t.unidad})`
}

const cuantasSuperan = n => (n === 1 ? '1 tarea supera' : `${n} tareas superan`)

const SIN_CONTROL = {
  antes_del_corte: mesCorte => ({
    tipo: 'info',
    titulo: 'Este mes no se controla:',
    texto: `es anterior al Mes de corte${mesCorte ? ` (${mesCorte})` : ''}. `
      + 'Los números se ven igual, sin "Supera" ni Revisión.',
  }),
  mes_en_curso: () => ({
    tipo: 'info',
    titulo: 'Mes en curso:',
    texto: 'todavía no se compara lo trabajado con lo facturado. Sólo se controla que cada factura tenga su PDF.',
  }),
}

const TEXTO_SIN_REVISION = 'Tocá una tarea para ver sus partes y consultarlo con el campo. Se cierra sola si se '
  + 'corrige el parte o se carga una nota de crédito o una factura corregida.'

// "Hubo una Revisión el … (quién: “…”) que cubría …. Ahora supera también …":
// la Revisión vigente no cubre todo lo que supera ahora (plan E3, decisión 6).
// Dice "también" sólo si algo de lo que cubría sigue superando. Si no queda
// nada nuevo por nombrar, null, y va el texto sin Revisión.
function textoConRevisionAnterior(revision, superan, enVariasUnidades) {
  const cubiertas = new Set((revision.tareas ?? []).map(clave))
  const nuevas = superan.filter(t => !cubiertas.has(clave(t)))
  if (!nuevas.length) return null
  const siguen = superan.some(t => cubiertas.has(clave(t)))
  const quien = revision.creada_por_nombre ? `${revision.creada_por_nombre}: ` : ''
  const cubria = enLista((revision.tareas ?? []).map(t => nombreDeTarea(t, enVariasUnidades)))
  const ahora = enLista(nuevas.map(t => nombreDeTarea(t, enVariasUnidades)))
  return `Hubo una Revisión el ${textoFecha(revision.creada_en)} (${quien}“${revision.comentario}”) `
    + `que cubría ${cubria}. Ahora supera${siguen ? ' también' : ''} ${ahora}: `
    + 'hace falta revisarlo de nuevo o corregirlo.'
}

/**
 * El aviso de arriba del Detalle, `{ tipo, titulo, texto, deshacer }`, o null
 * si no lleva. `tipo` es la clase del banner ('warn', 'ok' o 'info'), `titulo`
 * va en negrita antes del texto y `deshacer` dice si se muestra "Deshacer".
 * Los cuatro casos del boceto F0:
 * - Antes del corte o Mes en curso: el mes no se controla (info);
 * - Con diferencia con una Revisión vigente que no cubre lo que supera ahora:
 *   cuándo, quién, el comentario, qué cubría y qué supera ahora (warn);
 * - Con diferencia sin Revisión: el texto del mockup (warn);
 * - revisada: quién, cuándo y el comentario, con "Deshacer" sólo con Editar en
 *   Resumen (ok).
 * Facturada sin Revisión, o con una que ya no hace falta, y Pendiente de
 * facturar van sin aviso.
 */
export function bannerDeDetalle(detalle, puedeEditarResumen) {
  if (!detalle) return null
  const estados = detalle.estados ?? []

  for (const [estado, banner] of Object.entries(SIN_CONTROL)) {
    if (estados.includes(estado)) return { ...banner(textoMes(detalle.mes_corte)), deshacer: false }
  }

  const revision = detalle.revision
  if (estados.includes('con_diferencia')) {
    const filas = filasDe(detalle)
    const superan = filas.filter(t => t.supera)
    const enVariasUnidades = new Set(filas.filter(t => t.en_varias_unidades).map(t => t.tarea_id))
    const umbral = textoUmbral(detalle.umbral_pct)
    return {
      tipo: 'warn',
      titulo: `${cuantasSuperan(superan.length)}${umbral ? ` el ${umbral}` : ' el Umbral'}.`,
      texto: (revision && textoConRevisionAnterior(revision, superan, enVariasUnidades)) ?? TEXTO_SIN_REVISION,
      deshacer: false,
    }
  }

  if (detalle.diferencia_revisada && revision) {
    const quien = revision.creada_por_nombre ? `por ${revision.creada_por_nombre} ` : ''
    return {
      tipo: 'ok',
      titulo: 'Revisada',
      texto: `${quien}el ${textoFecha(revision.creada_en)}: “${revision.comentario}”`,
      deshacer: Boolean(puedeEditarResumen),
    }
  }

  return null
}

/**
 * Si va "Marcar revisada": el backend dice que el mes se puede revisar
 * (`se_puede_revisar`) y se puede Editar en Resumen.
 */
export function puedeRevisar(detalle, puedeEditarResumen) {
  return Boolean(detalle?.se_puede_revisar && puedeEditarResumen)
}

/**
 * null si el comentario de una Revisión sirve, o el mensaje para mostrar.
 * Es obligatorio y tiene hasta LARGO_COMENTARIO caracteres, sin contar los
 * espacios de los bordes. Cuenta caracteres como Python y MySQL, no unidades
 * de UTF-16 (un emoji es uno, no dos). El que valida igual es el backend.
 */
export function validarComentario(texto) {
  const limpio = String(texto ?? '').trim()
  if (!limpio) return 'Escribí por qué queda así.'
  if ([...limpio].length > LARGO_COMENTARIO) {
    return `El comentario puede tener hasta ${LARGO_COMENTARIO} caracteres.`
  }
  return null
}

/**
 * La suma de la cantidad de los partes de una fila, como texto decimal y
 * exacta, para el "Total del campo" del panel. Lo que no es un número no
 * suma; sin partes, "0".
 */
export function totalPartes(partes) {
  return sumarDecimales((partes ?? []).map(p => p.cantidad))
}
