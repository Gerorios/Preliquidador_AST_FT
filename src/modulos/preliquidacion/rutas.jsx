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
  { path: `${PREFIJO}/dashboard`,            element: <Dashboard />,           roles: OPERATIVO, label: 'Inicio',        icon: '🏠', menu: true },
  { path: `${PREFIJO}/revision/:id`,         element: <Revision />,            roles: OPERATIVO, menu: false },
  { path: `${PREFIJO}/conceptos`,            element: <Conceptos />,           roles: TODOS,     label: 'Conceptos',     icon: '💲', menu: true },
  { path: `${PREFIJO}/verificacion`,         element: <Verificacion />,        roles: OPERATIVO, label: 'Verificación',  icon: '✅', menu: true },
  { path: `${PREFIJO}/categorias-operarios`, element: <CategoriasOperarios />, roles: OPERATIVO, label: 'Mantenimiento', icon: '🔧', menu: true },
  // Gerencial es transversal al sistema: queda sin prefijo (grilling etapa 0, pregunta 5).
  { path: '/gerencial',                      element: <Gerencial />,           roles: TODOS,     label: 'Gerencial',     icon: '📊', menu: true },
]

// El menú se deriva de rutas para que nav y roles no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icon, roles }) => ({ to: path, label, icon, roles }))

// Direcciones anteriores al prefijo por módulo: favoritos guardados siguen andando.
// Revisar si siguen haciendo falta después de 2026-12.
export const redirecciones = [
  { from: '/dashboard',            to: `${PREFIJO}/dashboard` },
  { from: '/revision/:id',         to: `${PREFIJO}/revision/:id` },
  { from: '/verificacion',         to: `${PREFIJO}/verificacion` },
  { from: '/conceptos',            to: `${PREFIJO}/conceptos` },
  { from: '/categorias-operarios', to: `${PREFIJO}/categorias-operarios` },
]
