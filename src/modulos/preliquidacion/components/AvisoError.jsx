import Icono from '../../../core/ui/iconos'
import styles from './AvisoError.module.css'

// Aviso de una carga que falló. Tiene estilo propio, distinto del vacío gris de cada
// pantalla, porque un error de carga no puede leerse como "no hay datos"
// (GUIA-MODULOS regla 21). Los vacíos siguen con la clase de cada pantalla. Sin margen
// exterior: el espacio lo pone quien lo usa.
export default function AvisoError({ children }) {
  return (
    <div className={styles.aviso} role="alert">
      <Icono nombre="alerta" size={16} enTexto className={styles.icono} />
      {children}
    </div>
  )
}
