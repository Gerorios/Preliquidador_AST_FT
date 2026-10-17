import { useEffect, useRef, useState } from 'react'
import Icono from '../../../core/ui/iconos'
import {
  atajosQueCoinciden, clicEnDia, diaDeHoy, diaElegible, etiquetaDia, hayMesSiguiente, mesDeDia,
  mesVecino, moverDia, semanasDelMes, textoPeriodo, tituloMes,
} from '../calendario'
import { ATAJOS_RESUMEN, topeDelPeriodo } from '../periodo'
import { OTRO_PERIODO, periodoElegido } from '../vistaResumen'
import styles from './SelectorMeses.module.css'

// Período del Resumen (Ticket 4 del plan del período en curso): va primero en
// la barra común, en el lugar de la quincena. El campo muestra el período
// elegido; al abrirlo, un calendario de un mes y, al costado, los atajos.
//
// - Un atajo aplica el filtro y cierra el panel; se guarda `{ atajo: id }`.
// - En el calendario, el primer clic es Desde y el segundo Hasta (si es
//   anterior, se dan vuelta); con el segundo se aplica y se cierra, y se
//   guarda `{ atajo: OTRO_PERIODO, desde, hasta }`.
// - Escape o un clic afuera cierran sin cambiar. Los días después del tope
//   (fin del mes en curso) no se eligen.
//
// `valor`: { atajo, desde?, hasta? }; qué días pide lo dice periodoElegido y
// si el rango es válido, rangoValido (periodo.js). La lógica del rango está
// en calendario.js. El backend manda (422 `fecha_invalida` o `rango_invalido`).

const DIAS_SEMANA = [
  ['Lu', 'lunes'], ['Ma', 'martes'], ['Mi', 'miércoles'], ['Ju', 'jueves'],
  ['Vi', 'viernes'], ['Sá', 'sábado'], ['Do', 'domingo'],
]

// Las flechas del teclado en la grilla: de a un día o de a una semana.
const PASOS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

const primerDia = vista => semanasDelMes(vista).flat().find(Boolean)

