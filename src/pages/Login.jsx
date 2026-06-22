import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import useAuthStore from '../store/authStore'
import styles from './Login.module.css'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [cargando, setCargando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Ingresá email y contraseña')
      return
    }
    setCargando(true)
    try {
      // OAuth2 requiere form-data con username/password
      const formData = new URLSearchParams()
      formData.append('username', form.email)
      formData.append('password', form.password)

      const res = await axios.post('/api/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      login(res.data.access_token, res.data.usuario)
      toast.success(`Bienvenido, ${res.data.usuario.nombre}`)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al iniciar sesión'
      toast.error(msg)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brandMark}>▲</div>
        <div className={styles.brandName}>LA ASTURIANA SRL</div>
        <div className={styles.brandSub}>SISTEMA DE PRELIQUIDACIÓN</div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className="field-label">EMAIL</label>
            <input
              className="input"
              type="email"
              placeholder="usuario@asturiana.com"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className="field-label">CONTRASEÑA</label>
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            disabled={cargando}
          >
            {cargando
              ? <><span className="spinner" /> Ingresando...</>
              : 'Ingresar'
            }
          </button>
        </form>

        <div className={styles.footer}>
          Acceso restringido · Solo personal autorizado
        </div>
      </div>
    </div>
  )
}
