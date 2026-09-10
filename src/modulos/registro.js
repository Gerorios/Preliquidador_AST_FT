import { modulo as preliquidacion } from './preliquidacion/rutas'
import { modulo as fletes } from './fletes/rutas'
import { tienePermiso } from '../core/permisos'

// Agregar un módulo = una línea acá. Los inactivos no montan rutas ni tarjeta.
export const TODOS = [preliquidacion, fletes]
export const MODULOS = TODOS.filter(m => m.activo)

export const moduloDeRuta = (pathname) => MODULOS.find(m => pathname.startsWith(m.prefijo)) ?? null

// La persona ya no ve su propio rol en la interfaz (pedido explícito del
// dueño del sistema); esta función queda sin consumidores en el núcleo, pero
// no se borra: "etiqueta de rol" es un término del dominio (ver CONTEXT.md),
// parte del contrato que declara cada módulo, y Administración sigue
// necesitando los roles para administrar (los suyos salen de `etiquetas_rol`,
// que expone el backend). Volver a mostrar el rol a la persona debería costar
// una línea, no rehacer el mecanismo.
export const etiquetaRol = (usuario, modulo) =>
  usuario?.rol === 'admin' ? 'Admin' : (modulo?.etiquetasRol?.[usuario?.modulos?.[modulo?.clave]] ?? null)

// Tarjetas del Inicio: una por módulo al que la persona accede, más Gerencial del sistema.
export const tarjetasPara = (usuario) => {
  const deModulos = MODULOS
    .filter(m => tienePermiso(usuario, m.clave, m.rolesTarjeta))
    .map(m => ({ clave: m.clave, nombre: m.nombre, descripcion: m.descripcion(usuario), icono: m.icono,
                 ruta: m.home(usuario), familia: 'modulo' }))
  const conGerencial = MODULOS.filter(m => m.gerencial && tienePermiso(usuario, m.clave, m.gerencial.roles))
  if (conGerencial.length) {
    deModulos.push({ clave: 'gerencial', nombre: 'Gerencial', icono: 'gerencial', familia: 'gerencial',
      descripcion: `Indicadores, evolución y desvíos de ${conGerencial.map(m => m.nombre).join(', ')}.`,
      ruta: conGerencial[0].gerencial.ruta })
  }
  // Administración es del Sistema (no un módulo): solo el admin global la ve.
  if (usuario?.rol === 'admin') {
    deModulos.push({
      clave: 'administracion', nombre: 'Administración', icono: 'administracion',
      familia: 'administracion', ruta: '/administracion',
      descripcion: 'Usuarios, roles y accesos del sistema.',
    })
  }
  return deModulos
}

export const pantallasAsistente = () => Object.assign({ '/': 'Inicio (módulos)' }, ...MODULOS.map(m => m.pantallas))

// Resuelve el nombre de pantalla para el asistente: primero coincidencia exacta,
// luego prefijos declarados como 'clave/*' (p. ej. revisión de una quincena).
export const resolverPantalla = (pathname, pantallas) => {
  if (pantallas[pathname]) return pantallas[pathname]
  const prefijo = Object.keys(pantallas).find(clave => clave.endsWith('/*') && pathname.startsWith(clave.slice(0, -2)))
  return prefijo ? pantallas[prefijo] : null
}
