import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import styles from './ActivityBar.module.css'

/**
 * Indicador global de actividad. Aparece automáticamente siempre que haya
 * cualquier operación en vuelo (mutación o fetch), sin que cada pantalla
 * tenga que cablear su propio spinner. "Guardando…" para escrituras
 * (generar, guardar/editar/borrar concepto, reasignar…), "Cargando…" para
 * lecturas.
 */
export default function ActivityBar() {
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const activo = fetching + mutating > 0

  if (!activo) return null

  const label = mutating > 0 ? 'Guardando…' : 'Cargando…'

  return (
    <>
      <div className={styles.bar} />
      <div className={styles.pill}>
        <span className="spinner" />
        <span>{label}</span>
      </div>
    </>
  )
}
