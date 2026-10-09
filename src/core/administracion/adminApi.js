import api from '../api'

// La marca GLOBAL de cada persona: los valores del enum RolUsuario del backend
// (app/core/models.py), con su nombre para mostrar. No es un Rol (CONTEXT.md,
// "Admin"): el administrador ve todo sin roles. Los Roles los arma el admin y
// llegan por `listarRoles()`.
export const ROLES_GLOBALES = [
  { valor: 'usuario', etiqueta: 'Usuario' },
  { valor: 'admin', etiqueta: 'Administrador' },
]

// Cliente de la API de Administración (núcleo). Los módulos se conocen por
// `modulosDelSistema()`, no importando el registro del frontend: la pantalla
// tiene que funcionar con los módulos que el backend declare activos.
export const listarUsuarios = () => api.get('/admin/usuarios').then(r => r.data)

export const buscarPadron = (q) => api.get('/admin/padron', { params: { q } }).then(r => r.data)

// `roles` son ids: todas las personas del lote reciben los mismos.
export const crearUsuarios = (cuils, rolGlobal, roles) =>
  api.post('/admin/usuarios', { cuils, rol_global: rolGlobal, roles }).then(r => r.data)

export const actualizarUsuario = (id, cambio) =>
  api.patch(`/admin/usuarios/${id}`, cambio).then(r => r.data)

// Reemplaza la lista completa de roles de la persona: para sacarle uno hay
// que mandar la lista sin ese id.
export const actualizarRolesDeUsuario = (id, roles) =>
  api.put(`/admin/usuarios/${id}/roles`, { roles }).then(r => r.data)

// Sin `password` el backend deja el CUIL; para un usuario con mail real (sin
// CUIL) la contraseña es obligatoria y responde 400 con el motivo.
export const resetearPassword = (id, password = null) =>
  api.post(`/admin/usuarios/${id}/password`, { password }).then(r => r.data)

// Catálogo: módulos activos, cada uno con sus pantallas
// ({clave, nombre, editable, requiere}).
export const modulosDelSistema = () => api.get('/auth/modulos').then(r => r.data)

// Roles: [{id, nombre, permisos: {modulo: {pantalla: nivel}}, personas: [{id, nombre, activo}]}].
export const listarRoles = () => api.get('/admin/roles').then(r => r.data)

// `permisos` lleva sólo los módulos del catálogo: al editar, el backend
// conserva los de módulos inactivos.
export const crearRol = ({ nombre, permisos }) =>
  api.post('/admin/roles', { nombre, permisos }).then(r => r.data)

export const actualizarRol = (id, { nombre, permisos }) =>
  api.put(`/admin/roles/${id}`, { nombre, permisos }).then(r => r.data)

// 409 con el motivo si alguien tiene el rol.
export const borrarRol = (id) => api.delete(`/admin/roles/${id}`).then(r => r.data)
