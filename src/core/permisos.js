// Decisión de acceso por módulo y rol (PR 3 etapa 0). El backend devuelve
// `usuario.rol` (admin/usuario, global) y `usuario.modulos` (rol por módulo,
// p. ej. { preliquidacion: 'operador' }). El admin ve todo; el resto se
// decide por el rol que tiene dentro de cada módulo.
export const tienePermiso = (usuario, modulo, roles) =>
  !!usuario && (usuario.rol === 'admin' || (roles?.includes(usuario.modulos?.[modulo]) ?? false))
