import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import CargandoOverlay from './CargandoOverlay'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './Layout.module.css'

const NAV = [
  { to: '/dashboard',     label: 'Inicio',        icon: '⬡' },
  { to: '/conceptos',     label: 'Conceptos',     icon: '⬢' },
  { to: '/verificacion',  label: 'Verificación',  icon: '⚑' },
  { to: '/categorias-operarios', label: 'Mantenimiento', icon: '⚙' },
  { to: '/historial',     label: 'Historial',     icon: '◎' },
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
          {NAV.map(({ to, label, icon }) => (
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
    </div>
  )
}