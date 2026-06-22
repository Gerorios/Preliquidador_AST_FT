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

// Si el servidor devuelve 401, cerrar sesión automáticamente
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    const msg = err.response?.data?.detail || err.message || 'Error desconocido'
    return Promise.reject(new Error(msg))
  }
)

export default api
