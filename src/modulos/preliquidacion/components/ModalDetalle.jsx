import { useEffect, useId, useRef } from 'react'
import Icono from '../../../core/ui/iconos'
import styles from './ModalDetalle.module.css'

// Lo que puede recibir foco con Tab dentro del diálogo.
const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Detalle de una persona en Verificación (pedido del usuario: más claro de
// leer que la tarjeta que se desplegaba). Mismo overlay que los diálogos de
// Conceptos; se cierra con Escape, con la cruz o con un click afuera.
// `datos`: pares { label, valor } que resumen el caso arriba del detalle.
export default function ModalDetalle({ titulo, subtitulo, datos = [], onCerrar, children }) {
  const idTitulo = useId()
  const cerrarRef = useRef(null)
  const modalRef = useRef(null)
  const onCerrarRef = useRef(onCerrar)

  // El padre pasa una `onCerrar` nueva en cada render: se guarda la última en
  // un ref para que el efecto de abajo corra una sola vez y no vuelva a llevar
  // el foco a "Cerrar" cada vez que el padre se dibuja.
  useEffect(() => { onCerrarRef.current = onCerrar })

  useEffect(() => {
    // Al cerrar, el foco vuelve a lo que lo tenía al abrir (la fila de la
    // tabla), para que con teclado no se pierda el lugar en la página.
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
          <div>
            <h2 id={idTitulo} className={styles.titulo}>{titulo}</h2>
            {subtitulo && <p className={styles.subtitulo}>{subtitulo}</p>}
          </div>
          <button ref={cerrarRef} type="button" className={styles.cerrar} onClick={onCerrar} aria-label="Cerrar">
            <Icono nombre="cerrar" size={18} />
          </button>
        </header>

        {datos.length > 0 && (
          <dl className={styles.datos}>
            {datos.map(d => (
              <div key={d.label} className={d.destacado ? styles.destacado : undefined}>
                <dt>{d.label}</dt>
                <dd className="mono">{d.valor}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className={styles.cuerpo}>{children}</div>
      </div>
    </div>
  )
}
