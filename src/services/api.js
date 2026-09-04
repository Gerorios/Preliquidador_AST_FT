import axios from 'axios'
import useAuthStore from '../store/authStore'

const api = axios.create({
  baseURL: '/api',
  timeout: 300_000,
  headers: { 'Content-Type': 'application/json' },
})

// Inyectar token en cada request automáticamente
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Si el servidor devuelve 401, cerrar sesión automáticamente.
// El Error que se propaga conserva `status` y `detail` (crudo) para que la UI
// pueda reaccionar a respuestas estructuradas — hoy el 409 de solapamiento
// por cliente, cuyo detail es un objeto {tipo, mensaje, solapamiento}.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const detail = err.response?.data?.detail
    const msg = (detail && typeof detail === 'object' ? detail.mensaje : detail)
      || err.message || 'Error desconocido'
    const error = new Error(msg)
    error.status = err.response?.status
    error.detail = detail
    return Promise.reject(error)
  }
)

export default api
