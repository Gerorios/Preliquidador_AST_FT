import { useState, useEffect } from 'react'
import styles from '../pages/Verificacion.module.css'
import { EncabezadoOrdenable } from './TablaOrdenable'
import { ordenarFilas } from '../pages/ordenarFilas'

// Columnas de cada control: cómo se lee el valor de cada fila para ordenar.
const COLS_PLANTAS = [
  { clave: 'cliente', label: 'Cliente', valor: f => f.nombre_cliente },
  { clave: 'finca', label: 'Finca', valor: f => f.nombre_finca },
  { clave: 'tarea', label: 'Tarea', valor: f => f.nombre_tarea },
  { clave: 'precio', label: 'Precio pagado', valor: f => f.precio_promedio, numerica: true },
  { clave: 'unidades', label: 'Un', valor: f => f.unidades, numerica: true },
  { clave: 'hs', label: 'Hs', valor: f => f.hs, numerica: true },
  { clave: 'porHsm', label: 'Plantas/Hsm', valor: f => f.plantas_por_hsm, numerica: true },
  { clave: 'porHsm8', label: 'Plantas/Hsm×8', valor: f => f.plantas_por_hsm_x8, numerica: true },
  { clave: 'promJornal', label: 'Prom Jornal', valor: f => f.prom_jornal, numerica: true },
  { clave: 'jornadas', label: 'Jornadas', valor: f => f.jornadas, numerica: true },
  { clave: 'totalJornal', label: 'Jornal tractorista', valor: f => f.total_jornal, numerica: true },
  { clave: 'dif', label: '%Dif', valor: f => f.diff_jornada_pct, numerica: true },
]

const COLS_TANCADAS = [
  { clave: 'cliente', label: 'Cliente', valor: f => f.nombre_cliente },
  { clave: 'finca', label: 'Finca', valor: f => f.nombre_finca },
  { clave: 'tarea', label: 'Tarea', valor: f => f.nombre_tarea },
  { clave: 'tancadas', label: 'Tancadas', valor: f => f.tancadas, numerica: true },
  { clave: 'hsjornal', label: 'Hs jornal', valor: f => f.hsjornal, numerica: true },
  { clave: 'hsmaquina', label: 'Hs máquina', valor: f => f.hsmaquina, numerica: true },
  { clave: 'precio', label: 'Precio tancada', valor: f => f.precio, numerica: true },
  { clave: 'importe', label: 'Importe pagado', valor: f => f.importe_pagado, numerica: true },
  { clave: 'valorHora', label: 'Valor hs/máquina pulv', valor: f => f.valor_hora_maquina, numerica: true },
  { clave: 'referencia', label: 'Valor hs pulv × 1,3', valor: f => f.valor_hora_referencia, numerica: true },
  { clave: 'variacion', label: 'Variación', valor: f => f.variacion, numerica: true },
]

// El orden lo puede guardar la pantalla (Verificación, para conservarlo al
// navegar); si no lo pasa (Gerencial), vive en el propio control.
function useOrden(orden, onOrden) {
  const [propio, setPropio] = useState(null)
  return onOrden ? [orden ?? null, onOrden] : [propio, setPropio]
}

// Controles de pago Plantas vs Jornal y Tancadas vs Jornal, compartidos entre
// Verificación (liquidador: puede cargar el valor hora vía `onGuardar`) y la
// vista gerencial (solo lectura: sin `onGuardar`, el valor se muestra como
// texto y si falta se avisa que lo carga el liquidador).

export const UMBRAL_PROM_JORNAL_ALTO = 50000

// Null-safe formatters — los campos comun/especial/var_pct pueden venir null
// cuando no hay datos suficientes para separar el precio común del especial.
const fmtMoneyN = (n) => n == null ? '—' : `$${n.toLocaleString('es-AR')}`
// var_pct viene como ratio crudo; se muestra en %. Positivo = especial más caro/alto que común.
const fmtPctN  = (d) => d == null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

