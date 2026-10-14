import { lazy } from 'react'
import { menuDe } from '../../core/accesos'
import { descripcionTarjeta } from './descripcionTarjeta'

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

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx); Layout.jsx lo
// renderiza como SVG. Ya no hay emojis en el menú.
// pantalla: clave de la pantalla en el esquema de permisos (ADR-0020), la misma
// que declara el backend en app/modulos/preliquidacion/permisos.py. Con ella se
// decide quién entra a la ruta y quién ve la entrada del menú. No confundir con
// `pantallas` (más abajo), que es el mapa de nombres para el asistente.
export const rutas = [
  { path: `${PREFIJO}/dashboard`,            element: <Dashboard />,           modulo: MODULO, pantalla: 'inicio',        label: 'Inicio',        icono: 'inicio',        menu: true },
  { path: `${PREFIJO}/revision/:id`,         element: <Revision />,            modulo: MODULO, pantalla: 'revision',      menu: false },
  { path: `${PREFIJO}/conceptos`,            element: <Conceptos />,           modulo: MODULO, pantalla: 'conceptos',     label: 'Conceptos',     icono: 'conceptos',     menu: true },
  { path: `${PREFIJO}/verificacion`,         element: <Verificacion />,        modulo: MODULO, pantalla: 'verificacion',  label: 'Verificación',  icono: 'verificacion',  menu: true },
  { path: `${PREFIJO}/categorias-operarios`, element: <CategoriasOperarios />, modulo: MODULO, pantalla: 'mantenimiento', label: 'Mantenimiento', icono: 'mantenimiento', menu: true },
  // Gerencial es transversal al sistema: queda sin prefijo (grilling etapa 0, pregunta 5).
  // Deja el menú del módulo (menu: false); ahora se llega por la tarjeta Gerencial
  // del Inicio (descriptor `gerencial` más abajo), no por el nav de Preliquidación.
  { path: '/gerencial',                      element: <Gerencial />,           modulo: MODULO, pantalla: 'gerencial',     label: 'Gerencial',     icono: 'gerencial',     menu: false },
]

// El menú se deriva de rutas para que nav, modulo y pantalla no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, pantalla }) => ({ to: path, label, icono, modulo, pantalla }))

// Direcciones anteriores al prefijo por módulo: favoritos guardados siguen andando.
// Revisar si siguen haciendo falta después de 2026-12.
export const redirecciones = [
  { from: '/dashboard',            to: `${PREFIJO}/dashboard` },
  { from: '/revision/:id',         to: `${PREFIJO}/revision/:id` },
  { from: '/verificacion',         to: `${PREFIJO}/verificacion` },
  { from: '/conceptos',            to: `${PREFIJO}/conceptos` },
  { from: '/categorias-operarios', to: `${PREFIJO}/categorias-operarios` },
]

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx):
// nombres para el modelo, no permisos (esos van en `pantalla` de cada ruta).
// Mismo mapa de hoy más la ruta de revisión, con clave 'prefijo/*' para que
// registro.js/resolverPantalla la resuelva por prefijo.
export const pantallas = {
  '/preliquidacion/dashboard': 'Inicio (generar quincenas)',
  '/preliquidacion/conceptos': 'Conceptos y Precios',
  '/preliquidacion/verificacion': 'Verificación (controles)',
  '/preliquidacion/categorias-operarios': 'Mantenimiento (categorías de operario)',
  '/preliquidacion/revision/*': 'Revisión de una quincena',
}

// Descriptor del módulo (contrato PR 4): lo consume src/modulos/registro.js.
// El destino de la tarjeta lo calcula el núcleo (`homeDeModulo` en
// src/core/accesos.js): la primera entrada del menú que la persona puede ver.
// La Vista gerencial es una tarjeta aparte (`gerencial`), no la del módulo.
export const modulo = {
  clave: MODULO,
  nombre: 'Preliquidación',
  // Texto de la tarjeta según las pantallas del menú que la persona ve.
  descripcion: (usuario) => descripcionTarjeta(menuDe(modulo, usuario)),
  icono: 'preliquidacion',
  activo: true,
  prefijo: PREFIJO,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: { ruta: '/gerencial', pantalla: 'gerencial' },
}
