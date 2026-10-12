import { useEffect } from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { ClipLoader } from 'react-spinners'
import { debeTragar } from '../bloqueoTeclado'
import styles from './CargandoOverlay.module.css'

const EVENTOS = ['keydown', 'keypress', 'keyup']

/**
 * Cartel grande de "aguardá" que bloquea la pantalla mientras hay una
 * operación de escritura en curso (generar quincena, guardar/editar/borrar
 * concepto, reasignar empresa, aplicar…). Pensado para que sea imposible de
 * no ver y evite que se apriete dos veces. No aparece en fetches de fondo.
 *
 * Bloquea también el teclado (ver bloqueoTeclado.js) sin mover el foco: así,
 * al terminar, cada pantalla deja el foco donde lo pone después de guardar.
 * La región `status` existe siempre, para que el lector de pantalla anuncie el
 * cartel cuando aparece.
 */
export default function CargandoOverlay() {
  const mutando = useIsMutating() > 0

  useEffect(() => {
    if (!mutando) return undefined
    const tragar = (e) => {
      if (!debeTragar(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    EVENTOS.forEach((tipo) => window.addEventListener(tipo, tragar, true))
    return () => EVENTOS.forEach((tipo) => window.removeEventListener(tipo, tragar, true))
  }, [mutando])

  return (
    <div role="status" aria-live="polite">
      {mutando && (
        <div className={styles.backdrop}>
          <div className={styles.card}>
            <span aria-hidden="true">
              <ClipLoader color="#6D8B46" size={54} speedMultiplier={0.9} />
            </span>
            <div className={styles.texto}>Procesando, aguardá un momento…</div>
          </div>
        </div>
      )}
    </div>
  )
}
