import { useIsMutating } from '@tanstack/react-query'
import { ClipLoader } from 'react-spinners'
import styles from './CargandoOverlay.module.css'

/**
 * Cartel grande de "aguardá" que bloquea la pantalla mientras hay una
 * operación de escritura en curso (generar quincena, guardar/editar/borrar
 * concepto, reasignar empresa, aplicar…). Pensado para que sea imposible de
 * no ver y evite que se apriete dos veces. No aparece en fetches de fondo.
 */
export default function CargandoOverlay() {
  const mutando = useIsMutating()
  if (!mutando) return null

  return (
    <div className={styles.backdrop}>
      <div className={styles.card}>
        <ClipLoader color="#6D8B46" size={54} speedMultiplier={0.9} />
        <div className={styles.texto}>Procesando, aguardá un momento…</div>
      </div>
    </div>
  )
}
