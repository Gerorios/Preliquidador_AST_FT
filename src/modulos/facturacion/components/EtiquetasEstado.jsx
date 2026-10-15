import { Link } from 'react-router-dom'
import { ESTADOS, destinoDeEtiqueta } from '../estados'
import styles from './EtiquetasEstado.module.css'

// La columna Estado de una fila del Resumen (plan E3, FA5): todos los Estados
// del mes, del más urgente al menos, cada uno con su etiqueta. La que tiene
// dónde resolverse es un link (Con diferencia al Detalle; Pendiente de
// facturar y Falta comprobante, con Editar en `comprobantes`, a cargar la
// factura y al Comprobante sin Adjunto); las demás van como texto. Debajo, la
// nota "Diferencia revisada" si la trae. El estado se lee en el texto de la
// etiqueta, no sólo en su color.

export default function EtiquetasEstado({ fila, puedeEditarComprobantes }) {
  const claves = (fila.estados ?? [])
    .filter(clave => Object.hasOwn(ESTADOS, clave))
    .sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)

  return (
    <div className={styles.estado}>
      <span className={styles.etiquetas}>
        {claves.map(clave => {
          const { etiqueta, badge } = ESTADOS[clave]
          const destino = destinoDeEtiqueta(clave, fila, puedeEditarComprobantes)
          return destino
            ? <Link key={clave} to={destino} className={`badge ${badge} ${styles.link}`}>{etiqueta}</Link>
            : <span key={clave} className={`badge ${badge}`}>{etiqueta}</span>
        })}
      </span>
      {fila.nota && <span className={styles.nota}>{fila.nota}</span>}
    </div>
  )
}
