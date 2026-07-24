import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import CargandoOverlay from './CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './Layout.module.css'

// roles: quién ve cada entrada. El gerente solo llega a Gerencial y
// Conceptos (lectura); el backend rechaza el resto con 403 igual.
const NAV = [
  { to: '/dashboard',     label: 'Inicio',        icon: '🏠', roles: ['admin', 'jefe'] },
  { to: '/conceptos',     label: 'Conceptos',     icon: '💲', roles: ['admin', 'jefe', 'gerente'] },
  { to: '/verificacion',  label: 'Verificación',  icon: '✅', roles: ['admin', 'jefe'] },
  { to: '/categorias-operarios', label: 'Mantenimiento', icon: '🔧', roles: ['admin', 'jefe'] },
  { to: '/gerencial',     label: 'Gerencial',     icon: '📊', roles: ['admin', 'jefe', 'gerente'] },
]

export default function Layout() {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()
  const [colapsado, setColapsado] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={`${styles.shell} ${colapsado ? styles.shellCollapsed : ''}`}>
      <CargandoOverlay />
      <aside className={`${styles.sidebar} ${colapsado ? styles.collapsed : ''}`}>
        <div className={styles.brand}>
          <img src={logoIcono} alt="La Asturiana" className={styles.brandMark} />
          {!colapsado && (
            <div>
              <div className={styles.brandName}>LA ASTURIANA</div>
              <div className={styles.brandSub}>PRELIQUIDACIÓN</div>
            </div>
          )}
        </div>

        <nav className={styles.nav}>
          {NAV.filter(({ roles }) => roles.includes(usuario?.rol)).map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
              title={colapsado ? label : undefined}
            >
              <span className={styles.navIcon}>{icon}</span>
              {!colapsado && label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          {usuario && !colapsado && (
            <div className={styles.userBox}>
              <div className={styles.userName}>{usuario.nombre}</div>
              <div className={styles.userRole}>{usuario.rol}</div>
              <button className={styles.logoutBtn} onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          )}
          {usuario && colapsado && (
            <button className={styles.logoutBtnIcon} onClick={handleLogout} title="Cerrar sesión">
              ⎋
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