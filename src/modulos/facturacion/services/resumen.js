import api from '../../../core/api'

// Módulo Facturación — etapa 3: el Resumen (una fila por mes y Cliente, con lo
// trabajado según el campo, lo facturado y el Estado del mes) y la
// configuración del control (Umbral de diferencia y Mes de corte). El contrato
// está en el plan 2026-10-14-facturacion-e3.md, sección 3.2 (rutas 13 y 17),
// del repo backend.
//
// Los decimales viajan como texto con punto decimal y los meses como "AAAA-MM".
// Los errores llegan con `status` y `detail` crudo (core/api.js): el pie lee
// `detail.tipo` y `detail.campo` del 422 `configuracion_invalida`.

// ─── Claves de React Query ──────────────────────────────────────────────────
// Todo lo del Resumen cuelga de CLAVE_RESUMEN, así invalidarla vuelve a pedir
// cualquier período ya leído (y el Detalle, que se suma con el FA6 bajo la
// misma raíz). Cambiar la configuración cambia los Estados de todos los meses.

export const CLAVE_RESUMEN = ['facturacion', 'resumen']
export const claveResumen = (desde, hasta) => [...CLAVE_RESUMEN, desde, hasta]

// ─── Resumen (ruta 13) ──────────────────────────────────────────────────────

// De desde a hasta ("AAAA-MM", los dos incluidos). Con `refrescar`, el backend
// vacía su caché del campo antes de leer ("Volver a leer").
export const obtenerResumen = ({ desde, hasta, refrescar = false }) =>
  api.get('/facturacion/resumen', {
    params: { desde, hasta, ...(refrescar ? { refrescar: true } : {}) },
  }).then(r => r.data)

// ─── Configuración (ruta 17, sólo el Admin) ─────────────────────────────────

// `{ umbral_pct, mes_corte: "AAAA-MM" }`. Devuelve la configuración guardada,
// con `actualizado_en` y `actualizado_por_nombre`.
export const guardarConfiguracion = (datos) =>
  api.put('/facturacion/configuracion', datos).then(r => r.data)
