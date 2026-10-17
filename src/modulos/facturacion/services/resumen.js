import api from '../../../core/api'

// Módulo Facturación — etapa 3: el Resumen (una fila por mes y Cliente, con lo
// trabajado según el campo, lo facturado y el Estado del mes) y la
// configuración del control (Umbral de diferencia y Mes de corte); y el
// Detalle de un Cliente en un mes, con su Revisión de diferencia (FA6). El
// contrato está en el plan 2026-10-14-facturacion-e3.md, sección 3.2 (rutas
// 13 a 17), del repo backend.
//
// Los decimales viajan como texto con punto decimal, los meses como "AAAA-MM"
// y los días del filtro como "AAAA-MM-DD" (Ticket 4 de la spec de la E3a por
// grupo): el Detalle y la Revisión reciben el mismo `desde` y `hasta` que el
// Resumen, y el backend los recorta al mes; sin ellos, el mes entero.
// Los errores llegan con `status` y `detail` crudo (core/api.js): el pie lee
// `detail.tipo` y `detail.campo` del 422 `configuracion_invalida`, y el
// Detalle, los de la Revisión (422 `revision_invalida`, 409 `no_revisable` y
// `sin_revision`).

// ─── Claves de React Query ──────────────────────────────────────────────────
// Todo lo del Resumen cuelga de CLAVE_RESUMEN, así invalidarla vuelve a pedir
// cualquier período ya leído y cualquier Detalle. Cambiar la configuración
// cambia los Estados de todos los meses; una Revisión cambia el Estado del mes
// en el Resumen.

export const CLAVE_RESUMEN = ['facturacion', 'resumen']
export const claveResumen = (desde, hasta) => [...CLAVE_RESUMEN, desde, hasta]
export const claveDetalle = (clienteId, mes, desde, hasta) =>
  [...CLAVE_RESUMEN, 'detalle', String(clienteId), mes, desde ?? '', hasta ?? '']

// `desde` y `hasta` del filtro, sólo si vienen los dos.
const filtro = (desde, hasta) => (desde && hasta ? { desde, hasta } : {})

// ─── Resumen (ruta 13) ──────────────────────────────────────────────────────

// De desde a hasta ("AAAA-MM-DD", los dos incluidos). Con `refrescar`, el backend
// vacía su caché del campo antes de leer ("Volver a leer").
export const obtenerResumen = ({ desde, hasta, refrescar = false }) =>
  api.get('/facturacion/resumen', {
    params: { desde, hasta, ...(refrescar ? { refrescar: true } : {}) },
  }).then(r => r.data)

// ─── Detalle (ruta 14) ──────────────────────────────────────────────────────

// El Cruce de un Cliente en un mes ("AAAA-MM"), hasta los partes del campo,
// en el período del filtro. Con `refrescar`, como el Resumen.
export const obtenerDetalle = ({ clienteId, mes, desde, hasta, refrescar = false }) =>
  api.get(`/facturacion/resumen/${clienteId}/${mes}`, {
    params: { ...filtro(desde, hasta), ...(refrescar ? { refrescar: true } : {}) },
  }).then(r => r.data)

// ─── Revisión de diferencia (rutas 15 y 16, Editar en Resumen) ─────────────

// Las dos van con el período del Detalle (la Revisión cubre sólo ese período
// exacto, decisión 5) y devuelven el Detalle ya actualizado.
export const dejarRevision = ({ clienteId, mes, desde, hasta, comentario }) =>
  api.post(`/facturacion/resumen/${clienteId}/${mes}/revision`, { comentario }, {
    params: filtro(desde, hasta),
  }).then(r => r.data)

export const deshacerRevision = ({ clienteId, mes, desde, hasta }) =>
  api.delete(`/facturacion/resumen/${clienteId}/${mes}/revision`, {
    params: filtro(desde, hasta),
  }).then(r => r.data)

// ─── Configuración (ruta 17, sólo el Admin) ─────────────────────────────────

// `{ umbral_pct, mes_corte: "AAAA-MM" }`. Devuelve la configuración guardada,
// con `actualizado_en` y `actualizado_por_nombre`.
export const guardarConfiguracion = (datos) =>
  api.put('/facturacion/configuracion', datos).then(r => r.data)
