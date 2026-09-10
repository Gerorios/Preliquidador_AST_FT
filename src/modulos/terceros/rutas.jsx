import { lazy } from 'react'
import { tienePermiso } from '../../core/permisos'

// Molde del módulo Liquidación Terceros (PR 4, etapa 0). Inactivo: no se monta
// en App.jsx ni aparece en el Inicio hasta que tenga su primera pantalla real.
// Cubre dos circuitos: Fletes y Horas de taller. Ver, en el repo backend,
// docs/modulos/terceros/CONTEXT-terceros.md y plan-terceros.md.
const Inicio = lazy(() => import('./pages/Inicio'))

export const PREFIJO = '/terceros'
export const MODULO = 'terceros'

export const rutas = [
  { path: `${PREFIJO}/inicio`, element: <Inicio />, modulo: MODULO, roles: ['operador'], label: 'Inicio', icono: 'inicio', menu: true },
]

export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, roles }) => ({ to: path, label, icono, modulo, roles }))

export const home = (usuario) => (tienePermiso(usuario, MODULO, ['operador']) ? `${PREFIJO}/inicio` : null)

export const redirecciones = []

export const pantallas = {}

export const modulo = {
  clave: MODULO,
  nombre: 'Liquidación Terceros',
  descripcion: () => 'Liquidación a terceros: fletes y horas de taller.',
  icono: 'terceros',
  activo: false,
  prefijo: PREFIJO,
  etiquetasRol: { operador: 'Liquidador de terceros', gerente: 'Gerente' },
  rolesTarjeta: ['operador', 'gerente'],
  home,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: null,
}
