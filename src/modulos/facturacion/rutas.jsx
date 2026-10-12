// Rutas y menú del módulo Facturación. El núcleo (App.jsx, Layout.jsx) las
// consume sin conocer las pantallas.
//
// El backend declara cinco pantallas (Pendientes, Cruce, Comprobantes,
// Equivalencias y Panel) para que sus claves queden fijas en el editor de roles
// desde el principio. Hoy no hay ninguna construida: la de la E1 (Unidad de
// medida por defecto) se retiró el 2026-10-12, porque la Unidad sugerida se lee
// del sistema de campo. Cada pantalla suma su ruta con su etapa; una página "en
// construcción" llenaría el menú de entradas vacías. Sin rutas no hay menú ni
// Tarjeta del Inicio para nadie, y una URL tipeada vuelve al Inicio. Ver, en el
// repo backend, docs/superpowers/plans/2026-10-11-facturacion-e1.md (D2) y
// docs/superpowers/plans/2026-10-12-unidad-desde-campo.md.

export const PREFIJO = '/facturacion'
export const MODULO = 'facturacion'

// icono: nombre para <Icono/> (src/core/ui/iconos.jsx). La tarjeta reusa
// 'conceptos' del núcleo; el ícono del menú se elige con la primera pantalla.
// Un ícono propio sería un PR aparte del núcleo.
// Las rutas nuevas se insertan en el orden de las pantallas del backend, para
// que la primera entrada visible del menú sea donde aterriza la tarjeta.
export const rutas = []

// El menú se deriva de rutas para que nav, modulo y pantalla no puedan divergir.
export const nav = rutas
  .filter(r => r.menu)
  .map(({ path, label, icono, modulo, pantalla }) => ({ to: path, label, icono, modulo, pantalla }))

export const redirecciones = []

// Pantallas para el asistente de ayuda (src/core/asistente/AsistenteChat.jsx).
export const pantallas = {}

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
