import { Link } from 'react-router-dom'
import Icono from '../ui/iconos'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './BarraSuperior.module.css'

// Barra superior de las pantallas sin menú lateral (Inicio, Administración,
// Cambiar contraseña). Es sobre todo identidad: marca y en qué pantalla
// estoy. Las acciones de cuenta (cambiar contraseña, cerrar sesión) viven en
// el pie del Inicio, que es el punto de partida de todas estas pantallas; acá
// apretadas a la derecha quedaban mal acomodadas y le robaban aire al título.
// `volverA` agrega el enlace de vuelta; en el Inicio no se pasa.
//
// Administración es la única excepción: es una pantalla larga con tablas, así
// que un botón al pie queda lejos, y ahí sí conviene ofrecer el cambio de
// contraseña acá arriba. `mostrarCambioPassword` es opcional y nadie más la
// pasa: en el Inicio y en Cambiar contraseña la barra sigue siendo solo
// identidad.
export default function BarraSuperior({ volverA, titulo, mostrarCambioPassword }) {
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

      {mostrarCambioPassword && (
        <Link to="/cambiar-password" className={styles.accionCuenta}>
          <Icono nombre="llave" size={14} />
          Cambiar mi contraseña
        </Link>
      )}
    </header>
  )
}
