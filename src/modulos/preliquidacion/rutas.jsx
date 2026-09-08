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

export const rutas = [
  { path: `${PREFIJO}/dashboard`,            element: <Dashboard />,           modulo: MODULO, roles: ['operador'],            label: 'Inicio',        icon: '🏠', menu: true },
  { path: `${PREFIJO}/revision/:id`,         element: <Revision />,            modulo: MODULO, roles: ['operador'],            menu: false },
  { path: `${PREFIJO}/conceptos`,            element: <Conceptos />,           modulo: MODULO, roles: ['operador', 'gerente'], label: 'Conceptos',     icon: '💲', menu: true },
  { path: `${PREFIJO}/verificacion`,         element: <Verificacion />,        modulo: MODULO, roles: ['operador'],            label: 'Verificación',  icon: '✅', menu: true },
  { path: `${PREFIJO}/categorias-operarios`, element: <CategoriasOperarios />, modulo: MODULO, roles: ['operador'],            label: 'Mantenimiento', icon: '🔧', menu: true },
  // Gerencial es transversal al sistema: queda sin prefijo (grilling etapa 0, pregunta 5).
  { path: '/gerencial',                      element: <Gerencial />,           modulo: MODULO, roles: ['gerente'],             label: 'Gerencial',     icon: '📊', menu: true },
]

// El menú se deriva de rutas para que nav, modulo y roles no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icon, modulo, roles }) => ({ to: path, label, icon, modulo, roles }))

// Home del módulo según el usuario: null si no tiene acceso a nada de este módulo.
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
