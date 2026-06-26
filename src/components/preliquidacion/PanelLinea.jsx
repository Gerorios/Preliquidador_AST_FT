import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listarGruposPago, listarEmpresas, agregarConceptoPorCodigo, buscarConceptosParaCombo } from '../../services/preliquidacion'
import styles from './PanelLinea.module.css'

// Las empresas se cargan dinámicamente desde nuempleados
const TIPOS_CONCEPTO = ['REMUNERATIVO', 'NO_REMUNERATIVO', 'JORNAL', 'OTRO']

export default function PanelLinea({
  linea, onGuardar, onEliminarConcepto, onCerrar, onConceptoAgregado, guardando
}) {
  const [form, setForm] = useState({})
  const [codigoConcepto, setCodigoConcepto] = useState('')
  const [mostrarConcepto, setMostrarConcepto] = useState(false)
  const [agregandoConcepto, setAgregandoConcepto] = useState(false)
  const [errorConcepto, setErrorConcepto] = useState('')
  // Conceptos agregados en esta sesión del panel que todavía no llegaron
  // por la prop `linea` (el refetch del padre es async). Se muestran al
  // instante apenas el servidor confirma la creación, sin esperar el
  // round-trip de refetch. Cuando `linea.conceptos` ya los incluye
  // (mismo id), se descartan del estado local para no duplicar.
  const [conceptosOptimistas, setConceptosOptimistas] = useState([])

  const { data: gruposPago = [] } = useQuery({
    queryKey: ['grupos-pago'],
    queryFn: listarGruposPago,
    staleTime: Infinity,
  })

  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas'],
    queryFn: listarEmpresas,
    staleTime: Infinity,
  })

  useEffect(() => {
    setForm({
      empresa_asignada:    linea.empresa_asignada || 'ASTURIANA',
      legajo_asignado:     linea.legajo_asignado || linea.legajo_campo || '',
      grupo_pago_aplicado: linea.grupo_pago_aplicado || '',
      precio_b:            linea.precio_b || '',
      precio_usado:        linea.precio_usado || 'A',
      revisado:            linea.revisado || false,
      observacion:         linea.observacion || '',
    })
    setMostrarConcepto(false)
    setCodigoConcepto('')
    setErrorConcepto('')
    setConceptosOptimistas([])
  }, [linea.id])

  // Apenas `linea.conceptos` (que viene del padre, actualizado por refetch)
  // ya trae un concepto que habíamos agregado de forma optimista, lo
  // sacamos del estado local para no mostrarlo duplicado.
  useEffect(() => {
    if (conceptosOptimistas.length === 0) return
    const idsReales = new Set((linea.conceptos || []).map(c => c.id))
    setConceptosOptimistas(prev => prev.filter(c => !idsReales.has(c.id)))
  }, [linea.conceptos])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const buildPayload = (extra = {}) => {
    const datos = { ...form, ...extra }
    if (!datos.precio_b) datos.precio_b = null
    else datos.precio_b = parseFloat(datos.precio_b)
    return datos
  }

  const handleGuardar = () => onGuardar(buildPayload())
  const handleMarcarRevisada = () => onGuardar(buildPayload({ revisado: true }))

  // Todos los conceptos de la línea: los confirmados por el servidor (vía
  // prop, ya actualizados) + los optimistas que todavía no llegaron por ahí.
  const conceptosLinea = [...(linea.conceptos || []), ...conceptosOptimistas]

  const { data: conceptosDisponibles = [] } = useQuery({
    queryKey: ['conceptos-combo'],
    queryFn: () => buscarConceptosParaCombo(''),
    enabled: mostrarConcepto,
  })

  const handleAgregarPorCodigo = async (codigoForzado) => {
    const codigo = codigoForzado ?? codigoConcepto
    if (!codigo) return
    setAgregandoConcepto(true)
    setErrorConcepto('')
    try {
      const conceptoCreado = await agregarConceptoPorCodigo(linea.id, parseInt(codigo))
      // Mostrarlo en la lista al instante, sin esperar el refetch del padre
      setConceptosOptimistas(prev => [...prev, conceptoCreado])
      setCodigoConcepto('')
      setMostrarConcepto(false)
      onConceptoAgregado?.()
    } catch (err) {
      setErrorConcepto(err.message || 'No se pudo agregar el concepto')
    } finally {
      setAgregandoConcepto(false)
    }
  }

  const importeTotal = conceptosLinea.reduce((s, c) => s + Number(c.importe || 0), 0)

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelNombre}>{linea.nombre_empleado || '—'}</div>
        <div className={styles.panelSub}>{linea.nombre_tarea} · {linea.nombre_cliente}</div>
        {linea.fecha_tarea && (
          <div className={styles.panelFecha}>{linea.fecha_tarea}</div>
        )}
        <button className={styles.closeBtn} onClick={onCerrar}>✕</button>
      </div>

      <div className={styles.panelBody}>

        {/* Alertas */}
        {(linea.es_duplicado || linea.alerta_legajo || linea.alerta_sin_precio) && (
          <div className={styles.alertaBox}>
            {linea.es_duplicado     && <div className={styles.alertaItem}>⚠ Línea duplicada</div>}
            {linea.alerta_legajo    && <div className={styles.alertaItem}>⚠ Legajo no validado</div>}
            {linea.alerta_sin_precio && <div className={styles.alertaItem}>⚠ Sin precio asignado</div>}
          </div>
        )}

        {/* Datos de campo */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>DATOS DE CAMPO</div>
          <div className={styles.dataGrid}>
            <DataRow label="Fecha"        value={linea.fecha_tarea} />
            <DataRow label="Planilla"     value={linea.planilla} />
            <DataRow label="Legajo campo" value={linea.legajo_campo} mono />
            <DataRow label="Hs. jornal"   value={fmt(linea.hsjornal)} mono />
            <DataRow label="Hs. máquina"  value={fmt(linea.hsmaquina)} mono />
            <DataRow label="Tancadas"     value={fmt(linea.tancadas)} mono />
            <DataRow label="Unidades"     value={fmt(linea.unidades)} mono />
            <DataRow label="Supervisor"   value={linea.nombre_supervisor} />
            <DataRow label="Tractor"      value={linea.nombre_tractor} />
          </div>
        </div>

        <hr className="divider" />

        {/* Asignación */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>ASIGNACIÓN</div>
          <div className="field-label">Empresa</div>
          <div className={styles.radioRow}>
            {empresas.map(e => (
              <button
                key={e}
                className={`${styles.radioBtn} ${form.empresa_asignada === e ? styles.radioBtnSel : ''}`}
                onClick={() => set('empresa_asignada', e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="field-label" style={{ marginTop: 10 }}>Legajo asignado</div>
          <input
            className="input input-mono"
            value={form.legajo_asignado || ''}
            onChange={e => set('legajo_asignado', e.target.value)}
          />
        </div>

        <hr className="divider" />

        {/* Precio */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>PRECIO</div>
          <div className="field-label">Grupo de pago</div>
          <select
            className="input input-mono"
            value={form.grupo_pago_aplicado || ''}
            onChange={e => set('grupo_pago_aplicado', e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {gruposPago.map(gp => (
              <option key={gp} value={gp}>{gp}</option>
            ))}
          </select>
        </div>

        <hr className="divider" />

        {/* Conceptos de liquidación (automáticos + manuales) */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>CONCEPTOS DE LIQUIDACIÓN</div>
          {conceptosLinea.length > 0 ? (
            <div className={styles.conceptoList}>
              {conceptosLinea.map(c => (
                <div key={c.id} className={styles.conceptoRow}>
                  <span className="badge badge-muted mono" style={{ fontSize: 9 }}>
                    {c.codigo_concepto != null ? `Cód. ${c.codigo_concepto}` : c.tipo}
                  </span>
                  <span className={styles.conceptoDesc}>
                    {c.descripcion}
                    {c.ingresado_por == null && (
                      <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--text-muted)' }}>(auto)</span>
                    )}
                  </span>
                  <span className={styles.conceptoImporte}>
                    ${Number(c.importe).toLocaleString('es-AR')}
                  </span>
                  <button className={styles.conceptoDel} onClick={() => onEliminarConcepto(c.id)}>✕</button>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.conceptoEmpty}>Sin conceptos de liquidación</div>
          )}

          {mostrarConcepto ? (
            <div className={styles.conceptoForm}>
              <div className="field-label">Buscar por código o tipo</div>
              <select
                className="input"
                value={codigoConcepto}
                onChange={e => setCodigoConcepto(e.target.value)}
                autoFocus
              >
                <option value="">— Seleccionar concepto —</option>
                {conceptosDisponibles.map(c => (
                  <option key={c.codigo} value={c.codigo}>
                    {c.codigo} — {c.tipo}
                  </option>
                ))}
              </select>
              {errorConcepto && (
                <div style={{ fontSize: 11, color: 'var(--danger)' }}>{errorConcepto}</div>
              )}
              <div className={styles.conceptoFormBtns}>
                <button className="btn btn-sm" onClick={() => { setMostrarConcepto(false); setErrorConcepto(''); setCodigoConcepto('') }}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAgregarPorCodigo()}
                  disabled={!codigoConcepto || agregandoConcepto}
                >
                  {agregandoConcepto ? <span className="spinner" /> : 'Agregar'}
                </button>

              </div>
            </div>
          ) : (
            <button className={styles.addConcepto} onClick={() => setMostrarConcepto(true)}>
              + Agregar concepto por código
            </button>
          )}
        </div>

        <hr className="divider" />

        {/* Desglose e importe total */}
        <div className={styles.section}>
          <div className="field-label">Desglose</div>
          {conceptosLinea.map(c => (
            <div key={c.id} className={styles.desgloseRow}>
              <span>{c.descripcion}</span>
              <span className="mono">${Number(c.importe).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
            </div>
          ))}
          <div className={styles.importeTotal}>
            ${importeTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Observación */}
        <div className={styles.section}>
          <div className="field-label">Observación</div>
          <input
            className="input"
            placeholder="Opcional..."
            value={form.observacion || ''}
            onChange={e => set('observacion', e.target.value)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={styles.panelFooter}>
        <button className="btn" style={{ flex: 1 }} onClick={handleGuardar} disabled={guardando}>
          {guardando ? <span className="spinner" /> : 'Guardar'}
        </button>
        <button
          className={`btn ${linea.revisado ? '' : 'btn-primary'}`}
          style={{ flex: 2 }}
          onClick={handleMarcarRevisada}
          disabled={guardando}
        >
          {linea.revisado ? '✓ Revisada' : 'Marcar como revisada'}
        </button>
      </div>
    </div>
  )
}


function fmt(v) {
  if (v === null || v === undefined || Number(v) === 0) return '—'
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

function DataRow({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{label}</span>
      <span style={{ fontFamily: mono ? 'var(--font-mono)' : 'inherit', fontSize: 11 }}>
        {value ?? '—'}
      </span>
    </div>
  )
}