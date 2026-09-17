import { lazy } from 'react'
import { tienePermiso } from '../../core/permisos'

// Rutas y menú del módulo Liquidación Terceros. El núcleo (App.jsx, Layout.jsx)
// las consume sin conocer las pantallas.
//
// Activo desde la etapa 2 (2026-09-14): dejó de ser un molde cuando tuvo sus
// primeras pantallas reales. Todas de solo lectura — muestran lo que llega de
// los sistemas de origen, sin tarifas ni neto, que empiezan en la etapa 4.
// La de Alertas (etapa 3) no muestra datos sino lo que NO se encuentra entre
// los tres sistemas; por eso es la única sin selector de quincena.
// Ver, en el repo backend, docs/modulos/terceros/plan-terceros.md.
const Inicio = lazy(() => import('./pages/Inicio'))
const Viajes = lazy(() => import('./pages/Viajes'))
const Combustible = lazy(() => import('./pages/Combustible'))
const Repuestos = lazy(() => import('./pages/Repuestos'))
const HorasReparacion = lazy(() => import('./pages/HorasReparacion'))
const HorasServicio = lazy(() => import('./pages/HorasServicio'))
const Verificaciones = lazy(() => import('./pages/Verificaciones'))

export const PREFIJO = '/terceros'
export const MODULO = 'terceros'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). Se reusan los que ya
// existen en el núcleo — 'terceros' es el colectivo, 'mantenimiento' la llave.
// Íconos propios para cada conjunto serían un PR aparte del núcleo (regla 4 de
// GUIA-MODULOS: fuera de la carpeta del módulo no se toca nada).
export const rutas = [
  { path: `${PREFIJO}/inicio`,       element: <Inicio />,      modulo: MODULO, roles: ['operador'], label: 'Inicio',          icono: 'inicio',        menu: true },
  { path: `${PREFIJO}/viajes`,       element: <Viajes />,      modulo: MODULO, roles: ['operador'], label: 'Viajes',          icono: 'terceros',      menu: true },
  { path: `${PREFIJO}/combustible`,  element: <Combustible />, modulo: MODULO, roles: ['operador'], label: 'Combustible',     icono: 'conceptos',     menu: true },
  { path: `${PREFIJO}/repuestos`,    element: <Repuestos />,   modulo: MODULO, roles: ['operador'], label: 'Repuestos',       icono: 'modulos',       menu: true },
  { path: `${PREFIJO}/horas-servicio`,   element: <HorasServicio />,   modulo: MODULO, roles: ['operador'], label: 'Horas de servicio',   icono: 'gerencial',     menu: true },
  { path: `${PREFIJO}/horas-reparacion`, element: <HorasReparacion />, modulo: MODULO, roles: ['operador'], label: 'Horas de reparación', icono: 'mantenimiento', menu: true },
  { path: `${PREFIJO}/verificaciones`, element: <Verificaciones />, modulo: MODULO, roles: ['operador'], label: 'Verificaciones',     icono: 'verificacion',  menu: true },
]

// El menú se deriva de rutas para que nav, modulo y roles no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, roles }) => ({ to: path, label, icono, modulo, roles }))

export const home = (usuario) => (tienePermiso(usuario, MODULO, ['operador']) ? `${PREFIJO}/inicio` : null)

export const redirecciones = []

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx).
export const pantallas = {
  '/terceros/inicio': 'Liquidación Terceros (resumen de la quincena)',
  '/terceros/viajes': 'Viajes de la quincena',
  '/terceros/combustible': 'Cargas de combustible de la quincena',
  '/terceros/repuestos': 'Repuestos aplicados a máquinas de terceros',
  '/terceros/horas-servicio': 'Horas de la maquinaria del tercero trabajando en las fincas (se le pagan)',
  '/terceros/horas-reparacion': 'Horas del taller sobre máquinas de terceros (se le descuentan)',
  '/terceros/verificaciones': 'Verificaciones: lo que hay que mirar antes de liquidar',
}

export const modulo = {
  clave: MODULO,
  nombre: 'Liquidación Terceros',
  descripcion: () => 'Liquidación a terceros: servicio de fletes y maquinaria.',
  icono: 'terceros',
  activo: true,
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
