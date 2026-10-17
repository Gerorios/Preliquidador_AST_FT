import Icono from '../../../core/ui/iconos'
import styles from './AvisoFueraDelFiltro.module.css'

// Aviso de lo que no entra en el filtro, en el bloque de una fila del Resumen
// (Ticket 4 de la spec de la E3a por grupo, decisión 7; texto del boceto
// aprobado). Una Línea que cae en parte afuera del filtro no se compara: el
// aviso nombra sus Comprobantes con el período que cubren y el botón pasa el
// filtro a ese período. No es una Alerta: no suma en los cuadros. El texto lo
// arma avisoFueraDelFiltro (fueraDelFiltro.js); sin aviso, no aparece.

export default function AvisoFueraDelFiltro({ aviso, onVer }) {
  if (!aviso) return null
  return (
    <div className={styles.aviso} role="note">
      <Icono nombre="filtro" size={14} enTexto className={styles.icono} />
      <div className={styles.cuerpo}>
        <strong>{aviso.titulo}</strong>
        {aviso.comprobantes.length > 0 && (
          <ul className={styles.lista}>
            {aviso.comprobantes.map(texto => <li key={texto}>{texto}</li>)}
          </ul>
        )}
        <p>{aviso.texto}</p>
      </div>
      <button
        type="button"
        className={`btn btn-sm ${styles.boton}`}
        onClick={() => onVer({ desde: aviso.boton.desde, hasta: aviso.boton.hasta })}
      >
        {aviso.boton.texto}
      </button>
    </div>
  )
}