// Barra del valor hora: editable (input + guardar) cuando hay `onGuardar`,
// solo lectura si no.
function BarraValorHora({ etiqueta, valorHora, onGuardar, guardando, avisoFalta }) {
  const editable = typeof onGuardar === 'function'
  const [input, setInput] = useState(valorHora == null ? '' : String(valorHora))
  // Re-sincroniza el input cuando llega/cambia el valor del backend (ej. al
  // cambiar de quincena o tras guardar).
  useEffect(() => { setInput(valorHora == null ? '' : String(valorHora)) }, [valorHora])

  const guardar = () => {
    const t = input.trim()
    onGuardar(t === '' ? null : Number(t))
  }

  return (
    <div className={styles.vhpBar}>
      <label className={styles.vhpLabel}>{etiqueta}</label>
      {editable ? (
        <>
          <input
            className="input"
            type="number"
            step="0.01"
            style={{ width: 160 }}
            placeholder="sin cargar"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') guardar() }}
          />
          <button className="btn btn-primary btn-sm" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
          {valorHora == null && (
            <span className={styles.vhpAviso}>{avisoFalta}</span>
          )}
        </>
      ) : (
        valorHora == null
          ? <span className={styles.vhpAviso}>El liquidador todavía no cargó este valor para la quincena.</span>
          : <span className="mono">${valorHora.toLocaleString('es-AR')}</span>
      )}
    </div>
  )
}

