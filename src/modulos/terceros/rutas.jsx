import { lazy } from 'react'

// Rutas y menú del módulo Liquidación Terceros. El núcleo (App.jsx, Layout.jsx)
// las consume sin conocer las pantallas.
//
// Activo desde la etapa 2 (2026-09-14): dejó de ser un molde cuando tuvo sus
// primeras pantallas reales.
//
// En la etapa 8 las cinco pantallas de conjunto —Viajes, Combustible,
// Repuestos, Horas de servicio y Horas de reparación— se reemplazaron por una
// sola, "La quincena": leían los orígenes en vivo, no tenían precios y obligaban
// a mirar cada fuente por separado, que es justo lo que el módulo vino a sacar.
// Las de Verificaciones y Tarifario siguen aparte porque no muestran hechos.
// Ver, en el repo backend, docs/modulos/terceros/plan-terceros.md.
const Inicio = lazy(() => import('./pages/Inicio'))
const Grilla = lazy(() => import('./pages/Grilla'))
const Estaciones = lazy(() => import('./pages/Estaciones'))
const Tarifario = lazy(() => import('./pages/Tarifario'))
const Verificaciones = lazy(() => import('./pages/Verificaciones'))

export const PREFIJO = '/terceros'
export const MODULO = 'terceros'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). Se reusan los que ya
// existen en el núcleo — 'terceros' es el colectivo, 'mantenimiento' la llave.
// Íconos propios para cada conjunto serían un PR aparte del núcleo (regla 4 de
// GUIA-MODULOS: fuera de la carpeta del módulo no se toca nada).
export const rutas = [
  { path: `${PREFIJO}/inicio`,       element: <Inicio />,      modulo: MODULO, pantalla: 'inicio', label: 'Inicio',          icono: 'inicio',        menu: true },
  { path: `${PREFIJO}/quincena`,     element: <Grilla />,      modulo: MODULO, pantalla: 'quincena', label: 'Quincena',         icono: 'gerencial',     menu: true },
  { path: `${PREFIJO}/tarifario`,      element: <Tarifario />,      modulo: MODULO, pantalla: 'tarifario', label: 'Tarifario',          icono: 'conceptos',     menu: true },
  { path: `${PREFIJO}/estaciones`,     element: <Estaciones />,     modulo: MODULO, pantalla: 'estaciones', label: 'Estaciones',         icono: 'conceptos',     menu: true },
  { path: `${PREFIJO}/verificaciones`, element: <Verificaciones />, modulo: MODULO, pantalla: 'verificaciones', label: 'Verificaciones',     icono: 'verificacion',  menu: true },
]

// El menú se deriva de rutas para que nav, modulo y pantalla no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, pantalla }) => ({ to: path, label, icono, modulo, pantalla }))

export const redirecciones = []

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx).
export const pantallas = {
  '/terceros/inicio': 'Liquidación Terceros (resumen de la quincena)',
  '/terceros/quincena': 'La quincena entera: los seis conceptos en una lista filtrable, ya con sus precios',
  '/terceros/tarifario': 'Tarifario: los precios pactados con cada tercero, por quincena',
  '/terceros/estaciones': 'Estaciones de servicio: lo que cada una facturó, contra lo que se cargó',
  '/terceros/verificaciones': 'Verificaciones: lo que hay que mirar antes de liquidar',
}

export const modulo = {
  clave: MODULO,
  nombre: 'Liquidación Terceros',
  descripcion: () => 'Liquidación a terceros: servicio de fletes y maquinaria.',
  icono: 'terceros',
  activo: true,
  prefijo: PREFIJO,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: null,
}
