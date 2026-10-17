// Lógica del Detalle (plan E3, FA4): el % de diferencia, el aviso de arriba
// según el caso, si se puede dejar una Revisión, el comentario y el total de
// los partes. El detalle es el de GET /api/facturacion/resumen/{cliente_id}/{mes}
// (plan E3, sección 3.2, ruta 14). No importa React, para que lo cargue
// `node --test`.
//
// Los textos de los avisos salen del mockup aprobado del Detalle y del boceto
// F0 de la E3a. El permiso llega como un booleano, como en estados.js: quien
// llama pasa `puedeEditar(usuario, 'facturacion', 'resumen')`.

import { textoFecha as textoDia } from './formulario.js'
import { textoMes } from './listado.js'
import { formatoPesos } from './numeros.js'
import { sumarDecimales } from './resumen.js'
import { textoUnidad } from './vistaResumen.js'

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

// Una fila del Detalle es una línea (grupo de tareas, unidad), como lo que
// guarda la Revisión (spec de la E3a por grupo). Sin unidad, el grupo solo.
const clave = l => `${l.grupo}|${l.unidad ?? ''}`

/** La clave de una fila del Detalle, (grupo, unidad): "Manuales|horas_peon". */
export const claveDeLinea = clave

const lineasDe = detalle => detalle?.grupos ?? []

/** Una línea en un aviso: "Manuales (Horas de peón)", "Sin grupo (Sin Unidad sugerida)". */
export const nombreDeLinea = l => `${l.grupo} (${textoUnidad(l.unidad)})`

const cuantasSuperan = n => (n === 1 ? '1 línea supera' : `${n} líneas superan`)

const SIN_CONTROL = {
  antes_del_corte: mesCorte => ({
    tipo: 'info',
    titulo: 'Este mes no se controla:',
    texto: `es anterior al Mes de corte${mesCorte ? ` (${mesCorte})` : ''}. `
      + 'Los números se ven igual, sin "Supera" ni Revisión.',
  }),
}

const TEXTO_SIN_REVISION = 'Abrí un grupo y tocá una tarea para ver sus partes y consultarlo con el campo. '
  + 'Se cierra sola si se corrige el parte o se carga una nota de crédito o una factura corregida.'

// "Hubo una Revisión el … (quién: “…”) que cubría …. Ahora supera también …":
// la Revisión vigente no cubre todas las líneas que superan ahora. Dice
// "también" sólo si algo de lo que cubría sigue superando. Si no queda nada
// nuevo por nombrar, null, y va el texto sin Revisión.
function textoConRevisionAnterior(revision, superan) {
  const cubiertas = new Set((revision.grupos ?? []).map(clave))
  const nuevas = superan.filter(l => !cubiertas.has(clave(l)))
  if (!nuevas.length) return null
  const siguen = superan.some(l => cubiertas.has(clave(l)))
  const quien = revision.creada_por_nombre ? `${revision.creada_por_nombre}: ` : ''
  const cubria = enLista((revision.grupos ?? []).map(nombreDeLinea))
  const ahora = enLista(nuevas.map(nombreDeLinea))
  return `Hubo una Revisión el ${textoFecha(revision.creada_en)} (${quien}“${revision.comentario}”) `
    + `que cubría ${cubria}. Ahora supera${siguen ? ' también' : ''} ${ahora}: `
    + 'hace falta revisarlo de nuevo o corregirlo.'
}

/**
 * El aviso de arriba del Detalle, `{ tipo, titulo, texto, deshacer }`, o null
 * si no lleva. `tipo` es la clase del banner ('warn', 'ok' o 'info'), `titulo`
 * va en negrita antes del texto y `deshacer` dice si se muestra "Deshacer".
 * Los cuatro casos del boceto F0:
 * - Antes del corte: el mes no se controla (info);
 * - Con diferencia con una Revisión vigente que no cubre lo que supera ahora:
 *   cuándo, quién, el comentario, qué cubría y qué supera ahora (warn);
 * - Con diferencia sin Revisión: el texto del mockup (warn);
 * - revisada: el período que cubre, quién, cuándo y el comentario, con
 *   "Deshacer" sólo con Editar en Resumen (ok).
 * Facturada sin Revisión, o con una que ya no hace falta, y Pendiente de
 * facturar van sin aviso. Que el período no terminó lo dice aparte
 * avisoEnCurso, sin pisar este aviso.
 */
