import { lazy } from 'react'
import { tienePermiso } from '../../core/permisos'

// Rutas y menú del módulo Preliquidación. El núcleo (App.jsx, Layout.jsx) las
// consume sin conocer las pantallas. Cada módulo nuevo agrega su propio rutas.jsx.
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Revision = lazy(() => import('./pages/Revision'))
const Verificacion = lazy(() => import('./pages/Verificacion'))
const Conceptos = lazy(() => import('./pages/Conceptos'))
const CategoriasOperarios = lazy(() => import('./pages/CategoriasOperarios'))
const Gerencial = lazy(() => import('./pages/Gerencial'))

export const PREFIJO = '/preliquidacion'
export const MODULO = 'preliquidacion'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). icon: emoji, se
// mantiene solo porque Layout.jsx de hoy todavía lo renderiza como texto;
// Task 5 lo saca cuando Layout pase a usar <Icono nombre={icono}/>.
export const rutas = [
  { path: `${PREFIJO}/dashboard`,            element: <Dashboard />,           modulo: MODULO, roles: ['operador'],            label: 'Inicio',        icono: 'inicio',        icon: '🏠', menu: true },
  { path: `${PREFIJO}/revision/:id`,         element: <Revision />,            modulo: MODULO, roles: ['operador'],            menu: false },
  { path: `${PREFIJO}/conceptos`,            element: <Conceptos />,           modulo: MODULO, roles: ['operador', 'gerente'], label: 'Conceptos',     icono: 'conceptos',     icon: '💲', menu: true },
  { path: `${PREFIJO}/verificacion`,         element: <Verificacion />,        modulo: MODULO, roles: ['operador'],            label: 'Verificación',  icono: 'verificacion',  icon: '✅', menu: true },
  { path: `${PREFIJO}/categorias-operarios`, element: <CategoriasOperarios />, modulo: MODULO, roles: ['operador'],            label: 'Mantenimiento', icono: 'mantenimiento', icon: '🔧', menu: true },
  // Gerencial es transversal al sistema: queda sin prefijo (grilling etapa 0, pregunta 5).
  // Deja el menú del módulo (menu: false); ahora se llega por la tarjeta Gerencial
  // del Inicio (descriptor `gerencial` más abajo), no por el nav de Preliquidación.
  { path: '/gerencial',                      element: <Gerencial />,           modulo: MODULO, roles: ['gerente'],             label: 'Gerencial',     icono: 'gerencial',     icon: '📊', menu: false },
]

// El menú se deriva de rutas para que nav, modulo y roles no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icon, icono, modulo, roles }) => ({ to: path, label, icon, icono, modulo, roles }))

// Home del módulo según el usuario: null si no tiene acceso a nada de este módulo.
// Se mantiene tal cual (gerente → /gerencial) porque App.jsx todavía arma HOMES con
// esta función; Task 5 la reemplaza por el `home` del descriptor `modulo` (más abajo).
export const home = (usuario) => {
  if (tienePermiso(usuario, MODULO, ['operador'])) return `${PREFIJO}/dashboard`
  if (tienePermiso(usuario, MODULO, ['gerente'])) return '/gerencial'
  return null
}

// Direcciones anteriores al prefijo por módulo: favoritos guardados siguen andando.
// Revisar si siguen haciendo falta después de 2026-12.
export const redirecciones = [
  { from: '/dashboard',            to: `${PREFIJO}/dashboard` },
  { from: '/revision/:id',         to: `${PREFIJO}/revision/:id` },
  { from: '/verificacion',         to: `${PREFIJO}/verificacion` },
  { from: '/conceptos',            to: `${PREFIJO}/conceptos` },
  { from: '/categorias-operarios', to: `${PREFIJO}/categorias-operarios` },
]

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx).
// Mismo mapa de hoy más la ruta de revisión, con clave 'prefijo/*' para que
// registro.js/resolverPantalla la resuelva por prefijo.
export const pantallas = {
  '/preliquidacion/dashboard': 'Inicio (generar quincenas)',
  '/preliquidacion/conceptos': 'Conceptos y Precios',
  '/preliquidacion/verificacion': 'Verificación (controles)',
  '/preliquidacion/categorias-operarios': 'Mantenimiento (categorías de operario)',
  '/preliquidacion/revision/*': 'Revisión de una quincena',
}

// Home del descriptor (para las tarjetas del Inicio, PR 4): la tarjeta de
// Preliquidación del gerente lleva a Conceptos, no a Gerencial (eso es una
// tarjeta aparte, ver `gerencial` abajo). Distinta de `home` de arriba: esa
// la sigue usando App.jsx (HOMES) hasta Task 5.
const homeDescriptor = (usuario) => {
  if (tienePermiso(usuario, MODULO, ['operador'])) return `${PREFIJO}/dashboard`
  if (tienePermiso(usuario, MODULO, ['gerente'])) return `${PREFIJO}/conceptos`
  return null
}

// Descripción de la tarjeta del Inicio, según el rol del usuario en este módulo.
const descripcion = (usuario) =>
  tienePermiso(usuario, MODULO, ['operador'])
    ? 'Sueldos por quincena: generar, revisar, verificar y exportar.'
    : 'Maestro de conceptos y precios por quincena.'

// Descriptor del módulo (contrato PR 4): lo consume src/modulos/registro.js.
export const modulo = {
  clave: MODULO,
  nombre: 'Preliquidación',
  descripcion,
  icono: 'preliquidacion',
  activo: true,
  prefijo: PREFIJO,
  etiquetasRol: { operador: 'Preliquidador', gerente: 'Gerente' },
  rolesTarjeta: ['operador', 'gerente'],
  home: homeDescriptor,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: { ruta: '/gerencial', roles: ['gerente'] },
}
