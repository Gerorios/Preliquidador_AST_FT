import { lazy } from 'react'

// Rutas y menú del módulo Facturación. El núcleo (App.jsx, Layout.jsx) las
// consume sin conocer las pantallas.
//
// El backend declara cuatro pantallas (Resumen, Comprobantes, Equivalencias y
// Panel) para que sus claves queden fijas en el editor de roles desde el
// principio; Pendientes y Cruce se retiraron en la E3, que las reemplaza por el
// Resumen y su Detalle. La primera construida fue Comprobantes (E2); la de la
// E1 (Unidad de medida por defecto) se retiró el 2026-10-12, porque la Unidad
// sugerida se lee del sistema de campo. Cada pantalla suma su ruta con su etapa;
// una página "en construcción" llenaría el menú de entradas vacías. Ver, en el
// repo backend, docs/superpowers/plans/2026-10-11-facturacion-e1.md (D2),
// docs/superpowers/plans/2026-10-12-unidad-desde-campo.md,
// docs/superpowers/plans/2026-10-11-facturacion-e2.md y
// docs/superpowers/plans/2026-10-14-facturacion-e3.md.
const Resumen = lazy(() => import('./pages/Resumen'))
const Detalle = lazy(() => import('./pages/Detalle'))
const Comprobantes = lazy(() => import('./pages/Comprobantes'))
const Comprobante = lazy(() => import('./pages/Comprobante'))

export const PREFIJO = '/facturacion'
export const MODULO = 'facturacion'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). La tarjeta y el menú
// reusan 'conceptos' del núcleo; un ícono propio sería un PR aparte del núcleo.
// pantalla: clave de la pantalla en el esquema de permisos (ADR-0020), la misma
// que declara el backend en app/modulos/facturacion/permisos.py.
// Las rutas nuevas se insertan en el orden de las pantallas del backend, para
// que la primera entrada visible del menú sea donde aterriza la tarjeta.
// El Detalle de un mes y Cliente no va al menú: se llega desde el Resumen y
// pide la misma pantalla `resumen`.
// El alta y el detalle de un Comprobante no van al menú: se llega desde el
// listado. Las dos piden la pantalla `comprobantes`; quien sólo puede Ver la
// abre en sólo lectura.
export const rutas = [
  { path: `${PREFIJO}/resumen`,                 element: <Resumen />, modulo: MODULO, pantalla: 'resumen', label: 'Resumen', icono: 'conceptos', menu: true },
  { path: `${PREFIJO}/resumen/:clienteId/:mes`, element: <Detalle />, modulo: MODULO, pantalla: 'resumen', menu: false },
  { path: `${PREFIJO}/comprobantes`,       element: <Comprobantes />, modulo: MODULO, pantalla: 'comprobantes', label: 'Comprobantes', icono: 'conceptos', menu: true },
  { path: `${PREFIJO}/comprobantes/nuevo`, element: <Comprobante />,  modulo: MODULO, pantalla: 'comprobantes', menu: false },
  { path: `${PREFIJO}/comprobantes/:id`,   element: <Comprobante />,  modulo: MODULO, pantalla: 'comprobantes', menu: false },
]

// El menú se deriva de rutas para que nav, modulo y pantalla no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, pantalla }) => ({ to: path, label, icono, modulo, pantalla }))

export const redirecciones = []

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx):
// nombres para el modelo, no permisos. La clave 'prefijo/*' la resuelve
// registro.js/resolverPantalla por prefijo (cada Detalle del Resumen, el alta
// y cada Comprobante).
export const pantallas = {
  '/facturacion/resumen': 'Resumen: por mes y cliente, lo trabajado según el campo, lo facturado y el estado del mes, con las alertas arriba',
  '/facturacion/resumen/*': 'Detalle de un mes y cliente: lo trabajado y lo facturado por tarea, hasta los partes del campo',
  '/facturacion/comprobantes': 'Comprobantes: las Facturas y Notas de crédito emitidas a los clientes',
  '/facturacion/comprobantes/*': 'Un Comprobante: alta o edición de una Factura o Nota de crédito, con sus Líneas',
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
