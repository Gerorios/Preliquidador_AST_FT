import { useState } from 'react'
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { tienePermiso } from '../permisos'
import { useRegistro } from '../registroContext'
import Icono from '../ui/iconos'
import CargandoOverlay from '../ui/CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './Layout.module.css'

// Marco de un módulo abierto. Recibe el descriptor del módulo por prop
// (`modulo`, lo pasa App.jsx) o `marco="gerencial"` para el marco transversal
// de Gerencial. El núcleo no importa los módulos: las entradas del menú
// salen del descriptor o del registro inyectado por contexto.
export default function Layout({ modulo, marco }) {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()
  const { MODULOS, etiquetaRol } = useRegistro()
  const [colapsado, setColapsado] = useState(false)

  const esGerencial = marco === 'gerencial'

  // En el marco gerencial el menú tiene una entrada por módulo con panel
  // gerencial al que la persona accede (hoy solo Preliquidación).
  const entradas = esGerencial
    ? MODULOS
        .filter(m => m.gerencial && tienePermiso(usuario, m.clave, m.gerencial.roles))
        .map(m => ({ to: m.gerencial.ruta, label: m.nombre, icono: m.icono }))
    : (modulo?.nav ?? []).filter(n => tienePermiso(usuario, n.modulo, n.roles))

  const titulo = esGerencial ? 'Gerencial' : (modulo?.nombre ?? '')

  const etiqueta = esGerencial
    ? (usuario?.rol === 'admin' ? 'Admin' : 'Gerente')
    : etiquetaRol(usuario, modulo)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`${styles.shell} ${colapsado ? styles.shellCollapsed : ''}`}>
      <CargandoOverlay />
      <aside className={`${styles.sidebar} ${colapsado ? styles.collapsed : ''}`}>
        <NavLink to="/" className={styles.volver} title={colapsado ? 'Módulos' : undefined}>
          <Icono nombre={colapsado ? 'modulos' : 'atras'} size={16} />
          {!colapsado && 'Módulos'}
        </NavLink>

        <div className={styles.brand}>
          <img src={logoIcono} alt="La Asturiana" className={styles.brandMark} />
          {!colapsado && (
            <div>
              <div className={styles.brandSistema}>Sistema de gestión</div>
              <div className={styles.brandModulo}>{titulo}</div>
            </div>
          )}
        </div>

        <nav className={styles.nav}>
          {entradas.map(({ to, label, icono }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              title={colapsado ? label : undefined}
            >
              <span className={styles.navIcon}><Icono nombre={icono} /></span>
              {!colapsado && label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {usuario && !colapsado && (
            <div className={styles.userBox}>
              <div className={styles.userName}>{usuario.nombre}</div>
              <div className={styles.userRole}>{etiqueta ?? 'sin rol'}</div>
              <Link to="/cambiar-password" className={styles.linkSecundario}>
                Cambiar mi contraseña
              </Link>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
          {usuario && colapsado && (
            <button className={styles.logoutBtnIcon} onClick={handleLogout} title="Cerrar sesión">
              <Icono nombre="salir" size={16} />
            </button>
          )}
          <button
            className={styles.collapseBtn}
            onClick={() => setColapsado(!colapsado)}
            title={colapsado ? 'Expandir menú' : 'Contraer menú'}
          >
            {colapsado ? '»' : '« Contraer'}
          </button>
        </div>
      </aside>

      <main className={styles.main}>
        <Outlet />
      </main>

      <AsistenteChat />
    </div>
  )
}
