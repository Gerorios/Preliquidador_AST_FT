import { textoFecha } from '../formulario'
import { medidaVacia, textoMedida, textoUnidad } from '../vistaResumen'
import { totalPartes } from '../detalle'
import Modal from './Modal'
import styles from './ModalPartes.module.css'

// Los partes del campo de una tarea en el mes (spec de la E3a por grupo,
// decisión 3): fecha, finca, supervisor y cantidad, con el total. Se abre
// desde el nombre de la tarea en el Detalle; no se abre por finca: la finca
// es la de cada parte. La cantidad va en la unidad de la fila.

// Un parte en cero o sin cantidad muestra la raya, como en el panel de antes.
function Medida({ valor }) {
  return medidaVacia(valor) ? <span className={styles.vacia}>—</span> : textoMedida(valor)
}

const partes_ = n => `${n} ${n === 1 ? 'parte' : 'partes'}`

export default function ModalPartes({ tarea, linea, mesTexto, onCerrar }) {
  const partes = tarea.partes ?? []
  const nombre = tarea.tarea_nombre || `Tarea ${tarea.tarea_id}`

  return (
    <Modal
      titulo={nombre}
      subtitulo={`${linea.grupo} · ${textoUnidad(linea.unidad)} · ${mesTexto}`}
      onCerrar={onCerrar}
    >
      <h3 className={styles.titulo}>Partes del campo · {partes_(partes.length)}</h3>
      {partes.length === 0 ? (
        <p className={styles.nada}>No hay partes del campo de esta tarea en el mes.</p>
      ) : (
        <table className={styles.partes}>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Finca</th>
              <th scope="col">Supervisor</th>
              <th scope="col" className={styles.numero}>Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {/* Un parte no trae id, y dos del mismo día, finca y supervisor son
                legítimos. La lista no se reordena. */}
            {partes.map((p, i) => (
              <tr key={i}>
                <td className="mono">{textoFecha(p.fecha) ?? p.fecha}</td>
                <td>{p.donde || '—'}</td>
                <td className={styles.supervisor}>{p.supervisor || '—'}</td>
                <td className={styles.numero}><Medida valor={p.cantidad} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total del campo</td>
              <td className={styles.numero}><Medida valor={totalPartes(partes)} /></td>
            </tr>
          </tfoot>
        </table>
      )}
    </Modal>
  )
}
