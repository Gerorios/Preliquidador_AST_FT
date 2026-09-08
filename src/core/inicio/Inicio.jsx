import { useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { useRegistro } from '../registroContext'
import Icono from '../ui/iconos'
import CargandoOverlay from '../ui/CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import logoIcono from '../../assets/logo-asturiana-icono.png'
import styles from './Inicio.module.css'

// Etiqueta global de la persona en la barra superior: el admin ve "Admin",
// el resto el resumen de sus roles por módulo (p. ej. "preliquidacion: gerente").
const etiquetaGlobal = (usuario) => {
  if (!usuario) return ''
  if (usuario.rol === 'admin') return 'Admin'
  const pares = Object.entries(usuario.modulos ?? {}).map(([m, r]) => `${m}: ${r}`)
  return pares.length ? pares.join(' · ') : 'sin módulos'
}

const CLASE_FAMILIA = {
  gerencial: styles.familiaGerencial,
  administracion: styles.familiaAdministracion,
}

function BarraSuperior({ usuario, onSalir }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.marca}>
        <img src={logoIcono} alt="La Asturiana" className={styles.marcaLogo} />
        <div>
          <div className={styles.marcaNombre}>La Asturiana</div>
          <div className={styles.marcaSistema}>Sistema de gestión</div>
        </div>
      </div>
      <div className={styles.usuario}>
        {usuario && (
          <div>
            <div className={styles.usuarioNombre}>{usuario.nombre}</div>
            <div className={styles.usuarioRol}>{etiquetaGlobal(usuario)}</div>
          </div>
        )}
        <button type="button" className={styles.salir} onClick={onSalir}>
          Cerrar sesión
        </button>
      </div>
    </header>
  )
}

// Pantalla de Inicio (PR 4): sin menú lateral, una tarjeta por módulo al que
// la persona accede. El listado lo arma el registro de módulos, inyectado por
// App.jsx; el núcleo no conoce los módulos.
export default function Inicio() {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()
  const { tarjetasPara } = useRegistro()
  const tarjetas = tarjetasPara(usuario)

  const salir = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <CargandoOverlay />
      <BarraSuperior usuario={usuario} onSalir={salir} />

      <main className={styles.cuerpo}>
        <h1 className={styles.titulo}>
          Módulos <span className={styles.tituloSufijo}>· elegí dónde trabajar</span>
        </h1>

        {tarjetas.length === 0 ? (
          <div className={styles.vacio}>
            <p>
              Tu usuario no tiene módulos asignados. Pedile al administrador que te habilite uno.
            </p>
            <button type="button" className="btn" onClick={salir}>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className={styles.grilla}>
            {tarjetas.map((t) => (
              <button
                key={t.clave}
                type="button"
                className={`${styles.tarjeta} ${CLASE_FAMILIA[t.familia] ?? ''}`}
                onClick={() => navigate(t.ruta)}
              >
                <div className={styles.icono}>
                  <Icono nombre={t.icono} size={24} />
                </div>
                <div>
                  <div className={styles.nombre}>{t.nombre}</div>
                  <div className={styles.descripcion}>{t.descripcion}</div>
                </div>
                <div className={styles.pie}>
                  {t.etiqueta ? <span className={styles.chip}>{t.etiqueta}</span> : <span />}
                  <Icono nombre="flecha" className={styles.flecha} />
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <AsistenteChat />
    </div>
  )
}
