import { Link } from 'react-router-dom'
import styles from './Detalle.module.css'

// Lugar provisorio del Detalle de un mes y Cliente (plan E3, FA5): la ruta
// /facturacion/resumen/:clienteId/:mes se registra con el Resumen para que sus
// links no lleven a una página inexistente. La pantalla la construye FA6, que
// reemplaza este archivo y su CSS enteros. Facturación sigue escondida: nadie
// tiene su rol.

export default function Detalle() {
  return (
    <div className={styles.page}>
      <h1 className={styles.titulo}>Detalle</h1>
      <p className={styles.texto}>El Detalle del mes todavía no está construido.</p>
      <Link to="/facturacion/resumen" className={`btn btn-sm ${styles.volver}`}>Volver al Resumen</Link>
    </div>
  )
}
