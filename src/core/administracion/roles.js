// Lógica pura del editor de roles de Administración (ADR-0020). Sin React ni
// llamadas: la usan `EditorRol.jsx`, `ListaRoles.jsx`, `ListaUsuarios.jsx` y
// `AltaDesdePadron.jsx`.
//
// Formas que recibe:
// - catálogo (`GET /api/auth/modulos`, sólo módulos activos):
//   [{ clave, nombre, pantallas: [{ clave, nombre, editable, requiere: [claves] }] }]
// - rol (`GET /api/admin/roles`):
//   { id, nombre, permisos: { <modulo>: { <pantalla>: 'ver' | 'editar' } },
//     personas: [{ id, nombre, activo }] }
//
// Niveles: 'ver' y 'editar' son los que guarda el backend. "Sin acceso" no se
// guarda (es que no haya fila); en el editor se representa con SIN_ACCESO, y
// las funciones de acá tratan igual una pantalla en SIN_ACCESO, en null o
// ausente.

export const SIN_ACCESO = 'sin'

const NIVELES = ['ver', 'editar']
const LARGO_MAXIMO_NOMBRE = 60

const tieneNivel = (nivel) => nivel != null && nivel !== '' && nivel !== SIN_ACCESO

// Opciones del selector de una pantalla, en el orden en que se muestran:
// Sin acceso / Ver / Editar, o sin Editar si la pantalla es de sólo Ver.
export const nivelesDe = (pantalla) =>
  pantalla?.editable === false ? [SIN_ACCESO, 'ver'] : [SIN_ACCESO, ...NIVELES]

// Los permisos sin las pantallas en "sin acceso" ni los módulos que quedan
// vacíos, como pares 'modulo/pantalla' -> nivel.
const conAcceso = (permisos) => {
  const pares = new Map()
  for (const [modulo, pantallas] of Object.entries(permisos ?? {})) {
    for (const [pantalla, nivel] of Object.entries(pantallas ?? {})) {
      if (tieneNivel(nivel)) pares.set(`${modulo}/${pantalla}`, nivel)
    }
  }
  return pares
}

// Para avisar de cambios sin guardar: dos mapas de permisos dan el mismo
// acceso, sin importar el orden ni las pantallas en "sin acceso".
export const permisosIguales = (a, b) => {
  const pa = conAcceso(a)
  const pb = conAcceso(b)
  if (pa.size !== pb.size) return false
  for (const [clave, nivel] of pa) {
    if (pb.get(clave) !== nivel) return false
  }
  return true
}

// Como compara la base (collation utf8mb4_0900_ai_ci): sin mayúsculas ni
// acentos. Mismo criterio que el backend en `roles_service.py`.
const normalizar = (texto) =>
  (texto ?? '').trim().toUpperCase().normalize('NFD').replace(/\p{Mn}/gu, '')

// "A", "A y B", "A, B y C".
const enumerar = (nombres) =>
  nombres.length <= 1 ? (nombres[0] ?? '') : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`

// Las personas inactivas cuentan como que tienen el rol (plan, pregunta 8):
// si se reactivan, recuperan el acceso.
const nombresDePersonas = (personas) =>
  personas.map(p => (p.activo === false ? `${p.nombre} (inactiva)` : p.nombre))

// Espejo de las validaciones del backend al crear o editar un rol, en el mismo
// orden. Devuelve el motivo como texto, o null si se puede guardar.
// `rolesExistentes` es la lista de `GET /api/admin/roles`; el rol que se está
// editando (mismo `id`) no cuenta para el nombre repetido.
// El catálogo trae sólo módulos activos y el editor muestra sólo esos (el
// backend conserva los permisos de módulos inactivos al editar): un módulo que
// no está en el catálogo se rechaza.
export const motivoParaNoGuardar = (rol, catalogo, rolesExistentes = []) => {
  const nombre = (rol?.nombre ?? '').trim()
  if (!nombre) return 'El rol necesita un nombre.'
  // Por caracteres, no por unidades de UTF-16, como `len` en Python.
  if ([...nombre].length > LARGO_MAXIMO_NOMBRE) {
    return `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} caracteres.`
  }
  const repetido = (rolesExistentes ?? []).find(
    r => r.id !== rol.id && normalizar(r.nombre) === normalizar(nombre)
  )
  if (repetido) return `Ya hay un rol que se llama "${repetido.nombre}".`

  const modulos = new Map((catalogo ?? []).map(m => [m.clave, m]))
  let alguna = false
  for (const [claveModulo, pantallas] of Object.entries(rol?.permisos ?? {})) {
    const conNivel = Object.entries(pantallas ?? {}).filter(([, nivel]) => tieneNivel(nivel))
    if (!conNivel.length) continue
    const modulo = modulos.get(claveModulo)
    if (!modulo) return `El módulo "${claveModulo}" no existe o no está activo.`
    const declaradas = new Map((modulo.pantallas ?? []).map(p => [p.clave, p]))
    for (const [clavePantalla, nivel] of conNivel) {
      const pantalla = declaradas.get(clavePantalla)
      if (!pantalla) return `${modulo.nombre} no tiene la pantalla "${clavePantalla}".`
      if (!NIVELES.includes(nivel)) return `${pantalla.nombre} tiene un nivel desconocido: "${nivel}".`
      if (nivel === 'editar' && pantalla.editable === false) return `${pantalla.nombre} sólo admite Ver.`
      alguna = true
    }
    // Regla `requiere`: una pantalla con nivel pide al menos Ver en cada una
    // de las que declara (Revisión se abre desde el Inicio del módulo).
    const conAccesoAca = new Set(conNivel.map(([clave]) => clave))
    for (const [clavePantalla] of conNivel) {
      const pantalla = declaradas.get(clavePantalla)
      const faltan = (pantalla.requiere ?? []).filter(clave => !conAccesoAca.has(clave))
      if (faltan.length) {
        const nombres = faltan.map(clave => declaradas.get(clave)?.nombre ?? clave)
        return `${pantalla.nombre} necesita al menos Ver en ${enumerar(nombres)}.`
      }
    }
  }
  if (!alguna) return 'El rol tiene que dar acceso al menos a una pantalla.'
  return null
}

// Confirmación al guardar un rol en uso: "Este cambio vale para 2 personas: A
// y B.". null si nadie lo tiene (no hay nada que confirmar).
export const textoConfirmacion = (personas) => {
  const lista = personas ?? []
  if (!lista.length) return null
  const cantidad = lista.length === 1 ? '1 persona' : `${lista.length} personas`
  return `Este cambio vale para ${cantidad}: ${enumerar(nombresDePersonas(lista))}.`
}

// Por qué Borrar queda deshabilitado: el backend responde 409 si alguien tiene
// el rol, incluidas las personas inactivas. null si se puede borrar.
export const motivoParaNoBorrar = (rol) => {
  const personas = rol?.personas ?? []
  if (!personas.length) return null
  const quienes = personas.length === 1 ? 'Lo tiene 1 persona' : `Lo tienen ${personas.length} personas`
  return `${quienes}: ${enumerar(nombresDePersonas(personas))}. Sacáselo primero para poder borrarlo.`
}

// Una persona que no es admin y se queda sin ningún rol no puede entrar (el
// Login no la deja pasar sin tarjetas). `roles` son los que le quedarían, como
// ids o como objetos: sólo importa cuántos son.
export const quedaSinAcceso = (usuario, roles) =>
  usuario?.rol !== 'admin' && !(roles ?? []).length
