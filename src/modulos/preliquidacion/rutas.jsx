import { lazy } from 'react'

// Rutas y menú del módulo Preliquidación. El núcleo (App.jsx, Layout.jsx) las
// consume sin conocer las pantallas. Cada módulo nuevo agrega su propio rutas.jsx.
// Los roles siguen siendo globales hasta el PR 3 (permisos por módulo).
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Revision = lazy(() => import('./pages/Revision'))
const Verificacion = lazy(() => import('./pages/Verificacion'))
const Conceptos = lazy(() => import('./pages/Conceptos'))
const CategoriasOperarios = lazy(() => import('./pages/CategoriasOperarios'))
const Gerencial = lazy(() => import('./pages/Gerencial'))

export const PREFIJO = '/preliquidacion'

const OPERATIVO = ['admin', 'jefe']
const TODOS = ['admin', 'jefe', 'gerente']

export const rutas = [
  { path: `${PREFIJO}/dashboard`,            element: <Dashboard />,           roles: OPERATIVO },
  { path: `${PREFIJO}/revision/:id`,         element: <Revision />,            roles: OPERATIVO },
  { path: `${PREFIJO}/verificacion`,         element: <Verificacion />,        roles: OPERATIVO },
  { path: `${PREFIJO}/conceptos`,            element: <Conceptos />,           roles: TODOS },
  { path: `${PREFIJO}/categorias-operarios`, element: <CategoriasOperarios />, roles: OPERATIVO },
  // Gerencial es transversal al sistema: queda sin prefijo (grilling etapa 0, pregunta 5).
  { path: '/gerencial',                      element: <Gerencial />,           roles: TODOS },
]

export const nav = [
  { to: `${PREFIJO}/dashboard`,            label: 'Inicio',        icon: '🏠', roles: OPERATIVO },
  { to: `${PREFIJO}/conceptos`,            label: 'Conceptos',     icon: '💲', roles: TODOS },
  { to: `${PREFIJO}/verificacion`,         label: 'Verificación',  icon: '✅', roles: OPERATIVO },
  { to: `${PREFIJO}/categorias-operarios`, label: 'Mantenimiento', icon: '🔧', roles: OPERATIVO },
  { to: '/gerencial',                      label: 'Gerencial',     icon: '📊', roles: TODOS },
]

// Direcciones anteriores al prefijo por módulo: favoritos guardados siguen andando.
export const redirecciones = [
  { from: '/dashboard',            to: `${PREFIJO}/dashboard` },
  { from: '/revision/:id',         to: `${PREFIJO}/revision/:id` },
  { from: '/verificacion',         to: `${PREFIJO}/verificacion` },
  { from: '/conceptos',            to: `${PREFIJO}/conceptos` },
  { from: '/categorias-operarios', to: `${PREFIJO}/categorias-operarios` },
]
