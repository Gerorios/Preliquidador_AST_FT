// Filas del Resumen (plan E3, FA3): lo que necesita la barra común del núcleo
// (FiltrosBar) para filtrar, el número de cada cuadro de Alertas y la fila
// TOTAL. Las filas son las de GET /api/facturacion/resumen (plan E3, sección
// 3.2, ruta 13). No importa React, para que lo cargue `node --test`.
//
// Una fila puede tener varios estados (Con diferencia y Falta comprobante),
// pero la barra lee un solo valor por campo (`fila[campo.field]`). Para que
// las opciones en cascada del núcleo salgan bien sin tocar el núcleo, la barra
// recibe `datosParaFiltros`: cada fila repetida una vez por estado, con la
// etiqueta de ese estado en `estado_texto`. La tabla, los cuadros y el TOTAL
// usan las filas sin repetir.

import { ESTADOS } from './estados.js'
import { textoMes, delMesMasNuevo } from './listado.js'

// Las opciones de Estado van por urgencia, como en el mockup aprobado; una
// etiqueta que no es de ESTADOS va al final.
const ordenDeEtiqueta = etiqueta =>
  Object.values(ESTADOS).find(e => e.etiqueta === etiqueta)?.orden ?? Infinity
const deLaMasUrgente = (a, b) => ordenDeEtiqueta(a) - ordenDeEtiqueta(b)

export const CAMPOS_RESUMEN = [
  { key: 'mes', label: 'Mes', field: 'mes_texto', orden: delMesMasNuevo },
  { key: 'cliente', label: 'Cliente', field: 'cliente_nombre' },
  { key: 'estado', label: 'Estado', field: 'estado_texto', orden: deLaMasUrgente },
]

// Los estados que son Alerta, cada uno con su cuadro. Cada cuadro cuenta
// filas (mes y Cliente) y cada Alerta por separado (plan E3, premisa 6).
const CLAVES_ALERTA = ['pendiente_de_facturar', 'con_diferencia', 'falta_comprobante']

// Las medidas del campo y el neto, como texto decimal; el neto, con signo.
const MEDIDAS = ['horas_peon', 'horas_tractor', 'tancadas', 'plantas', 'hectareas', 'facturado_neto']

/**
 * La fila de la API con los textos que usan la barra y la tabla:
 * `mes_texto` ("sep 2026"), `estados_texto` (las etiquetas, de la más urgente
 * a la menos; una clave que no es de ESTADOS no lleva) y `nota` ("Diferencia
 * revisada" si llega `diferencia_revisada`, si no null).
 */
export function filaDelResumen(f) {
  const conocidos = (f.estados ?? []).filter(clave => Object.hasOwn(ESTADOS, clave))
  conocidos.sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)
  return {
    ...f,
    mes_texto: textoMes(f.mes),
    estados_texto: conocidos.map(clave => ESTADOS[clave].etiqueta),
    nota: f.diferencia_revisada ? 'Diferencia revisada' : null,
  }
}

/**
 * Las filas (ya pasadas por filaDelResumen) para `datos` de la barra: cada una
 * repetida una vez por estado, con su etiqueta en `estado_texto`. Una fila sin
 * estados conocidos va una vez, sin Estado, para que igual ofrezca su Mes y su
 * Cliente.
 */
export function datosParaFiltros(filas) {
  return filas.flatMap(f => (f.estados_texto.length
    ? f.estados_texto.map(estado_texto => ({ ...f, estado_texto }))
    : [{ ...f, estado_texto: null }]))
}

const elegidos = (filtros, key) => filtros[key]?.length ? filtros[key] : null

// Mes y Cliente: lo que cuentan los cuadros.
function pasaMesYCliente(f, filtros) {
  const meses = elegidos(filtros, 'mes')
  const clientes = elegidos(filtros, 'cliente')
  if (meses && !meses.includes(f.mes_texto)) return false
  if (clientes && !clientes.includes(f.cliente_nombre)) return false
  return true
}

/**
 * Las filas (ya pasadas por filaDelResumen) que quedan con los filtros de la
 * barra, en el orden en que vinieron: Mes y Cliente; Estado, si alguno de sus
 * estados está elegido; y la Alerta que fija un cuadro (`filtros.alerta`, una
 * clave de estado), si la fila tiene ese estado.
 */
export function filtrarResumen(filas, filtros) {
  const estados = elegidos(filtros, 'estado')
  return filas.filter(f => {
    if (!pasaMesYCliente(f, filtros)) return false
    if (estados && !f.estados_texto.some(e => estados.includes(e))) return false
    if (filtros.alerta && !(f.estados ?? []).includes(filtros.alerta)) return false
    return true
  })
}

/**
 * El número de cada cuadro: `{ pendiente_de_facturar, con_diferencia,
 * falta_comprobante }`, cuántas filas (mes y Cliente) tienen ese estado. Aplica
 * el Mes y el Cliente, pero no el Estado ni la Alerta, así el número del
 * cuadro no cambia al tocarlo.
 */
export function contarAlertas(filas, filtros) {
  const cuenta = Object.fromEntries(CLAVES_ALERTA.map(clave => [clave, 0]))
  for (const f of filas) {
    if (!pasaMesYCliente(f, filtros)) continue
    for (const clave of CLAVES_ALERTA) {
      if ((f.estados ?? []).includes(clave)) cuenta[clave] += 1
    }
  }
  return cuenta
}

// ─── Suma exacta de decimales en texto ──────────────────────────────────────
// Como en numeros.js: los números viajan como texto y no pasan por un Number,
// que pierde centavos y suma 0.1 + 0.2 como 0.30000000000000004.

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/

// "120.50" → { valor: 12050n, escala: 2 }; lo que no es un decimal, null.
function aEscalado(texto) {
  const partes = DECIMAL.exec(String(texto ?? '').trim())
  if (!partes) return null
  const [, signo, enteros, decimales = ''] = partes
  const valor = BigInt(enteros + decimales)
  return { valor: signo ? -valor : valor, escala: decimales.length }
}

// Suma los textos con la escala más larga de los que suma ("0.25" + "120.5"
// da "120.75"). Lo que no es un decimal no suma; sin nada, "0". La usa
// también el total de los partes del Detalle (detalle.js, plan E3, FA4).
export function sumarDecimales(textos) {
  const numeros = textos.map(aEscalado).filter(Boolean)
  const escala = Math.max(0, ...numeros.map(n => n.escala))
  let total = 0n
  for (const n of numeros) total += n.valor * 10n ** BigInt(escala - n.escala)

  const negativo = total < 0n
  const digitos = (negativo ? -total : total).toString().padStart(escala + 1, '0')
  const enteros = digitos.slice(0, digitos.length - escala)
  const decimales = escala ? `.${digitos.slice(-escala)}` : ''
  return `${negativo ? '-' : ''}${enteros}${decimales}`
}

/**
 * La fila TOTAL de las filas que recibe (las que quedan con los filtros):
 * `cantidad` de filas y la suma de cada medida y del neto, como texto
 * decimal. El neto viene con signo, así una Nota de crédito resta.
 */
export function totales(filas) {
  const total = { cantidad: filas.length }
  for (const medida of MEDIDAS) total[medida] = sumarDecimales(filas.map(f => f[medida]))
  return total
}
