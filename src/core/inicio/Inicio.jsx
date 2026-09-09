import { useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { useRegistro } from '../registroContext'
import Icono from '../ui/iconos'
import CargandoOverlay from '../ui/CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import BarraSuperior from '../layout/BarraSuperior'
import styles from './Inicio.module.css'

// Etiqueta global de la persona en la barra superior: el admin ve "Admin", el
// resto el resumen de sus roles por módulo con los nombres que declara cada
// módulo (p. ej. "Preliquidación: Gerente", no "preliquidacion: gerente").
// Un módulo que la persona tiene asignado pero no está activo/registrado se
// omite: no hay nombre ni etiqueta que mostrar.
const etiquetaGlobal = (usuario, MODULOS, etiquetaRol) => {
  if (!usuario) return ''
  if (usuario.rol === 'admin') return 'Admin'
  const pares = MODULOS
    .filter(m => usuario.modulos?.[m.clave])
    .map(m => `${m.nombre}: ${etiquetaRol(usuario, m) ?? usuario.modulos[m.clave]}`)
  return pares.length ? pares.join(' · ') : 'sin módulos'
}

const CLASE_FAMILIA = {
  gerencial: styles.familiaGerencial,
  administracion: styles.familiaAdministracion,
}

// Pantalla de Inicio (PR 4): sin menú lateral, una tarjeta por módulo al que
// la persona accede. El listado lo arma el registro de módulos, inyectado por
// App.jsx; el núcleo no conoce los módulos.
export default function Inicio() {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()
  const { tarjetasPara, MODULOS, etiquetaRol } = useRegistro()
  const tarjetas = tarjetasPara(usuario)

  const salir = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <CargandoOverlay />
      <BarraSuperior usuario={usuario} etiqueta={etiquetaGlobal(usuario, MODULOS, etiquetaRol)} onSalir={salir} />

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
