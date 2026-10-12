import { lazy } from 'react'

// Rutas y menú del módulo Facturación. El núcleo (App.jsx, Layout.jsx) las
// consume sin conocer las pantallas.
//
// El backend declara seis pantallas (Pendientes, Cruce, Comprobantes, Unidad de
// medida por defecto, Equivalencias y Panel) para que sus claves queden fijas en
// el editor de roles desde el principio. Acá sólo tiene ruta la que ya está
// construida: las otras cinco llegan con su etapa. Una página "en construcción"
// llenaría el menú de entradas vacías y la tarjeta del Inicio podría aterrizar
// en una de ellas. Quien sólo tenga pantallas futuras no ve la tarjeta, y una
// URL tipeada vuelve al Inicio. Ver, en el repo backend,
// docs/superpowers/plans/2026-10-11-facturacion-e1.md (D2).
const UnidadFacturacion = lazy(() => import('./pages/UnidadFacturacion.jsx'))

export const PREFIJO = '/facturacion'
export const MODULO = 'facturacion'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). Se reusan los que ya
// existen en el núcleo: 'conceptos' para la tarjeta y 'mantenimiento' para la
// entrada de menú. Un ícono propio sería un PR aparte del núcleo.
// Las rutas nuevas se insertan en el orden de las pantallas del backend, para
// que la primera entrada visible del menú sea donde aterriza la tarjeta.
export const rutas = [
  { path: `${PREFIJO}/unidad`, element: <UnidadFacturacion />, modulo: MODULO, pantalla: 'unidad', label: 'Unidad de medida por defecto', icono: 'mantenimiento', menu: true },
]

// El menú se deriva de rutas para que nav, modulo y pantalla no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, pantalla }) => ({ to: path, label, icono, modulo, pantalla }))

export const redirecciones = []

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx).
export const pantallas = {
  '/facturacion/unidad': 'Unidad de medida por defecto: la Unidad sugerida de cada tarea, o si es No facturable',
}

export const modulo = {
  clave: MODULO,
  nombre: 'Facturación',
  descripcion: () => 'Lo que se factura a los clientes por las tareas agrícolas, cruzado contra lo trabajado en el campo.',
  icono: 'conceptos',
  activo: true,
  prefijo: PREFIJO,
  rutas,
  nav,
  redirecciones,
  pantallas,
  gerencial: null,
}
