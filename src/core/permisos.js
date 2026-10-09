// Decisión de acceso por pantalla (ADR-0020). El backend devuelve `usuario.rol`
// (admin/usuario, global) y `usuario.permisos` (nivel por pantalla de cada
// módulo, p. ej. { preliquidacion: { conceptos: 'editar', gerencial: 'ver' } }).
// El admin trae `permisos: {}` y puede todo; para el resto, una pantalla sin
// nivel es "sin acceso", y Editar incluye Ver.

const esAdmin = (usuario) => usuario?.rol === 'admin'

const nivelDe = (usuario, modulo, pantalla) => usuario?.permisos?.[modulo]?.[pantalla]

export const puedeVer = (usuario, modulo, pantalla) => {
  if (!usuario) return false
  if (esAdmin(usuario)) return true
  const nivel = nivelDe(usuario, modulo, pantalla)
  return nivel === 'ver' || nivel === 'editar'
}

export const puedeEditar = (usuario, modulo, pantalla) => {
  if (!usuario) return false
  if (esAdmin(usuario)) return true
  return nivelDe(usuario, modulo, pantalla) === 'editar'
}

// Alcanza con poder ver una de las pantallas (como `requiere_pantalla` del
// backend cuando recibe varias).
export const puedeVerAlguna = (usuario, modulo, pantallas) =>
  (pantallas ?? []).some((pantalla) => puedeVer(usuario, modulo, pantalla))

// Esquema anterior, por módulo y rol (PR 3 etapa 0): sigue mientras las
// pantallas lo usen y sale cuando pasen a `puedeVer` (plan, pasos 3.2 a 3.4).
export const tienePermiso = (usuario, modulo, roles) =>
  !!usuario && (usuario.rol === 'admin' || (roles?.includes(usuario.modulos?.[modulo]) ?? false))
