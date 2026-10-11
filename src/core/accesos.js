import { puedeVer } from './permisos.js'

// Tarjetas del Inicio, menú y aterrizaje por permisos de pantalla (ADR-0020).
// Puro: recibe los descriptores de módulo por parámetro, porque el núcleo no
// importa módulos (los arma src/modulos/registro.js). Cada entrada de `nav`
// declara su `pantalla`, y el descriptor declara la de su panel gerencial en
// `gerencial: { ruta, pantalla }`.

// Entradas del menú del módulo que la persona puede ver, en el orden del menú.
export const menuDe = (descriptor, usuario) =>
  (descriptor?.nav ?? []).filter(n => puedeVer(usuario, n.modulo ?? descriptor.clave, n.pantalla))

// Aterrizaje del módulo (destino de su tarjeta): la primera entrada del menú
// que la persona puede ver, o null si no ve ninguna. Revisión y la Vista
// gerencial no están en el menú, así que verlas no da tarjeta del módulo
// (plan del esquema de permisos, pregunta 3).
export const homeDeModulo = (descriptor, usuario) => menuDe(descriptor, usuario)[0]?.to ?? null

// Tarjetas del Inicio: una por módulo activo con aterrizaje, Gerencial si la
// persona ve el panel gerencial de algún módulo, y Administración si es admin.
// Sin tarjetas, el Login no deja entrar.
export const tarjetasDe = (descriptores, usuario) => {
  const activos = (descriptores ?? []).filter(m => m.activo)
  const tarjetas = activos
    .map(m => ({ m, ruta: homeDeModulo(m, usuario) }))
    .filter(({ ruta }) => ruta)
    .map(({ m, ruta }) => ({ clave: m.clave, nombre: m.nombre, descripcion: m.descripcion(usuario), icono: m.icono,
                             ruta, familia: 'modulo' }))
  const conGerencial = activos.filter(m => m.gerencial && puedeVer(usuario, m.clave, m.gerencial.pantalla))
  if (conGerencial.length) {
    tarjetas.push({ clave: 'gerencial', nombre: 'Gerencial', icono: 'gerencial', familia: 'gerencial',
      descripcion: `Indicadores, evolución y desvíos de ${conGerencial.map(m => m.nombre).join(', ')}.`,
      ruta: conGerencial[0].gerencial.ruta })
  }
  // Administración es del Sistema (no un módulo): solo el admin global la ve.
  if (usuario?.rol === 'admin') {
    tarjetas.push({
      clave: 'administracion', nombre: 'Administración', icono: 'administracion',
      familia: 'administracion', ruta: '/administracion',
      descripcion: 'Usuarios, roles y accesos del sistema.',
    })
  }
  return tarjetas
}
