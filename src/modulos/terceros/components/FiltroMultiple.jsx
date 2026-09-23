import { useEffect, useMemo, useRef, useState } from 'react'
import { comoEntero } from '../formato'
import styles from './FiltroMultiple.module.css'

// Un filtro de varios valores, con casillas.
//
// Un <select> común deja elegir uno solo, y el liquidador casi nunca quiere
// uno: quiere "estos tres clientes" o "todo menos Citromax". Con un select eso
// son tres pasadas mirando la misma tabla.
//
// Nada elegido significa **todos**, no ninguno. Es la lectura natural de un
// filtro recién abierto, y evita el estado absurdo de una pantalla vacía
// porque alguien destildó todo sin querer.
//
// valores: array de strings. seleccion: Set. onCambiar: recibe el Set nuevo.

export default function FiltroMultiple({ label, valores, seleccion, onCambiar, etiqueta }) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const caja = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const afuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false) }
    const escape = (e) => { if (e.key === 'Escape') setAbierto(false) }
    document.addEventListener('mousedown', afuera)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', afuera)
      document.removeEventListener('keydown', escape)
    }
  }, [abierto])

  const mostrar = (v) => (etiqueta ? etiqueta(v) : v)

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return q ? valores.filter(v => mostrar(v).toLowerCase().includes(q)) : valores
  }, [valores, busqueda])

  const todos = seleccion.size === 0
  const alternar = (v) => {
    const nueva = new Set(seleccion)
    nueva.has(v) ? nueva.delete(v) : nueva.add(v)
    onCambiar(nueva)
  }

  // "Todos" vacía la selección en vez de tildar los valores uno por uno: así,
  // si mañana aparece un cliente nuevo en la quincena, el filtro lo incluye
  // solo en vez de dejarlo afuera sin que nadie lo note.
  const marcarTodos = () => onCambiar(new Set())

  const resumen = todos
    ? `todos (${comoEntero(valores.length)})`
    : seleccion.size === 1
      ? mostrar([...seleccion][0])
      : `${comoEntero(seleccion.size)} de ${comoEntero(valores.length)}`

  return (
    <div className={styles.caja} ref={caja}>
      <button className={`${styles.boton} ${todos ? '' : styles.botonActivo}`}
              onClick={() => setAbierto(a => !a)}>
        <span className={styles.label}>{label}</span>
        <span className={styles.resumen}>{resumen}</span>
        <span className={styles.flecha}>▾</span>
      </button>

      {abierto && (
        <div className={styles.panel}>
          {valores.length > 8 && (
            <input className={`input ${styles.buscar}`} autoFocus
                   placeholder="Buscar…" value={busqueda}
                   onChange={e => setBusqueda(e.target.value)} />
          )}

          <label className={`${styles.opcion} ${styles.opcionTodos}`}>
            <input type="checkbox" checked={todos} onChange={marcarTodos} />
            <span>Todos</span>
            <span className={styles.cuenta}>{comoEntero(valores.length)}</span>
          </label>

          <div className={styles.lista}>
            {visibles.map(v => (
              <label key={v} className={styles.opcion}>
                <input type="checkbox" checked={seleccion.has(v)}
                       onChange={() => alternar(v)} />
                <span>{mostrar(v)}</span>
              </label>
            ))}
            {visibles.length === 0 && (
              <div className={styles.sinNada}>Nada coincide con «{busqueda}»</div>
            )}
          </div>

          {!todos && (
            <button className={styles.limpiarUno} onClick={marcarTodos}>
              Quitar este filtro
            </button>
          )}
        </div>
      )}
    </div>
  )
}
