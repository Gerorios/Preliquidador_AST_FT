import Icono from '../../../core/ui/iconos'
import { textoFecha } from '../formulario'
import { ETIQUETAS } from '../unidades'
import { medidaIlegible, medidaVacia, textoMedida } from '../vistaResumen'
import { signoDeDiferencia, textoDiferencia, textoPct, totalPartes } from '../detalle'
import styles from './PanelPartes.module.css'

// Panel lateral del Detalle con una tarea (plan E3, FA6; mockup aprobado del
// Detalle): la comparación de lo trabajado con lo facturado y los partes del
// campo de esa tarea en el mes, con su total. No se abre por finca: "Dónde"
// es la finca de cada parte.

// Campo y Facturado de la comparación muestran el cero, como la tabla del
// Detalle (conCero); los partes, no.
function Medida({ valor, conCero = false }) {
  const raya = conCero ? medidaIlegible(valor) : medidaVacia(valor)
  return raya ? <span className={styles.vacia}>—</span> : textoMedida(valor, { conCero })
}

const partes_ = n => `${n} ${n === 1 ? 'parte' : 'partes'}`

export default function PanelPartes({ tarea, mesTexto, umbralTexto, onCerrar }) {
  const partes = tarea.partes ?? []
  const unidad = tarea.unidad ? (ETIQUETAS[tarea.unidad] ?? tarea.unidad) : 'Sin Unidad sugerida'
  const signo = signoDeDiferencia(tarea.diferencia)

  return (
    <aside className={styles.panel} aria-labelledby="fact-panel-partes">
      <div className={styles.cabeza}>
        <h2 id="fact-panel-partes" className={styles.nombre}>
          {tarea.tarea_nombre || `Tarea ${tarea.tarea_id}`}
        </h2>
        <p className={styles.sub}>{unidad} · {mesTexto}</p>
        <button type="button" className={styles.cerrar} aria-label="Cerrar" onClick={onCerrar}>
          <Icono nombre="cerrar" size={12} />
        </button>
      </div>

      <div className={styles.cuerpo}>
        <section className={styles.seccion} aria-labelledby="fact-panel-comparacion">
          <h3 id="fact-panel-comparacion" className={styles.seccionTitulo}>Comparación</h3>
          <dl className={styles.datos}>
            <div className={styles.dato}><dt>Campo</dt><dd><Medida valor={tarea.campo} conCero /></dd></div>
            <div className={styles.dato}><dt>Facturado</dt><dd><Medida valor={tarea.facturado} conCero /></dd></div>
            <div className={styles.dato}>
              <dt>Diferencia</dt>
              <dd className={signo ? styles[signo] : undefined}>
                {textoDiferencia(tarea.diferencia)} ({textoPct(tarea.diferencia_pct)})
              </dd>
            </div>
          </dl>
          {tarea.supera && (
            <p className={styles.alerta}>
              Supera el {umbralTexto ?? 'Umbral'}. Revisá los partes con el campo o la factura.
            </p>
          )}
        </section>

        <hr className="divider" />

        <section className={styles.seccion} aria-labelledby="fact-panel-lista">
          <h3 id="fact-panel-lista" className={styles.seccionTitulo}>Partes del campo · {partes_(partes.length)}</h3>
          {partes.length === 0 ? (
            <p className={styles.nada}>No hay partes del campo de esta tarea en el mes.</p>
          ) : (
            <table className={styles.partes}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Dónde</th>
                  <th scope="col">Supervisor</th>
                  <th scope="col" className={styles.numero}>Cant.</th>
                </tr>
              </thead>
              <tbody>
                {/* Un parte no trae id, y dos del mismo día, finca y
                    supervisor son legítimos. La lista no se reordena. */}
                {partes.map((p, i) => (
                  <tr key={i}>
                    <td className="mono">{textoFecha(p.fecha) ?? p.fecha}</td>
                    <td title={p.donde || undefined}>{p.donde || '—'}</td>
                    <td title={p.supervisor || undefined} className={styles.supervisor}>{p.supervisor || '—'}</td>
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
        </section>
      </div>
    </aside>
  )
}
