import { useNavigate, Link } from 'react-router-dom'
import useAuthStore from '../authStore'
import { useRegistro } from '../registroContext'
import Icono from '../ui/iconos'
import CargandoOverlay from '../ui/CargandoOverlay'
import AsistenteChat from '../asistente/AsistenteChat'
import BarraSuperior from '../layout/BarraSuperior'
import styles from './Inicio.module.css'

// Etiqueta global de la persona en el encabezado del Inicio: el admin ve
// "Admin", el resto el resumen de sus roles por módulo con los nombres que
// declara cada módulo (p. ej. "Preliquidación: Gerente", no
// "preliquidacion: gerente"). Un módulo que la persona tiene asignado pero no
// está activo/registrado se omite: no hay nombre ni etiqueta que mostrar.
const etiquetaGlobal = (usuario, MODULOS, etiquetaRol) => {
  if (!usuario) return ''
  if (usuario.rol === 'admin') return 'Admin'
  const pares = MODULOS
    .filter(m => usuario.modulos?.[m.clave])
    .map(m => `${m.nombre}: ${etiquetaRol(usuario, m) ?? usuario.modulos[m.clave]}`)
  return pares.length ? pares.join(' · ') : 'sin módulos'
}

// El padrón de empleados guarda el nombre en mayúsculas y con el apellido
// primero ("GOMEZ ADRIAN ALEJANDRO"), que en un saludo se lee a los gritos.
// Esto lo pasa a capitalización por palabra ("Gomez Adrian Alejandro"), pero
// toca solo las palabras que vienen enteras en mayúsculas y sin números: así
// lo que alguien escribió a mano se respeta ("Gero (prueba PR5)" queda igual,
// con su sigla intacta) y los paréntesis, guiones y apóstrofos siguen siendo
// límite de palabra ("O'Connor", "Rodriguez-Perez"). No intenta separar el
// apellido de los nombres: el dato no trae ningún separador confiable.
const nombreParaSaludo = (nombre) => (nombre ?? '').trim().replace(
  /[\p{L}\p{M}\p{N}]+/gu,
  palabra => (/\p{N}/u.test(palabra) || palabra !== palabra.toLocaleUpperCase('es-AR'))
    ? palabra
    : palabra.charAt(0) + palabra.slice(1).toLocaleLowerCase('es-AR'),
)

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
  const etiqueta = etiquetaGlobal(usuario, MODULOS, etiquetaRol)
  const nombre = nombreParaSaludo(usuario?.nombre)
  const saludo = nombre ? `Bienvenido, ${nombre}` : 'Bienvenido'

  const salir = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className={styles.page}>
      <CargandoOverlay />
      <BarraSuperior />

      <main className={styles.cuerpo}>
        {/* El saludo es lo primero que se lee; el rol baja acá desde la barra
            como chip, para no perder una información que sirve. */}
        <header className={styles.encabezado}>
          <div className={styles.saludoLinea}>
            <h1 className={styles.saludo}>{saludo}</h1>
            {etiqueta && <span className="badge badge-muted">{etiqueta}</span>}
          </div>
          <p className={styles.subtitulo}>Elegí dónde trabajar</p>
        </header>

        {usuario?.password_inicial && (
          <div className={styles.avisoPassword}>
            Estás usando tu contraseña inicial.{' '}
            <Link to="/cambiar-password">Cambiala por una propia</Link>.
          </div>
        )}

        {tarjetas.length === 0 ? (
          <div className={styles.vacio}>
            <p>
              Tu usuario no tiene módulos asignados. Pedile al administrador que te habilite uno.
            </p>
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

        {/* Acciones de cuenta: abajo, después de las tarjetas y separadas por
            un divisor. Son botones visibles, pero en escala de botón para no
            competir con las tarjetas, que son la acción principal. También
            cubren el estado sin módulos, que por eso ya no lleva su propio
            botón de cerrar sesión. */}
        <footer className={styles.acciones}>
          <hr className={`divider ${styles.divisor}`} />
          <div className={styles.accionesBotones}>
            <Link to="/cambiar-password" className={`btn btn-lg ${styles.accion}`}>
              <Icono nombre="llave" size={16} />
              Cambiar mi contraseña
            </Link>
            <button
              type="button"
              className={`btn btn-lg btn-danger ${styles.accion} ${styles.accionPeligro}`}
              onClick={salir}
            >
              <Icono nombre="salir" size={16} />
              Cerrar sesión
            </button>
          </div>
        </footer>
      </main>

      <AsistenteChat />
    </div>
  )
}
