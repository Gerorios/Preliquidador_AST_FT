import { useEffect, useId, useRef } from 'react'
import Icono from '../../../core/ui/iconos'
import { medidaIlegible, textoMedida } from '../vistaResumen'
import {
  claveDeLinea, nombreDeLinea, signoDeDiferencia, textoCubre, textoDiferencia, textoPct,
} from '../detalle'
import Modal from './Modal'
import styles from './ModalRevision.module.css'

// El modal "Marcar revisada" del Detalle (spec de la E3a por grupo, decisión
// 5, con el boceto aprobado el 2026-10-17): el período que cubre la Revisión,
// las líneas (grupo, unidad) que superan el Umbral y el comentario
// obligatorio. Lo que se escribe vive en la página, así cerrar el modal sin
// querer no lo pierde. Mientras guarda, el overlay del núcleo cubre la
// pantalla (es una mutación). Si el backend responde que ya no hay nada que
// revisar (409), el modal lo dice en lugar del formulario y sólo queda
// "Cerrar".

// En el Detalle el cero se muestra ("0"); la raya, sólo para lo vacío o
// ilegible. Igual acá, con los mismos números que la tabla de atrás.
function Medida({ valor }) {
  return medidaIlegible(valor)
    ? <span className={styles.vacia}>—</span>
    : textoMedida(valor, { conCero: true })
}

export default function ModalRevision({
  superan, subtitulo, umbralTexto, periodo, comentario, onComentario, error, guardando,
  conflicto, campoRef, onConfirmar, onCerrar,
}) {
  const idForm = useId()
  const idSuperan = useId()
  const idCampo = useId()
  const idError = useId()
  const idAyuda = useId()
  const cerrarConflicto = useRef(null)

  // El 409 cambia el formulario por el aviso: el foco iba en "Marcar
  // revisada", que desaparece, y pasa a "Cerrar", lo único que queda.
  useEffect(() => {
    if (conflicto) cerrarConflicto.current?.focus()
  }, [conflicto])

  // Mientras guarda no se cierra: ni con Escape, ni con la cruz, ni afuera.
  const cerrar = () => { if (!guardando) onCerrar() }

  const enviar = e => {
    e.preventDefault()
    if (!guardando) onConfirmar()
  }

  const pie = conflicto ? (
    <button ref={cerrarConflicto} type="button" className="btn" onClick={onCerrar}>Cerrar</button>
  ) : (
    <>
      <button type="button" className="btn" onClick={cerrar}>Cancelar</button>
      {/* No se deshabilita mientras guarda, para que no pierda el foco: el
          overlay del núcleo tapa la pantalla y `enviar` no manda dos veces. */}
      <button type="submit" form={idForm} className="btn btn-primary" aria-busy={guardando}>
        {guardando ? 'Guardando…' : 'Marcar revisada'}
      </button>
    </>
  )

  return (
    <Modal titulo="Marcar revisada" subtitulo={subtitulo} onCerrar={cerrar} focoInicial={campoRef} pie={pie}>
      {conflicto ? (
        <div className={styles.conflicto} role="alert">
          <Icono nombre="alerta" size={16} enTexto className={styles.conflictoIcono} />
          <p>{conflicto}</p>
        </div>
      ) : (
        <form id={idForm} className={styles.form} onSubmit={enviar} noValidate>
          <p className={styles.periodo}>{textoCubre(periodo)}</p>

          <section aria-labelledby={idSuperan}>
            <h3 id={idSuperan} className={styles.seccionTitulo}>
              Lo que supera el {umbralTexto ?? 'Umbral'}
            </h3>
            <table className={styles.superan}>
              <thead>
                <tr>
                  <th scope="col">Grupo (Unidad)</th>
                  <th scope="col" className={styles.numero}>Campo</th>
                  <th scope="col" className={styles.numero}>Facturado</th>
                  <th scope="col" className={styles.numero}>Diferencia (Dif. %)</th>
                </tr>
              </thead>
              <tbody>
                {superan.map(l => {
                  const signo = signoDeDiferencia(l.diferencia)
                  return (
                    <tr key={claveDeLinea(l)}>
                      <th scope="row" className={styles.nombre}>{nombreDeLinea(l)}</th>
                      <td className={`mono ${styles.numero}`}><Medida valor={l.campo} /></td>
                      <td className={`mono ${styles.numero}`}><Medida valor={l.facturado} /></td>
                      <td className={`mono ${styles.numero} ${signo ? styles[signo] : ''}`}>
                        {textoDiferencia(l.diferencia)} ({textoPct(l.diferencia_pct)})
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <div className={styles.campo}>
            <label className="field-label" htmlFor={idCampo}>Por qué queda así (obligatorio)</label>
            <textarea
              ref={campoRef}
              id={idCampo}
              className={`input ${styles.comentario} ${error ? styles.conError : ''}`}
              rows={4}
              value={comentario}
              onChange={e => onComentario(e.target.value)}
              placeholder="Por ejemplo: el campo cargó dos veces el parte del 14/10; ya avisé al supervisor."
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${idError} ${idAyuda}` : idAyuda}
              readOnly={guardando}
            />
            {error && <p id={idError} className={styles.error}>{error}</p>}
            <p id={idAyuda} className={styles.ayuda}>Queda guardado quién la marcó y cuándo.</p>
          </div>
        </form>
      )}
    </Modal>
  )
}
