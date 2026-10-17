import { useEffect, useId, useRef } from 'react'
import Icono from '../../../core/ui/iconos'
import styles from './Modal.module.css'

// Lo que puede recibir foco con Tab dentro del diálogo.
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Un diálogo modal de Facturación: el patrón de `ModalDetalle` de
// Preliquidación, copiado porque un módulo no importa a otro (spec de la E3a
// por grupo, sección 8; subirlo al núcleo queda para más adelante). Se cierra
// con Escape, con la cruz o con un click afuera, y al cerrar el foco vuelve a
// lo que lo tenía al abrir.
export default function Modal({ titulo, subtitulo, onCerrar, children }) {
  const idTitulo = useId()
  const cerrarRef = useRef(null)
  const modalRef = useRef(null)
  const onCerrarRef = useRef(onCerrar)

  // El padre pasa una `onCerrar` nueva en cada render: se guarda la última en
  // un ref para que el efecto de abajo corra una sola vez y no vuelva a llevar
  // el foco a "Cerrar" cada vez que el padre se dibuja.
  useEffect(() => { onCerrarRef.current = onCerrar })

  useEffect(() => {
    // Al cerrar, el foco vuelve a lo que lo tenía al abrir (el nombre de la
    // tarea), para que con teclado no se pierda el lugar en la tabla.
    const previo = document.activeElement
    // Foco inicial en "Cerrar", sólo al abrir.
    cerrarRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') { onCerrarRef.current(); return }
      if (e.key !== 'Tab' || !modalRef.current) return
      // Tab y Shift+Tab ciclan dentro del diálogo: aria-modal no impide por sí
      // solo que el foco pase a la página tapada por el overlay.
      const enfocables = [...modalRef.current.querySelectorAll(ENFOCABLES)]
        .filter(el => el.getClientRects().length > 0)
      if (enfocables.length === 0) { e.preventDefault(); return }
      const primero = enfocables[0]
      const ultimo = enfocables[enfocables.length - 1]
      const actual = document.activeElement
      const afuera = !modalRef.current.contains(actual)
      if (e.shiftKey && (actual === primero || afuera)) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && (actual === ultimo || afuera)) { e.preventDefault(); primero.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus()
    }
  }, [])

  return (
    <div className={styles.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
        <header className={styles.cabecera}>
          <div className={styles.encabezado}>
            <h2 id={idTitulo} className={styles.titulo}>{titulo}</h2>
            {subtitulo && <p className={styles.subtitulo}>{subtitulo}</p>}
          </div>
          <button ref={cerrarRef} type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>

        <div className={styles.cuerpo}>{children}</div>
      </div>
    </div>
  )
}
