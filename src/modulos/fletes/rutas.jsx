import { lazy } from 'react'
import { tienePermiso } from '../../core/permisos'

// Molde del módulo Fletes (PR 4, etapa 0). Inactivo: no se monta en App.jsx
// ni aparece en el Inicio hasta que tenga su primera pantalla real.
const Inicio = lazy(() => import('./pages/Inicio'))

export const PREFIJO = '/fletes'
export const MODULO = 'fletes'

export const rutas = [
  { path: `${PREFIJO}/inicio`, element: <Inicio />, modulo: MODULO, roles: ['operador'], label: 'Inicio', icono: 'inicio', icon: '🏠', menu: true },
]

export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icon, icono, modulo, roles }) => ({ to: path, label, icon, icono, modulo, roles }))

export const home = (usuario) => (tienePermiso(usuario, MODULO, ['operador']) ? `${PREFIJO}/inicio` : null)

export const redirecciones = []

export const pantallas = {}

export const modulo = {
  clave: MODULO,
  nombre: 'Fletes',
  descripcion: () => 'Liquidación de fletes: viajes, tarifas y controles.',
  icono: 'fletes',
  activo: false,
  prefijo: PREFIJO,
  etiquetasRol: { operador: 'Liquidador de fletes', gerente: 'Gerente' },
  rolesTarjeta: ['operador', 'gerente'],
  home,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: null,
}
