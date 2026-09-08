import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import CargandoOverlay from '../ui/CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './Layout.module.css'
import { nav as navPreliquidacion } from '../../modulos/preliquidacion/rutas'

// Entradas de menú de cada módulo. Los roles filtran quién ve cada una; el
// backend rechaza igual con 403 lo que no corresponde.
const NAV = [...navPreliquidacion]

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