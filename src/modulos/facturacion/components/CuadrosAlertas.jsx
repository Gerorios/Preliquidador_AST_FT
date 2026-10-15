import { ESTADOS } from '../estados'
import { textoDeCuadro } from '../vistaResumen'
import styles from './CuadrosAlertas.module.css'

// Los tres cuadros de Alertas de facturación arriba del Resumen (plan E3, FA5;
// mockup aprobado y boceto F0). Cada uno dice cuántas filas (mes y Cliente)
// tienen esa Alerta con el Mes y el Cliente elegidos, y al tocarlo filtra la
// tabla por ella (`filtros.alerta`); tocarlo otra vez lo saca. Cuál está
// activo se ve con el fondo, con `aria-pressed` y con el chip "Alerta: …" de
// la barra, no sólo por el color.

// En el orden de urgencia, cada uno con el tono de su etiqueta.
const CUADROS = [
  { clave: 'pendiente_de_facturar', tono: 'danger' },
  { clave: 'con_diferencia', tono: 'warn' },
  { clave: 'falta_comprobante', tono: 'info' },
]

export default function CuadrosAlertas({ cuenta, activa, onElegir }) {
  return (
    <section className={styles.cuadros} aria-label="Alertas">
      {CUADROS.map(({ clave, tono }) => {
        const n = cuenta[clave] ?? 0
        const elegido = activa === clave
        return (
          <button
            key={clave}
            type="button"
            className={`${styles.cuadro} ${styles[tono]} ${elegido ? styles.elegido : ''}`}
            aria-pressed={elegido}
            title={elegido ? 'Sacar este filtro' : `Ver sólo ${ESTADOS[clave].etiqueta}`}
            onClick={() => onElegir(elegido ? undefined : clave)}
          >
            <span className={`${styles.numero} ${n === 0 ? styles.cero : ''}`}>{n}</span>
            <span className={styles.texto}>{textoDeCuadro(clave, n)}</span>
          </button>
        )
      })}
    </section>
  )
}
