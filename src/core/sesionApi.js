import api from './api'

// Usuario de la sesión según el backend: {id, nombre, email, rol, permisos}.
// Sin `password_inicial`, que viene sólo en el login. Un 401 lo maneja el
// interceptor de api.js (cierra la sesión y lleva al login).
export const obtenerUsuarioActual = () => api.get('/auth/me').then(r => r.data)
