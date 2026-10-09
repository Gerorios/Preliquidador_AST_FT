import { modulo as preliquidacion } from './preliquidacion/rutas'
import { modulo as terceros } from './terceros/rutas'
import { tarjetasDe } from '../core/accesos'

// Agregar un módulo = una línea acá. Los inactivos no montan rutas ni tarjeta.
export const TODOS = [preliquidacion, terceros]
export const MODULOS = TODOS.filter(m => m.activo)

export const moduloDeRuta = (pathname) => MODULOS.find(m => pathname.startsWith(m.prefijo)) ?? null

// Tarjetas del Inicio: una por módulo con alguna pantalla de su menú a la vista,
// más Gerencial y Administración. La regla es del núcleo (src/core/accesos.js,
// por permisos de pantalla, ADR-0020); acá sólo se le pasan los módulos.
export const tarjetasPara = (usuario) => tarjetasDe(MODULOS, usuario)

export const pantallasAsistente = () => Object.assign({ '/': 'Inicio (módulos)' }, ...MODULOS.map(m => m.pantallas))

// Resuelve el nombre de pantalla para el asistente: primero coincidencia exacta,
// luego prefijos declarados como 'clave/*' (p. ej. revisión de una quincena).
export const resolverPantalla = (pathname, pantallas) => {
  if (pantallas[pathname]) return pantallas[pathname]
  const prefijo = Object.keys(pantallas).find(clave => clave.endsWith('/*') && pathname.startsWith(clave.slice(0, -2)))
  return prefijo ? pantallas[prefijo] : null
}
