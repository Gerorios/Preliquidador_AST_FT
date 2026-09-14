import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarQuincenas } from '../services/terceros'
import useQuincenaStore from '../quincenaStore'

/**
 * Selector de quincena del módulo. La lista viene del backend (calculada por
 * calendario, no de una tabla) y la elección se guarda en el store del módulo,
 * así las cuatro pantallas hablan siempre de la misma quincena.
 *
 * Si todavía no hay ninguna elegida, toma la más reciente apenas llega la lista.
 */
export default function SelectorQuincena() {
  const quincena = useQuincenaStore(s => s.quincena)
  const setQuincena = useQuincenaStore(s => s.setQuincena)

  const { data: quincenas = [] } = useQuery({
    queryKey: ['terceros', 'quincenas'],
    queryFn: () => listarQuincenas(24),
    staleTime: 60 * 60 * 1000,   // el calendario no cambia dentro de una sesión
  })

  useEffect(() => {
    if (!quincena && quincenas.length) setQuincena(quincenas[0].quincena)
  }, [quincena, quincenas, setQuincena])

  return (
    <select
      className="input"
      style={{ width: 210 }}
      value={quincena ?? ''}
      onChange={e => setQuincena(e.target.value)}
      aria-label="Quincena"
    >
      {!quincena && <option value="">Elegir quincena…</option>}
      {quincenas.map(q => (
        <option key={q.quincena} value={q.quincena}>
          {q.etiqueta} — {q.nombre}
        </option>
      ))}
    </select>
  )
}