export function bannerDeDetalle(detalle, puedeEditarResumen) {
  if (!detalle) return null
  const estados = detalle.estados ?? []

  for (const [estado, banner] of Object.entries(SIN_CONTROL)) {
    if (estados.includes(estado)) return { ...banner(textoMes(detalle.mes_corte)), deshacer: false }
  }

  const revision = detalle.revision
  if (estados.includes('con_diferencia')) {
    const superan = lineasQueSuperan(detalle)
    const umbral = textoUmbral(detalle.umbral_pct)
    return {
      tipo: 'warn',
      titulo: `${cuantasSuperan(superan.length)}${umbral ? ` el ${umbral}` : ' el Umbral'}.`,
      texto: (revision && textoConRevisionAnterior(revision, superan)) ?? TEXTO_SIN_REVISION,
      deshacer: false,
    }
  }

  if (detalle.diferencia_revisada && revision) {
    const periodo = textoPeriodo(revision)
    const quien = revision.creada_por_nombre ? `por ${revision.creada_por_nombre} ` : ''
    return {
      tipo: 'ok',
      titulo: 'Revisada',
      texto: `${periodo ? `${periodo}, ` : ''}${quien}el ${textoFecha(revision.creada_en)}: “${revision.comentario}”`,
      deshacer: Boolean(puedeEditarResumen),
    }
  }

  return null
}

/**
 * La línea de arriba del Detalle cuando el período todavía no terminó
 * (`en_curso` del backend), `{ titulo, texto }`, o null. Va aparte del aviso
 * de bannerDeDetalle: un período en curso se controla igual, y esto sólo
 * avisa que el campo puede sumar partes hasta el Hasta del período, como
 * "31/10/2026" (plan del 2026-10-17, decisión 2).
 */
export function avisoEnCurso(detalle) {
  if (detalle?.en_curso !== true) return null
  const hasta = textoDia(periodoARevisar(detalle)?.hasta)
  return {
    titulo: 'Período en curso:',
    texto: `el campo todavía puede sumar partes${hasta ? ` hasta el ${hasta}` : ''}.`,
  }
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
 * La suma de la cantidad de los partes de una tarea, como texto decimal y
 * exacta, para el "Total del campo" del modal de partes. Lo que no es un
 * número no suma; sin partes, "0".
 */
export function totalPartes(partes) {
  return sumarDecimales((partes ?? []).map(p => p.cantidad))
}

// ─── Lo que usa la pantalla del Detalle (FA6 y Ticket 2) ────────────────────

/** Las líneas (grupo, unidad) que superan el Umbral, en su orden. */
export function lineasQueSuperan(detalle) {
  return lineasDe(detalle).filter(l => l.supera)
}

/**
 * Si la línea lleva la etiqueta "Revisada" junto a "Supera" (boceto F0):
 * supera y la Revisión vigente la cubre, por (grupo, unidad).
 */
export function revisadaEnLinea(linea, revision) {
  if (!linea?.supera || !revision) return false
  return (revision.grupos ?? []).some(l => clave(l) === clave(linea))
}

/**
 * Las líneas abiertas del Detalle, con la de `claveLinea` abierta si estaba
 * cerrada o cerrada si estaba abierta. Devuelve un Set nuevo, para el estado de
 * React; el de antes queda igual.
 */
export function alternarAbierta(abiertas, claveLinea) {
  const nuevas = new Set(abiertas)
  if (nuevas.has(claveLinea)) nuevas.delete(claveLinea)
  else nuevas.add(claveLinea)
  return nuevas
}

const DIFERENCIA = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2, signDisplay: 'exceptZero' })

const esCero = texto => /^-?0+(\.0+)?$/.test(texto)

/**
 * La Diferencia de una fila, en su unidad y con signo: "-52", "+42,5". Cero
 * va sin signo; null (sin campo) o lo que no es un número, una raya.
 */
export function textoDiferencia(valor) {
  const texto = String(valor ?? '').trim()
  if (!DECIMAL.test(texto)) return '—'
  return DIFERENCIA.format(esCero(texto) ? '0' : texto)
}

/**
 * Para el tono de una Diferencia: 'menos' (se facturó menos de lo trabajado),
 * 'mas' o null (cero, sin dato o lo que no es un número). El signo del texto
 * ya lo dice; el color acompaña.
 */
export function signoDeDiferencia(valor) {
  const texto = String(valor ?? '').trim()
  if (!DECIMAL.test(texto) || esCero(texto)) return null
  return texto.startsWith('-') ? 'menos' : 'mas'
}

/**
 * La Diferencia del TOTAL en pesos, con signo: "+$ 300,00", "-$ 1.234,50".
 * Cero va sin signo; sin valor, una raya.
 */
export function textoDiferenciaPesos(valor) {
  const texto = String(valor ?? '').trim()
  if (!DECIMAL.test(texto)) return '—'
  const pesos = formatoPesos(texto)
  return texto.startsWith('-') || esCero(texto) ? pesos : `+${pesos}`
}

