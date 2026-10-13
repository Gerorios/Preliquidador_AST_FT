import { useEffect, useMemo, useRef, useState } from 'react'
import { filtrarTareas, normalizar } from '../formulario'
import styles from './SelectorTarea.module.css'

// Autocompletar de la tarea en una fila de la grilla (plan E2, FA6), entre las
// ~135 tareas activas del campo. Es un combobox de teclado, pensado para cargar
// mirando el PDF: se tipea parte del nombre, las flechas recorren la lista y
// Enter o Tab eligen la marcada (Tab además pasa a la unidad, como en una
// planilla). Escape vuelve a lo que había. Si se sale con el mouse sin elegir,
// no adivina: vuelve a la tarea que tenía la fila, salvo que el texto sea
// exactamente el nombre de una.
//
// - `valor`: { tarea_id, tarea_nombre } de la fila. El nombre viene guardado,
//   así se ve también una tarea que ya no está entre las activas.
// - `onElegir(tarea | null)`: null cuando se borra el texto.

export default function SelectorTarea({
  id, tareas, valor, onElegir, invalido, describedBy, etiqueta,
}) {
  // null: no se está tipeando, el campo muestra la tarea de la fila.
  const [texto, setTextoEstado] = useState(null)
  // Copia sincrónica de `texto` para el blur: con Tab, el blur llega justo
  // después de elegir y no tiene que volver a mirar lo que se había tipeado.
  const textoRef = useRef(null)
  const setTexto = (valor) => {
    textoRef.current = valor
    setTextoEstado(valor)
  }
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const listaRef = useRef(null)
  const idLista = `${id}-opciones`

  const opciones = useMemo(
    () => (abierto ? filtrarTareas(tareas, texto ?? '') : []),
    [abierto, tareas, texto],
  )

  // La opción marcada queda a la vista al recorrer con las flechas.
  useEffect(() => {
    if (!abierto) return
    const marcada = listaRef.current?.querySelector('[aria-selected="true"]')
    marcada?.scrollIntoView({ block: 'nearest' })
  }, [abierto, activo])

  // Al abrir, la lista entera queda a la vista aunque la fila esté al fondo.
  useEffect(() => {
    if (abierto) listaRef.current?.scrollIntoView({ block: 'nearest' })
  }, [abierto])

  const elegir = (tarea) => {
    setTexto(null)
    setAbierto(false)
    onElegir(tarea)
  }

  const cerrar = () => {
    setTexto(null)
    setAbierto(false)
  }

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!abierto) { setAbierto(true); setActivo(0); return }
        setActivo(i => Math.min(i + 1, opciones.length - 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActivo(i => Math.max(i - 1, 0))
        return
      case 'Enter':
        // Enter elige y no manda nada: en esta pantalla no hay submit por Enter.
        if (abierto && opciones[activo]) {
          e.preventDefault()
          elegir(opciones[activo])
        }
        return
      case 'Escape':
        if (abierto || texto != null) {
          e.preventDefault()
          cerrar()
        }
        return
      case 'Tab':
        // Sólo si se tipeó: pasar con Tab por una fila ya cargada no la cambia.
        if (abierto && texto != null && texto.trim() && opciones[activo]) {
          elegir(opciones[activo])
        }
        return
      default:
    }
  }

  const onBlur = () => {
    const tipeado = textoRef.current
    if (tipeado == null) { setAbierto(false); return }
    if (!tipeado.trim()) { elegir(null); return }
    const exacta = tareas.find(t => normalizar(t.nombre).trim() === normalizar(tipeado).trim())
    if (exacta) elegir(exacta)
    else cerrar()
  }

  const idActiva = abierto && opciones[activo] ? `${id}-op-${opciones[activo].tarea_id}` : undefined

  return (
    <div className={styles.selector}>
      <input
        id={id}
        className={`input ${styles.campo}`}
        type="text"
        role="combobox"
        aria-label={etiqueta}
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={idLista}
        aria-activedescendant={idActiva}
        aria-invalid={invalido || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        spellCheck={false}
        placeholder="Buscar tarea…"
        value={texto ?? valor.tarea_nombre ?? ''}
        onFocus={e => e.target.select()}
        onChange={e => { setTexto(e.target.value); setAbierto(true); setActivo(0) }}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
      {abierto && (
        <ul ref={listaRef} id={idLista} role="listbox" className={styles.lista} aria-label="Tareas">
          {opciones.length === 0 && (
            <li className={styles.sinResultados} role="presentation">
              Ninguna tarea coincide con «{texto}».
            </li>
          )}
          {opciones.map((t, i) => (
            <li
              key={t.tarea_id}
              id={`${id}-op-${t.tarea_id}`}
              role="option"
              aria-selected={i === activo}
              className={`${styles.opcion} ${i === activo ? styles.opcionActiva : ''}`}
              // mousedown sin foco: el campo no pierde el foco antes del click.
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(t)}
            >
              <span className={styles.nombre}>{t.nombre}</span>
              {t.no_facturable && <span className="badge badge-warn">No facturable</span>}
              {t.grupo_tarea && <span className={styles.grupo}>{t.grupo_tarea}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
