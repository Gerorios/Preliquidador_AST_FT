import Icono from '../../../core/ui/iconos'
import { claveDeLinea, nombreDeLinea, signoDeDiferencia, textoDiferencia, textoPct } from '../detalle'
import styles from './PanelRevision.module.css'

// Panel lateral "Marcar revisada" del Detalle (plan E3, FA6; mockup aprobado
// del Detalle): lo que supera el Umbral y un comentario obligatorio. Lo que se
// escribe vive en la página, así cerrar el panel sin querer no lo pierde.
// Mientras guarda, el overlay del núcleo cubre la pantalla (es una mutación).
// Lo que supera son las líneas (grupo, unidad) del Detalle; el modal de la
// Revisión por grupo es del Ticket 3 de la spec de la E3a por grupo.

export default function PanelRevision({
  superan, subtitulo, umbralTexto, comentario, onComentario, error, guardando,
  campoRef, onConfirmar, onCancelar,
}) {
  const vacio = !comentario.trim()

  const enviar = e => {
    e.preventDefault()
    if (!vacio && !guardando) onConfirmar()
  }

  return (
    <aside className={styles.panel} aria-labelledby="fact-panel-revision">
      <form className={styles.form} onSubmit={enviar} noValidate>
        <div className={styles.cabeza}>
          <h2 id="fact-panel-revision" className={styles.nombre}>Marcar revisada</h2>
          <p className={styles.sub}>{subtitulo}</p>
          <button type="button" className={styles.cerrar} aria-label="Cerrar" onClick={onCancelar} disabled={guardando}>
            <Icono nombre="cerrar" size={12} />
          </button>
        </div>

        <div className={styles.cuerpo}>
          <section className={styles.seccion} aria-labelledby="fact-revision-superan">
            <h3 id="fact-revision-superan" className={styles.seccionTitulo}>
              Lo que supera el {umbralTexto ?? 'Umbral'}
            </h3>
            <ul className={styles.lista}>
              {superan.map(l => {
                const signo = signoDeDiferencia(l.diferencia)
                return (
                  <li key={claveDeLinea(l)} className={styles.item}>
                    <span className={styles.itemNombre}>{nombreDeLinea(l)}</span>
                    <span className={`mono ${signo ? styles[signo] : ''}`}>
                      {textoDiferencia(l.diferencia)} ({textoPct(l.diferencia_pct)})
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          <hr className="divider" />

          <section className={styles.seccion}>
            <label className="field-label" htmlFor="fact-revision-comentario">
              Por qué queda así (obligatorio)
            </label>
            <textarea
              ref={campoRef}
              id="fact-revision-comentario"
              className={`input ${styles.comentario} ${error ? styles.conError : ''}`}
              rows={4}
              value={comentario}
              onChange={e => onComentario(e.target.value)}
              placeholder="Por ejemplo: el campo cargó dos veces el parte del 14/10; ya avisé al supervisor."
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'fact-revision-error fact-revision-ayuda' : 'fact-revision-ayuda'}
              readOnly={guardando}
            />
            {error && <p id="fact-revision-error" className={styles.error}>{error}</p>}
            <p id="fact-revision-ayuda" className={styles.ayuda}>Queda guardado quién la marcó y cuándo.</p>
          </section>
        </div>

        <div className={styles.pie}>
          <button type="button" className="btn" onClick={onCancelar} disabled={guardando}>Cancelar</button>
          {/* Mientras guarda no se deshabilita, para que no pierda el foco: el
              overlay del núcleo tapa la pantalla y `enviar` no manda dos veces. */}
          <button type="submit" className="btn btn-primary" disabled={vacio} aria-busy={guardando}>
            {guardando ? 'Guardando…' : 'Marcar revisada'}
          </button>
        </div>
      </form>
    </aside>
  )
}