const TIPOS = { factura: 'Factura', nota_credito: 'Nota de crédito' }

/** Un Comprobante del mes en la barra: "Factura 0003-00001231". */
export function textoComprobante(c) {
  return `${TIPOS[c.tipo] ?? c.tipo} ${c.numero || 'sin número'}`
}

const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** "2026-10" a "octubre 2026", para el título. Lo que no es un mes, como vino. */
export function textoMesLargo(mes) {
  const partes = /^(\d{4})-(\d{2})$/.exec(mes ?? '')
  const nombre = partes && MESES_LARGOS[Number(partes[2]) - 1]
  return nombre ? `${nombre} ${partes[1]}` : mes
}

// ─── La Revisión por grupo, en su modal (Ticket 3) ──────────────────────────

const MES = /^(\d{4})-(\d{2})$/
const DIA = /^(\d{4})-(\d{2})-(\d{2})$/
const dosCifras = n => String(n).padStart(2, '0')

// El mes entero de "AAAA-MM", `{ desde, hasta }` del 1 al último día, o null.
function mesEntero(mes) {
  const partes = MES.exec(mes ?? '')
  const numero = partes && Number(partes[2])
  if (!numero || numero > 12) return null
  // El día 0 del mes siguiente es el último de este.
  const ultimo = new Date(Date.UTC(Number(partes[1]), numero, 0)).getUTCDate()
  return { desde: `${partes[1]}-${partes[2]}-01`, hasta: `${partes[1]}-${partes[2]}-${dosCifras(ultimo)}` }
}

/**
 * El período del Detalle, que es el que guarda la Revisión: `{ desde, hasta }`
 * como "AAAA-MM-DD", el filtro del Resumen recortado al mes como lo devuelve
 * el backend (Ticket 4 de la spec de la E3a por grupo). Si el detalle no los
 * trae, el mes entero, del 1 al último día. null si el mes no se lee.
 */
export function periodoARevisar(detalle) {
  const entero = mesEntero(detalle?.mes)
  if (!entero) return null
  const { desde, hasta } = detalle
  return DIA.test(desde ?? '') && DIA.test(hasta ?? '') ? { desde, hasta } : entero
}

/** Si un período `{ desde, hasta }` es un mes entero, del 1 al último día. */
export function esMesEntero(periodo) {
  const entero = mesEntero(periodo?.desde?.slice(0, 7))
  return Boolean(entero && entero.desde === periodo.desde && entero.hasta === periodo.hasta)
}

/** El nombre del mes de un día "AAAA-MM-DD", "julio"; si no se lee, vacío. */
export function nombreDelMes(dia) {
  return leerDia(dia)?.mes ?? ''
}

// "2026-10-05" a { dia: 5, mes: 'octubre', anio: '2026' }, o null.
function leerDia(texto) {
  const partes = DIA.exec(texto ?? '')
  const mes = partes && MESES_LARGOS[Number(partes[2]) - 1]
  const dia = partes && Number(partes[3])
  return mes && dia >= 1 && dia <= 31 ? { dia, mes, anio: partes[1] } : null
}

/**
 * Un período `{ desde, hasta }` en palabras: "del 1 al 31 de octubre", "del 1
 * al 15 de octubre"; si cruza de mes, "del 30 de septiembre al 2 de octubre".
 * Sin período o con fechas que no se leen, vacío.
 */
export function textoPeriodo(periodo) {
  const desde = leerDia(periodo?.desde)
  const hasta = leerDia(periodo?.hasta)
  if (!desde || !hasta) return ''
  const mismoMes = desde.mes === hasta.mes && desde.anio === hasta.anio
  return mismoMes
    ? `del ${desde.dia} al ${hasta.dia} de ${hasta.mes}`
    : `del ${desde.dia} de ${desde.mes} al ${hasta.dia} de ${hasta.mes}`
}

/** La franja del modal "Marcar revisada": qué período cubre la Revisión. */
export function textoCubre(periodo) {
  return `Cubre ${textoPeriodo(periodo)}. Si después supera otro grupo, el mes vuelve a Con diferencia.`
}

/**
 * El aviso del modal cuando el backend responde 409 `no_revisable`: entre que
 * se abrió y se guardó, ya no supera ningún grupo en el período.
 */
export function textoNoRevisable(periodo) {
  return `No hace falta revisarla. En el período ${textoPeriodo(periodo)} ya no hay grupos `
    + 'que superen el Umbral. El Detalle se actualizó.'
}

/** Si el error de dejar una Revisión es el 409 `no_revisable`. */
export function esNoRevisable(error) {
  return error?.status === 409 && error?.detail?.tipo === 'no_revisable'
}
