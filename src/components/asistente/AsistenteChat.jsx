import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { consultarAsistente } from '../../services/preliquidacion'
import styles from './AsistenteChat.module.css'

// Mapea la ruta actual al nombre de pantalla que entiende el asistente.
function pantallaActual(pathname) {
  if (pathname.startsWith('/revision')) return 'Revisión de una quincena'
  const map = {
    '/dashboard': 'Inicio (generar quincenas)',
    '/conceptos': 'Conceptos y Precios',
    '/verificacion': 'Verificación (controles)',
    '/categorias-operarios': 'Mantenimiento (categorías de operario)',
  }
  return map[pathname] || null
}

const SALUDO = {
  rol: 'assistant',
  contenido:
    '¡Hola! Soy la ayuda del sistema. Puedo explicarte cómo cargar precios, generar una ' +
    'quincena, revisar líneas, exportar a Excel y demás. Contame qué necesitás hacer.',
}

export default function AsistenteChat() {
  const location = useLocation()
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState([SALUDO])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef(null)
  const inputRef = useRef(null)

  // Autoscroll al último mensaje.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando])

  // Foco en el input al abrir.
  useEffect(() => {
    if (abierto) inputRef.current?.focus()
  }, [abierto])

  const enviar = async () => {
    const pregunta = input.trim()
    if (!pregunta || cargando) return

    const historial = mensajes.map(({ rol, contenido }) => ({ rol, contenido }))
    setMensajes((prev) => [...prev, { rol: 'user', contenido: pregunta }])
    setInput('')
    setCargando(true)

    try {
      const { respuesta } = await consultarAsistente({
        pregunta,
        historial,
        pantalla: pantallaActual(location.pathname),
      })
      setMensajes((prev) => [...prev, { rol: 'assistant', contenido: respuesta }])
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          rol: 'assistant',
          contenido:
            'Uy, no pude responder ahora mismo (' +
            (err?.message || 'error') +
            '). Probá de nuevo en un momento.',
          error: true,
        },
      ])
    } finally {
      setCargando(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <>
      {!abierto && (
        <button
          className={styles.fab}
          onClick={() => setAbierto(true)}
          title="Ayuda del sistema"
          aria-label="Abrir la ayuda del sistema"
        >
          <span className={styles.fabIcon}>💬</span>
          <span className={styles.fabLabel}>Ayuda</span>
        </button>
      )}

      {abierto && (
        <div className={styles.panel} role="dialog" aria-label="Asistente de ayuda">
          <header className={styles.header}>
            <div>
              <div className={styles.title}>Ayuda del sistema</div>
              <div className={styles.subtitle}>Te explico cómo usarlo</div>
            </div>
            <button
              className={styles.cerrar}
              onClick={() => setAbierto(false)}
              title="Cerrar"
              aria-label="Cerrar la ayuda"
            >
              ✕
            </button>
          </header>

          <div className={styles.mensajes}>
            {mensajes.map((m, i) => (
              <div
                key={i}
                className={`${styles.burbuja} ${
                  m.rol === 'user' ? styles.burbujaUser : styles.burbujaBot
                } ${m.error ? styles.burbujaError : ''}`}
              >
                {m.contenido}
              </div>
            ))}
            {cargando && (
              <div className={`${styles.burbuja} ${styles.burbujaBot}`}>
                <span className={styles.escribiendo}>
                  <span></span><span></span><span></span>
                </span>
              </div>
            )}
            <div ref={finRef} />
          </div>

          <div className={styles.aviso}>
            Ayuda de uso — no accede a datos reales. Verificá siempre los números en el sistema.
          </div>

          <form
            className={styles.entrada}
            onSubmit={(e) => {
              e.preventDefault()
              enviar()
            }}
          >
            <textarea
              ref={inputRef}
              className={styles.textarea}
              placeholder="Escribí tu duda..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
            />
            <button
              type="submit"
              className={`btn btn-primary btn-sm ${styles.enviarBtn}`}
              disabled={!input.trim() || cargando}
            >
              Enviar
            </button>
          </form>
        </div>
      )}
    </>
  )
}
