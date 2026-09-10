import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api'
import useAuthStore from '../authStore'
import BarraSuperior from '../layout/BarraSuperior'
import styles from './CambiarPassword.module.css'

const MINIMO = 8

// Cambio voluntario de la propia contraseña. La inicial es el CUIL: nadie
// queda impedido de trabajar por no cambiarla, así que esta pantalla no es
// obligatoria ni bloquea nada — se llega por el aviso del Inicio o por el
// enlace de la barra/menú. Pide la contraseña actual porque, si alguien deja
// la sesión abierta, un tercero no puede quedarse con la cuenta; si la
// persona la olvida, la resetea un admin desde Administración (no hay
// recuperación por mail).
export default function CambiarPassword() {
  const navigate = useNavigate()
  const { usuario, token, login, logout } = useAuthStore()
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' })
  const [enviando, setEnviando] = useState(false)

  const salir = () => {
    logout()
    navigate('/login')
  }

  const cambiar = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }))

  const errorDeValidacion = () => {
    if (!form.actual || !form.nueva || !form.repetir) return 'Completá los tres campos'
    if (form.nueva.length < MINIMO) return `La contraseña nueva debe tener al menos ${MINIMO} caracteres`
    if (form.nueva !== form.repetir) return 'La nueva contraseña y su repetición no coinciden'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const error = errorDeValidacion()
    if (error) {
      toast.error(error)
      return
    }
    setEnviando(true)
    try {
      await api.post('/auth/password', { actual: form.actual, nueva: form.nueva })
      login(token, { ...usuario, password_inicial: false })
      toast.success('Contraseña actualizada')
      navigate('/')
    } catch (err) {
      // El backend distingue: 400 es la contraseña actual mal tipeada (mensaje
      // ya listo para mostrar); 422 es que la nueva no pasó la validación del
      // propio backend (no debería pasar: el front ya la exige arriba).
      if (err.status === 400) {
        toast.error(err.message)
      } else if (err.status === 422) {
        toast.error(`La contraseña nueva debe tener al menos ${MINIMO} caracteres`)
      } else {
        toast.error(err.message || 'No se pudo cambiar la contraseña')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={styles.page}>
      <BarraSuperior usuario={usuario} etiqueta="" onSalir={salir} volverA="/" titulo="Cambiar mi contraseña" />

      <main className={styles.cuerpo}>
        <form className={`card ${styles.card}`} onSubmit={handleSubmit}>
          <div>
            <h1 className={styles.titulo}>Cambiar mi contraseña</h1>
            <p className={styles.ayuda}>
              Pedimos la contraseña actual para que, si dejaste la sesión abierta, nadie más pueda cambiarla.
            </p>
          </div>

          <div className={styles.field}>
            <label className="field-label">CONTRASEÑA ACTUAL</label>
            <input
              className="input"
              type="password"
              value={form.actual}
              onChange={cambiar('actual')}
              autoComplete="current-password"
              autoFocus
            />
          </div>

          <div className={styles.field}>
            <label className="field-label">CONTRASEÑA NUEVA</label>
            <input
              className="input"
              type="password"
              value={form.nueva}
              onChange={cambiar('nueva')}
              autoComplete="new-password"
            />
            <span className={styles.pista}>Mínimo {MINIMO} caracteres.</span>
          </div>

          <div className={styles.field}>
            <label className="field-label">REPETIR CONTRASEÑA NUEVA</label>
            <input
              className="input"
              type="password"
              value={form.repetir}
              onChange={cambiar('repetir')}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {enviando ? <><span className="spinner" /> Guardando...</> : 'Guardar contraseña'}
          </button>
        </form>
      </main>
    </div>
  )
}
