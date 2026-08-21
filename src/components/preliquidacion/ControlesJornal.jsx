import { useState, useEffect } from 'react'
import styles from '../../pages/Verificacion.module.css'

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

export function PlantasJornal({ data, onGuardar, guardando }) {
  const filas = data?.filas || []
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
              <th>Cliente</th><th>Finca</th><th>Tarea</th>
              <th className="mono">Precio pagado</th><th className="mono">Un</th><th className="mono">Hs</th>
              <th className="mono">Plantas/Hsm</th><th className="mono">Plantas/Hsm×8</th><th className="mono">Prom Jornal</th>
              <th className="mono">Jornadas</th><th className="mono">Jornal tractorista</th>
              <th className="mono">%Dif</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
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

export function TancadasJornal({ data, onGuardar, guardando }) {
  const filas = data?.filas || []
  const totales = data?.totales

  const fmt = (n) => n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const fmtMoney = (n) => n == null ? '—' : `$${n.toLocaleString('es-AR')}`
  // DIFF viene como ratio crudo; se muestra en %. Positivo = tancada más caro.
  const fmtPct = (d) => d == null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

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
        <div className={styles.pjTableWrap}>
          <table className={styles.pjTable}>
            <thead>
              <tr>
                <th>Cliente</th><th>Finca</th><th>Tarea</th>
                <th className="mono">Tancadas</th><th className="mono">Hs jornal</th><th className="mono">Hs máquina</th>
                <th className="mono">Valor s/jornal</th><th className="mono">Precio pagado</th><th className="mono">Valor s/tancada</th><th className="mono">Diff</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  <td>{f.nombre_cliente}</td><td>{f.nombre_finca}</td><td>{f.nombre_tarea}</td>
                  <td className="mono">{fmt(f.tancadas)}</td>
                  <td className="mono">{fmt(f.hsjornal)}</td>
                  <td className="mono">{fmt(f.hsmaquina)}</td>
                  <td className="mono">{fmtMoney(f.valor_jornal)}</td>
                  <td className="mono">{fmt(f.precio)}</td>
                  <td className="mono">{fmtMoney(f.valor_tancada)}</td>
                  <td className={`mono ${f.diff != null && f.diff > 0 ? styles.pjAlto : ''}`}>{fmtPct(f.diff)}</td>
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
                  <td className="mono">{fmtMoney(totales.valor_jornal)}</td>
                  <td className="mono">{fmt(totales.precio)}</td>
                  <td className="mono">{fmtMoney(totales.valor_tancada)}</td>
                  <td className={`mono ${totales.diff != null && totales.diff > 0 ? styles.pjAlto : ''}`}>{fmtPct(totales.diff)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
