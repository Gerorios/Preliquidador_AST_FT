import { Link } from 'react-router-dom'
import Icono from '../ui/iconos'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './BarraSuperior.module.css'

// Barra superior de las pantallas sin menú lateral (Inicio, Administración,
// Cambiar contraseña). `volverA` agrega el enlace de vuelta; en el Inicio no
// se pasa, porque el Inicio ES el punto de partida.
export default function BarraSuperior({ usuario, etiqueta, onSalir, volverA, titulo }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.marca}>
        {volverA && (
          <Link to={volverA} className={styles.volver} title="Volver al Inicio">
            <Icono nombre="atras" size={16} />
          </Link>
        )}
        <img src={logoIcono} alt="La Asturiana" className={styles.marcaLogo} />
        <div>
          <div className={styles.marcaNombre}>La Asturiana</div>
          <div className={styles.marcaSistema}>{titulo ?? 'Sistema de gestión'}</div>
        </div>
      </div>
      <div className={styles.usuario}>
        {usuario && (
          <div>
            <div className={styles.usuarioNombre}>{usuario.nombre}</div>
            <div className={styles.usuarioRol}>{etiqueta}</div>
          </div>
        )}
        <Link to="/cambiar-password" className={styles.enlaceSecundario}>
          Cambiar mi contraseña
        </Link>
        <button type="button" className={styles.salir} onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}
