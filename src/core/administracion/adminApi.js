import api from '../api'

// Cliente de la API de Administración (núcleo). Los módulos se conocen por
// `modulosDelSistema()`, no importando el registro del frontend: la pantalla
// tiene que funcionar con los módulos que el backend declare activos.
export const listarUsuarios = () => api.get('/admin/usuarios').then(r => r.data)

export const buscarPadron = (q) => api.get('/admin/padron', { params: { q } }).then(r => r.data)

export const crearUsuarios = (cuils, rolGlobal, modulos) =>
  api.post('/admin/usuarios', { cuils, rol_global: rolGlobal, modulos }).then(r => r.data)

export const actualizarUsuario = (id, cambio) =>
  api.patch(`/admin/usuarios/${id}`, cambio).then(r => r.data)

// Reemplaza el mapa completo de módulos: para sacar un acceso hay que mandar
// el mapa sin esa clave.
export const actualizarModulos = (id, modulos) =>
  api.put(`/admin/usuarios/${id}/modulos`, { modulos }).then(r => r.data)

// Sin `password` el backend deja el CUIL; para un usuario con mail real (sin
// CUIL) la contraseña es obligatoria y responde 400 con el motivo.
export const resetearPassword = (id, password = null) =>
  api.post(`/admin/usuarios/${id}/password`, { password }).then(r => r.data)

export const modulosDelSistema = () => api.get('/auth/modulos').then(r => r.data)