export default function SelectorMeses({ valor, onChange, hoy }) {
  const tope = topeDelPeriodo(hoy)
  const textoHoy = diaDeHoy(hoy)
  const elegido = periodoElegido(valor, hoy)

  const [abierto, setAbierto] = useState(false)
  // El rango marcado en el panel: el elegido al abrir y, después del primer
  // clic, sólo Desde.
  const [marcado, setMarcado] = useState(null)
  const [vista, setVista] = useState(() => mesDeDia(textoHoy))
  // El día que recibe el foco en la grilla (un solo día con Tab).
  const [enfocado, setEnfocado] = useState(textoHoy)
  const [altoLibre, setAltoLibre] = useState(0)
  const moverFoco = useRef(false)
  const raiz = useRef(null)
  const campo = useRef(null)
  const grilla = useRef(null)

  const cerrar = ({ foco }) => {
    setAbierto(false)
    if (foco) campo.current?.focus()
  }

  const abrir = () => {
    const inicial = elegido.desde && elegido.hasta ? elegido : null
    let dia = inicial?.hasta ?? textoHoy
    if (!diaElegible(dia, tope)) dia = tope
    setMarcado(inicial)
    setEnfocado(dia)
    setVista(mesDeDia(dia))
    // La pantalla no deja pasar nada del alto de la ventana: el panel no pasa
    // del alto que queda debajo del campo (4 de separación y 10 de aire).
    const abajo = campo.current?.getBoundingClientRect().bottom ?? 0
    setAltoLibre(Math.max(window.innerHeight - abajo - 14, 0))
    moverFoco.current = true
    setAbierto(true)
  }

  // Un clic afuera cierra sin cambiar.
  useEffect(() => {
    if (!abierto) return undefined
    const afuera = e => {
      if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', afuera)
    return () => document.removeEventListener('mousedown', afuera)
  }, [abierto])

  // Al abrir y con las flechas, el foco va al día marcado.
  useEffect(() => {
    if (!abierto || !moverFoco.current) return
    moverFoco.current = false
    grilla.current?.querySelector(`[data-dia="${enfocado}"]`)?.focus()
  }, [abierto, enfocado, vista])

  const elegirAtajo = id => {
    onChange({ atajo: id })
    cerrar({ foco: true })
  }

  const elegirDia = dia => {
    const nuevo = clicEnDia(marcado, dia, tope)
    if (nuevo?.hasta) {
      onChange({ atajo: OTRO_PERIODO, desde: nuevo.desde, hasta: nuevo.hasta })
      cerrar({ foco: true })
      return
    }
    setMarcado(nuevo)
    setEnfocado(dia)
  }

  const irAMes = delta => {
    const v = mesVecino(vista, delta)
    // En el mes del tope, "Mes siguiente" queda deshabilitado con el foco
    // puesto y el foco caería al body: va al día 1.
    if (!hayMesSiguiente(v, tope)) moverFoco.current = true
    setVista(v)
    setEnfocado(primerDia(v))
  }

  const teclaEnDia = e => {
    const paso = PASOS[e.key]
    if (!paso) return
    e.preventDefault()
    const dia = moverDia(enfocado, paso)
    if (!diaElegible(dia, tope)) return
    moverFoco.current = true
    setEnfocado(dia)
    setVista(mesDeDia(dia))
  }

  const teclaEnSelector = e => {
    if (!abierto || e.key !== 'Escape') return
    e.stopPropagation()
    cerrar({ foco: true })
  }

  // Si el foco sale del selector con Tab, se cierra sin cambiar.
  const salioElFoco = e => {
    if (abierto && e.relatedTarget && !raiz.current?.contains(e.relatedTarget)) setAbierto(false)
  }

  const desde = marcado?.desde ?? null
  const hasta = marcado?.hasta ?? null
  const coinciden = desde && hasta ? atajosQueCoinciden(desde, hasta, hoy) : []
  const texto = textoPeriodo(elegido.desde, elegido.hasta)

  const claseDia = dia => {
    const extremo = dia === desde || dia === hasta
    const enRango = desde && hasta && dia > desde && dia < hasta
    return [
      styles.dia,
      extremo && styles.extremo,
      enRango && styles.enRango,
      dia === textoHoy && styles.hoy,
    ].filter(Boolean).join(' ')
  }

  const etiqueta = dia => [
    etiquetaDia(dia),
    dia === textoHoy && 'hoy',
    dia === desde && 'desde',
    dia === hasta && 'hasta',
  ].filter(Boolean).join(', ')

  return (
    <div className={styles.periodo} ref={raiz} onBlur={salioElFoco} onKeyDown={teclaEnSelector}>
      <button
        ref={campo}
        type="button"
        className={`input ${styles.campo}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label={`Período: ${texto}`}
        onClick={() => (abierto ? cerrar({ foco: false }) : abrir())}
      >
        <span className={styles.fechas}>{texto}</span>
        <Icono nombre="abajo" size={14} className={styles.flechaCampo} />
      </button>

      {abierto && (
        <div
          className={styles.panel}
          role="dialog"
          aria-label="Elegir el período"
          style={{ '--alto-libre': `${altoLibre}px` }}
        >
          <div className={styles.atajos} role="group" aria-label="Atajos">
            {ATAJOS_RESUMEN.map(a => {
              const activo = coinciden.includes(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`btn btn-sm ${styles.atajo} ${activo ? 'btn-primary' : ''}`}
                  aria-pressed={activo}
                  onClick={() => elegirAtajo(a.id)}
                >
                  {a.label}
                </button>
              )
            })}
          </div>

          <div className={styles.calendario}>
            <div className={styles.cabecera}>
              <button
                type="button"
                className={styles.navegar}
                aria-label="Mes anterior"
                onClick={() => irAMes(-1)}
              >
                <Icono nombre="derecha" size={16} className={styles.girar} />
              </button>
              <span className={styles.mes} aria-live="polite">{tituloMes(vista)}</span>
              <button
                type="button"
                className={styles.navegar}
                aria-label="Mes siguiente"
                disabled={!hayMesSiguiente(vista, tope)}
                onClick={() => irAMes(1)}
              >
                <Icono nombre="derecha" size={16} />
              </button>
            </div>

            <table className={styles.grilla} role="grid" aria-label={tituloMes(vista)} ref={grilla}>
              <thead>
                <tr>
                  {DIAS_SEMANA.map(([corto, largo]) => (
                    <th key={corto} scope="col" abbr={largo}>
                      <span aria-hidden="true">{corto}</span>
                      <span className={styles.soloLector}>{largo}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semanasDelMes(vista).map(semana => (
                  <tr key={semana.find(Boolean)}>
                    {semana.map((dia, i) => (
                      <td
                        key={dia ?? `hueco-${i}`}
                        role="gridcell"
                        aria-selected={dia ? Boolean(desde && dia >= desde && dia <= (hasta ?? desde)) : undefined}
                      >
                        {dia && (
                          <button
                            type="button"
                            className={claseDia(dia)}
                            data-dia={dia}
                            tabIndex={dia === enfocado ? 0 : -1}
                            disabled={!diaElegible(dia, tope)}
                            aria-label={etiqueta(dia)}
                            onClick={() => elegirDia(dia)}
                            onKeyDown={teclaEnDia}
                          >
                            {Number(dia.slice(8))}
                          </button>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <p className={styles.ayuda} aria-live="polite">
              {desde && !hasta ? 'Ahora elegí el día Hasta.' : 'Elegí el día Desde y después el Hasta.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
