// Decisión de acceso por módulo y rol (PR 3 etapa 0). El backend devuelve
// `usuario.rol` (admin/usuario, global) y `usuario.modulos` (rol por módulo,
// p. ej. { preliquidacion: 'operador' }). El admin ve todo; el resto se
// decide por el rol que tiene dentro de cada módulo.
export const tienePermiso = (usuario, modulo, roles) =>
  !!usuario && (usuario.rol === 'admin' || roles.includes(usuario.modulos?.[modulo]))

// Recorre las home de cada módulo registrado (una función (usuario) => ruta|null
// por módulo, en orden de prioridad) y devuelve la primera a la que el usuario
// tiene acceso. Sin ninguna, vuelve a /login.
export const homeDeUsuario = (usuario, homes) => {
  for (const home of homes) {
    const r = home(usuario)
    if (r) return r
  }
  return '/login'
}