export function PlantasJornal({ data, onGuardar, guardando, orden: ordenPantalla, onOrden: onOrdenPantalla }) {
  const [orden, setOrden] = useOrden(ordenPantalla, onOrdenPantalla)
  const filas = data?.filas || []
  const ordenadas = ordenarFilas(filas, COLS_PLANTAS, orden)
  const totales = data?.totales

  return (
    <div>
      <div className={styles.seccionTitulo}>Control pago — Plantas vs Jornal · {filas.length} combinaciones cliente/finca/tarea</div>

      <BarraValorHora
        etiqueta="Valor hora tractorista"
        valorHora={data?.valor_hora_tractorista ?? null}
        onGuardar={onGuardar}
        guardando={guardando}
        avisoFalta="Cargá el valor hora del tractorista para ver la comparación a jornal."
      />

      {filas.length === 0 ? (
        <div className={styles.empty}>No hay líneas con grupo de pago "PLANTA" para los filtros aplicados.</div>
      ) : (
      <div className={styles.pjTableWrap}>
        <table className={styles.pjTable}>
          <thead>
            <tr>
              {COLS_PLANTAS.map(c => <EncabezadoOrdenable key={c.clave} columna={c} orden={orden} onOrden={setOrden} />)}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((f, i) => (
              <tr key={i}>
                <td>{f.nombre_cliente}</td><td>{f.nombre_finca}</td><td>{f.nombre_tarea}</td>
                <td className="mono">{f.precio_promedio.toLocaleString('es-AR')}</td>
                <td className="mono">{f.unidades.toLocaleString('es-AR')}</td>
                <td className="mono">{f.hs.toLocaleString('es-AR')}</td>
                <td className="mono">{f.plantas_por_hsm.toLocaleString('es-AR')}</td>
                <td className="mono">{f.plantas_por_hsm_x8.toLocaleString('es-AR')}</td>
                <td className={`mono ${f.prom_jornal >= UMBRAL_PROM_JORNAL_ALTO ? styles.pjAlto : ''}`}>${f.prom_jornal.toLocaleString('es-AR')}</td>
                <td className="mono">{f.jornadas.toLocaleString('es-AR')}</td>
                <td className="mono">{fmtMoneyN(f.total_jornal)}</td>
                <td className={`mono ${f.diff_jornada_pct != null && f.diff_jornada_pct > 0 ? styles.pjAlto : ''}`}>{fmtPctN(f.diff_jornada_pct)}</td>
              </tr>
            ))}
          </tbody>
          {totales && (
            <tfoot>
              <tr className={styles.pjTotalRow}>
                <td colSpan={3}>Total</td>
                <td className="mono">{totales.precio_promedio.toLocaleString('es-AR')}</td>
                <td className="mono">{totales.unidades.toLocaleString('es-AR')}</td>
                <td className="mono">{totales.hs.toLocaleString('es-AR')}</td>
                <td className="mono">{totales.plantas_por_hsm.toLocaleString('es-AR')}</td>
                <td className="mono">{totales.plantas_por_hsm_x8.toLocaleString('es-AR')}</td>
                <td className="mono">${totales.prom_jornal.toLocaleString('es-AR')}</td>
                <td className="mono">{totales.jornadas.toLocaleString('es-AR')}</td>
                <td className="mono">{fmtMoneyN(totales.total_jornal)}</td>
                <td className={`mono ${totales.diff_jornada_pct != null && totales.diff_jornada_pct > 0 ? styles.pjAlto : ''}`}>{fmtPctN(totales.diff_jornada_pct)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      )}
    </div>
  )
}

export function TancadasJornal({ data, onGuardar, guardando, orden: ordenPantalla, onOrden: onOrdenPantalla }) {
  const [orden, setOrden] = useOrden(ordenPantalla, onOrdenPantalla)
  const filas = data?.filas || []
  const ordenadas = ordenarFilas(filas, COLS_TANCADAS, orden)
  const totales = data?.totales

  const fmt = (n) => n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const fmtMoney = (n) => n == null ? '—' : `$${n.toLocaleString('es-AR')}`
  // La variación viene como ratio crudo; se muestra en %. Positivo = el valor
  // hora pagado por hora de máquina supera la referencia (valor hora pulv × 1,3).
  const fmtPct = (d) => d == null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`
  const filasSinHsMaquina = totales?.filas_sin_hs_maquina ?? 0

  return (
    <div>
      <div className={styles.seccionTitulo}>Control pago — Tancadas vs Jornal · {filas.length} combinaciones cliente/finca/tarea</div>

      <BarraValorHora
        etiqueta="Valor hora pulverización"
        valorHora={data?.valor_hora_pulv ?? null}
        onGuardar={onGuardar}
        guardando={guardando}
        avisoFalta="Cargá el valor hora para ver la comparación a jornal."
      />

      {filas.length === 0 ? (
        <div className={styles.empty}>No hay líneas pagadas por tancada en esta quincena.</div>
      ) : (
        <>
          <div className={styles.pjTableWrap}>
            <table className={styles.pjTable}>
              <thead>
                <tr>
                  {COLS_TANCADAS.map(c => <EncabezadoOrdenable key={c.clave} columna={c} orden={orden} onOrden={setOrden} />)}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((f, i) => (
                  <tr key={i}>
                    <td>{f.nombre_cliente}</td><td>{f.nombre_finca}</td><td>{f.nombre_tarea}</td>
                    <td className="mono">{fmt(f.tancadas)}</td>
                    <td className="mono">{fmt(f.hsjornal)}</td>
                    <td className="mono">
                      {fmt(f.hsmaquina)}
                      {f.sin_hs_maquina && (
                        <span className="badge badge-muted" style={{ marginLeft: 6 }}>sin hs máquina</span>
                      )}
                    </td>
                    <td className="mono">{fmtMoney(f.precio)}</td>
                    <td className="mono">{fmtMoney(f.importe_pagado)}</td>
                    <td className="mono">{fmtMoney(f.valor_hora_maquina)}</td>
                    <td className="mono">{fmtMoney(f.valor_hora_referencia)}</td>
                    <td className={`mono ${f.variacion != null && f.variacion > 0 ? styles.pjAlto : ''}`}>{fmtPct(f.variacion)}</td>
                  </tr>
                ))}
              </tbody>
              {totales && (
                <tfoot>
                  <tr className={styles.pjTotalRow}>
                    <td colSpan={3}>Total</td>
                    <td className="mono">{fmt(totales.tancadas)}</td>
                    <td className="mono">{fmt(totales.hsjornal)}</td>
                    <td className="mono">{fmt(totales.hsmaquina)}</td>
                    <td className="mono">{fmtMoney(totales.precio)}</td>
                    <td className="mono">{fmtMoney(totales.importe_pagado)}</td>
                    <td className="mono">{fmtMoney(totales.valor_hora_maquina)}</td>
                    <td className="mono">{fmtMoney(totales.valor_hora_referencia)}</td>
                    <td className={`mono ${totales.variacion != null && totales.variacion > 0 ? styles.pjAlto : ''}`}>{fmtPct(totales.variacion)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {filasSinHsMaquina > 0 && (
            <p className={styles.pjNota}>
              {filasSinHsMaquina === 1
                ? '1 fila sin hs máquina no entra en la variación'
                : `${filasSinHsMaquina} filas sin hs máquina no entran en la variación`}
            </p>
          )}
        </>
      )}
    </div>
  )
}
