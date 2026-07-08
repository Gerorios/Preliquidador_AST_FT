import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarLineas, obtenerEstadisticas,
  actualizarLinea, eliminarConcepto,
  listarPreliquidaciones, aplicar,
  buscarConceptosParaCombo, agregarConceptoMasivo, eliminarConceptoMasivo,
  legajosPorCuil, reasignarEmpresaMasivo,
} from '../services/preliquidacion'
import PanelLinea from '../components/preliquidacion/PanelLinea'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import AlertasBanner from '../components/preliquidacion/AlertasBanner'
import CargandoContenido from '../components/layout/CargandoContenido'
import styles from './Revision.module.css'

function fmt(v) {
  if (v === null || v === undefined || v === '' || Number(v) === 0) return '—'
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

// ─── Liquidación masiva por persona ──────────────────────────────────────────

function LiquidacionPersona({ lineas, onCambio }) {
  const [busqPersona, setBusqPersona] = useState('')
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [codigoConcepto, setCodigoConcepto] = useState('')
  const [mostrarCombo, setMostrarCombo] = useState(false)
  const [gruposCuil, setGruposCuil] = useState(null)
  const [empresaPorGrupo, setEmpresaPorGrupo] = useState({})

  const { data: conceptosDisponibles = [] } = useQuery({
    queryKey: ['conceptos-combo'],
    queryFn: () => buscarConceptosParaCombo(''),
    enabled: mostrarCombo,
  })

  const { mutate: agregar, isPending: agregando } = useMutation({
    mutationFn: () => {
      const codigo = parseInt(codigoConcepto)
      if (!codigo || isNaN(codigo)) throw new Error('Seleccioná un concepto')
      return agregarConceptoMasivo([...seleccionadas], codigo)
    },
    onSuccess: () => {
      toast.success('Concepto agregado a las líneas seleccionadas')
      setCodigoConcepto('')
      setMostrarCombo(false)
      setSeleccionadas(new Set())
      onCambio()
    },
    onError: err => toast.error(err.message),
  })

  const { mutate: eliminar, isPending: eliminando } = useMutation({
    mutationFn: (codigo) => eliminarConceptoMasivo([...seleccionadas], codigo),
    onSuccess: () => {
      toast.success('Concepto eliminado de las líneas seleccionadas')
      setSeleccionadas(new Set())
      onCambio()
    },
    onError: err => toast.error(err.message),
  })

  const { mutate: abrirReasignar, isPending: cargandoGrupos } = useMutation({
    mutationFn: () => legajosPorCuil([...seleccionadas]),
    onSuccess: (data) => {
      if (data.grupos.length === 0) {
        toast.error('Ninguna de las líneas seleccionadas tiene CUIL — reasignalas a mano')
        return
      }
      setGruposCuil(data)
      setEmpresaPorGrupo({})
    },
    onError: err => toast.error(err.message),
  })

  const { mutate: confirmarReasignacion, isPending: reasignando } = useMutation({
    mutationFn: async () => {
      const pendientes = gruposCuil.grupos.filter(g => empresaPorGrupo[g.cuil])
      for (const g of pendientes) {
        await reasignarEmpresaMasivo(g.linea_ids, empresaPorGrupo[g.cuil])
      }
    },
    onSuccess: () => {
      toast.success('Empresa reasignada')
      setGruposCuil(null)
      setEmpresaPorGrupo({})
      setSeleccionadas(new Set())
      onCambio()
    },
    onError: err => toast.error(err.message),
  })

  const empleados = useMemo(() => {
    const map = {}
    for (const l of lineas) {
      const legajo = l.legajo_asignado || l.legajo_campo || ''
      if (!map[legajo]) map[legajo] = { legajo, nombre_empleado: l.nombre_empleado, empresa_asignada: l.empresa_asignada, lineas: [] }
      map[legajo].lineas.push(l)
    }
    return Object.values(map).sort((a,b) => (a.nombre_empleado||'').localeCompare(b.nombre_empleado||''))
  }, [lineas])

  const empleadosFiltrados = useMemo(() => {
    if (!busqPersona) return empleados
    const q = busqPersona.toLowerCase()
    return empleados.filter(e => e.nombre_empleado?.toLowerCase().includes(q) || e.legajo?.toLowerCase().includes(q))
  }, [empleados, busqPersona])

  const persona = personaSeleccionada ? empleados.find(e => e.legajo === personaSeleccionada) : null

  const conceptosEnSeleccion = useMemo(() => {
    if (!persona) return []
    const lineasSel = persona.lineas.filter(l => seleccionadas.has(l.id))
    const mapa = {}
    for (const l of lineasSel) {
      for (const c of (l.conceptos || [])) {
        const codigo = c.codigo_concepto ?? c.codigo
        if (codigo == null) continue
        if (!mapa[codigo]) mapa[codigo] = { codigo, descripcion: c.descripcion, count: 0 }
        mapa[codigo].count++
      }
    }
    return Object.values(mapa)
  }, [persona, seleccionadas, lineas])

  const toggleLinea = (id) => setSeleccionadas(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const toggleTodas = () => {
    if (!persona) return
    const todos = persona.lineas.map(l => l.id)
    const todasSel = todos.every(id => seleccionadas.has(id))
    setSeleccionadas(todasSel ? new Set() : new Set(todos))
  }

  const liqStyles = {
    wrap:      { padding: '0 16px 16px', overflow: 'auto', flex: 1 },
    lista:     { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 },
    card:      { border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg-surface)' },
    nombre:    { fontWeight: 600, fontSize: 13 },
    sub:       { fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 },
    acciones:  { background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  }

  if (!personaSeleccionada) {
    return (
      <div style={liqStyles.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Liquidación masiva — seleccioná un empleado</span>
          <input
            className="input"
            style={{ width: 280, marginLeft: 'auto' }}
            placeholder="Buscar por nombre o legajo..."
            value={busqPersona}
            onChange={e => setBusqPersona(e.target.value)}
            autoFocus
          />
        </div>
        <div style={liqStyles.lista}>
          {empleadosFiltrados.map(emp => (
            <div key={emp.legajo} style={liqStyles.card} onClick={() => { setPersonaSeleccionada(emp.legajo); setSeleccionadas(new Set()) }}>
              <div>
                <span style={liqStyles.nombre}>{emp.nombre_empleado || '—'}</span>
                <span style={liqStyles.sub}>legajo {emp.legajo || '—'}</span>
                <span className="badge badge-muted" style={{ marginLeft: 8 }}>{emp.empresa_asignada || '—'}</span>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.lineas.length} líneas →</span>
            </div>
          ))}
          {empleadosFiltrados.length === 0 && <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 12 }}>Sin resultados.</div>}
        </div>
      </div>
    )
  }

  if (!persona) return null

  const importe_total = persona.lineas.reduce((s, l) => s + Number(l.importe_total || 0), 0)
  const dias = new Set(persona.lineas.map(l => l.fecha_tarea).filter(Boolean)).size
  const cantSel = seleccionadas.size

  return (
    <div style={liqStyles.wrap}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => { setPersonaSeleccionada(null); setSeleccionadas(new Set()) }}>← Volver</button>
        <span style={liqStyles.nombre}>{persona.nombre_empleado}</span>
        <span style={liqStyles.sub}>legajo {persona.legajo}</span>
        <span className="badge badge-muted">{persona.empresa_asignada}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          <span style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Días </span><strong>{dias}</strong></span>
          <span style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Total </span><strong>${importe_total.toLocaleString('es-AR')}</strong></span>
        </div>
      </div>

      {cantSel > 0 && (
        <div style={liqStyles.acciones}>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{cantSel} línea{cantSel > 1 ? 's' : ''} seleccionada{cantSel > 1 ? 's' : ''}</span>
          {!mostrarCombo ? (
            <button className="btn btn-primary btn-sm" onClick={() => setMostrarCombo(true)}>+ Agregar concepto</button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select className="input" style={{ width: 220 }} value={codigoConcepto} onChange={e => setCodigoConcepto(e.target.value)} autoFocus>
                <option value="">— Seleccionar concepto —</option>
                {conceptosDisponibles.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.tipo}</option>)}
              </select>
              <button className="btn btn-primary btn-sm" onClick={() => agregar()} disabled={!codigoConcepto || isNaN(parseInt(codigoConcepto)) || agregando}>
                {agregando ? <span className="spinner" /> : 'Aplicar'}
              </button>
              <button className="btn btn-sm" onClick={() => { setMostrarCombo(false); setCodigoConcepto('') }}>Cancelar</button>
            </div>
          )}
          {conceptosEnSeleccion.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 8 }}>
              {conceptosEnSeleccion.map(c => (
                <button key={`quitar-${c.codigo}`} className="btn btn-sm btn-danger" onClick={() => eliminar(c.codigo)} disabled={eliminando}>
                  {eliminando ? <span className="spinner" /> : `✕ Quitar cód. ${c.codigo} (${c.count})`}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-sm" onClick={() => abrirReasignar()} disabled={cargandoGrupos}>
            {cargandoGrupos ? <span className="spinner" /> : '⇄ Reasignar empresa'}
          </button>
        </div>
      )}

      {gruposCuil && (
        <div style={{ ...liqStyles.acciones, flexDirection: 'column', alignItems: 'stretch', background: 'var(--info-dim)', borderColor: 'var(--info)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)' }}>Reasignar empresa — un bloque por persona (CUIL)</span>
          {gruposCuil.sin_cuil.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--warn)' }}>
              ⚠ {gruposCuil.sin_cuil.length} línea{gruposCuil.sin_cuil.length > 1 ? 's' : ''} sin CUIL — no se pueden reasignar así, editalas a mano.
            </span>
          )}
          {gruposCuil.grupos.map(g => (
            <div key={g.cuil} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 12, minWidth: 200 }}>
                {g.nombre_empleado || '—'} <span style={{ color: 'var(--text-muted)' }}>({g.linea_ids.length} líneas)</span>
              </span>
              <select
                className="input"
                style={{ width: 240 }}
                value={empresaPorGrupo[g.cuil] || ''}
                onChange={e => setEmpresaPorGrupo(prev => ({ ...prev, [g.cuil]: e.target.value }))}
              >
                <option value="">— Elegir empresa —</option>
                {g.legajos_disponibles.map(o => (
                  <option key={o.empresa} value={o.empresa}>{o.empresa} (legajo {o.legajo})</option>
                ))}
              </select>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => confirmarReasignacion()}
              disabled={reasignando || !Object.values(empresaPorGrupo).some(Boolean)}
            >
              {reasignando ? <span className="spinner" /> : 'Confirmar reasignación'}
            </button>
            <button className="btn btn-sm" onClick={() => { setGruposCuil(null); setEmpresaPorGrupo({}) }}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 320px)', overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" style={{ width: 'var(--control-size)', height: 'var(--control-size)' }} checked={persona.lineas.length > 0 && persona.lineas.every(l => seleccionadas.has(l.id))} onChange={toggleTodas} />
              </th>
              <th>Fecha</th><th>Tarea</th><th>Cliente · Finca</th><th>Hs.jorn</th><th>Importe</th><th>Conceptos</th>
            </tr>
          </thead>
          <tbody>
            {persona.lineas.map(l => (
              <tr key={l.id} onClick={() => toggleLinea(l.id)} style={{ cursor: 'pointer', background: seleccionadas.has(l.id) ? 'var(--accent-glow)' : undefined }}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" style={{ width: 'var(--control-size)', height: 'var(--control-size)' }} checked={seleccionadas.has(l.id)} onChange={() => toggleLinea(l.id)} />
                </td>
                <td className="mono" style={{ fontSize: 11 }}>{l.fecha_tarea || '—'}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nombre_tarea}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.nombre_cliente} · {l.nombre_finca}</td>
                <td className="mono">{l.hsjornal || '—'}</td>
                <td className="mono">${Number(l.importe_total || 0).toLocaleString('es-AR')}</td>
                <td>
                  {(l.conceptos || []).length > 0
                    ? <span className="badge badge-info">+{l.conceptos.length}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function Revision() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [filtros, setFiltros] = useState({})
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [modoLiquidacion, setModoLiquidacion] = useState(false)

  const { data: preliqData } = useQuery({
    queryKey: ['preliq', id],
    queryFn: () => listarPreliquidaciones().then(list =>
      list.find(p => String(p.id) === String(id))
    ),
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => obtenerEstadisticas(id),
    refetchInterval: 10_000,
  })

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['lineas', id, filtros],
    queryFn: () => listarLineas(id, filtros),
  })

  const lineasFiltradas = useMemo(() => {
    let resultado = lineas
    if (busqueda) {
      const q = busqueda.toLowerCase()
      resultado = resultado.filter(l =>
        l.nombre_empleado?.toLowerCase().includes(q) ||
        l.legajo_campo?.toLowerCase().includes(q) ||
        l.legajo_asignado?.toLowerCase().includes(q) ||
        l.nombre_tarea?.toLowerCase().includes(q) ||
        l.nombre_cliente?.toLowerCase().includes(q) ||
        l.nombre_finca?.toLowerCase().includes(q)
      )
    }
    if (filtros.cliente)    resultado = resultado.filter(l => l.nombre_cliente === filtros.cliente)
    if (filtros.finca)      resultado = resultado.filter(l => l.nombre_finca === filtros.finca)
    if (filtros.tarea)      resultado = resultado.filter(l => l.nombre_tarea === filtros.tarea)
    if (filtros.empresa)    resultado = resultado.filter(l => l.empresa_asignada === filtros.empresa)
    if (filtros.grupo_pago) resultado = resultado.filter(l => l.grupo_pago_aplicado === filtros.grupo_pago)
    if (filtros.supervisor) resultado = resultado.filter(l => l.nombre_supervisor === filtros.supervisor)
    if (filtros.alerta === 'incompleta')     resultado = resultado.filter(l => l.linea_incompleta)
    if (filtros.alerta === 'alerta_legajo')  resultado = resultado.filter(l => l.alerta_legajo)
    if (filtros.alerta === 'alerta_empresa') resultado = resultado.filter(l => l.alerta_empresa)
    if (filtros.alerta === 'es_duplicado')   resultado = resultado.filter(l => l.es_duplicado)
    return resultado
  }, [lineas, busqueda, filtros])

  const refrescarYSincronizarPanel = async () => {
    await qc.refetchQueries({ queryKey: ['lineas', id], exact: false })
    const lineasFrescas = qc.getQueryData(['lineas', id, filtros])
    if (lineasFrescas && lineaSeleccionada) {
      const lineFresca = lineasFrescas.find(l => l.id === lineaSeleccionada.id)
      if (lineFresca) setLineaSeleccionada(lineFresca)
    }
    qc.invalidateQueries(['stats', id])
  }

  const { mutate: aplicarTodo, isPending: aplicandoTodo } = useMutation({
    mutationFn: () => aplicar(id),
    onSuccess: async (data) => {
      toast.success(data.detalle || 'Precios y conceptos aplicados')
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: guardar, isPending: guardando } = useMutation({
    mutationFn: ({ lineaId, datos }) => actualizarLinea(lineaId, datos),
    onSuccess: async (data) => {
      toast.success('Línea actualizada')
      setLineaSeleccionada(data)
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleConceptoAgregado = async () => {
    toast.success('Concepto agregado')
    await refrescarYSincronizarPanel()
  }

  const { mutate: delConcepto } = useMutation({
    mutationFn: (conceptoId) => eliminarConcepto(conceptoId),
    onSuccess: async () => {
      toast.success('Concepto eliminado')
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const claseLinea = (linea) => {
    if (linea.es_duplicado) return 'duplicado'
    if (linea.linea_incompleta) return 'alerta'
    if (linea.alerta_legajo || linea.alerta_empresa) return 'alerta'
    return ''
  }

  const iconoAlerta = (linea) => {
    if (linea.es_duplicado)     return { label: 'DUPLICADO', badge: 'badge-danger' }
    if (linea.linea_incompleta) return { label: 'INCOMPLETA', badge: 'badge-warn' }
    if (linea.alerta_legajo)    return { label: 'LEGAJO', badge: 'badge-warn' }
    if (linea.alerta_empresa)   return { label: 'EMPRESA', badge: 'badge-info' }
    return null
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className="btn btn-sm" onClick={() => navigate('/dashboard')}>← Volver</button>
        <div className={styles.topbarInfo}>
          {stats && (
            <>
              <span className="badge badge-muted mono">{stats.total_lineas} líneas</span>
              {stats.lineas_con_alerta > 0 &&
                <span className="badge badge-warn mono">{stats.lineas_con_alerta} alertas</span>}
            </>
          )}
        </div>
        <button className="btn btn-sm" onClick={() => { setModoLiquidacion(m => !m); setLineaSeleccionada(null) }}>
          {modoLiquidacion ? '← Volver a tabla' : '⊞ Liquidación masiva'}
        </button>
        <button className="btn btn-sm" onClick={() => aplicarTodo()} disabled={aplicandoTodo || modoLiquidacion}>
          {aplicandoTodo ? <><span className="spinner" /> Aplicando...</> : '↻ Aplicar'}
        </button>
        <button className="btn btn-primary btn-sm">↓ Exportar Excel</button>
      </div>

      {/* Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {stats?.incompletas > 0 && (
          <AlertasBanner
            mensaje={<><strong>{stats.incompletas} líneas incompletas</strong> — cargá los conceptos y precios en el maestro</>}
            ctaLabel="Ir a Conceptos →"
            ctaSubrayada={false}
            onFiltrar={() => navigate('/conceptos')}
          />
        )}
        {stats?.lineas_con_alerta > 0 && stats?.incompletas === 0 && (
          <AlertasBanner
            total={stats.lineas_con_alerta}
            incompletas={stats.incompletas}
            duplicados={stats.duplicados}
            alertaLegajo={stats.alerta_legajo}
            onFiltrar={() => setFiltros(f => ({ ...f, solo_alertas: true }))}
          />
        )}
      </div>

      {modoLiquidacion && (
        <LiquidacionPersona lineas={lineas} onCambio={refrescarYSincronizarPanel} />
      )}

      <div className={styles.layout} style={{ display: modoLiquidacion ? 'none' : undefined }}>
        {/* Tabla */}
        <div className={styles.tablePane}>
          <FiltrosBar
            lineas={lineas}
            filtros={filtros}
            onChange={setFiltros}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
          />

          {isLoading ? (
            <CargandoContenido texto="Cargando líneas…" />
          ) : (
            <div className="table-wrap" style={{ flex: 1, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>FECHA</th>
                    <th>EMPLEADO</th>
                    <th>LEGAJO</th>
                    <th>EMPRESA</th>
                    <th>TAREA</th>
                    <th>CLIENTE · FINCA</th>
                    <th>GRUPO PAGO</th>
                    <th title="Horas jornal">HS. JORN.</th>
                    <th title="Horas máquina">HS. MAQ.</th>
                    <th title="Tancadas">TANC.</th>
                    <th title="Unidades / plantas / bins">UNID.</th>
                    <th>IMPORTE</th>
                    <th>CONCEPTOS</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasFiltradas.map(linea => (
                    <tr
                      key={linea.id}
                      className={claseLinea(linea)}
                      onClick={() => setLineaSeleccionada(linea)}
                      style={lineaSeleccionada?.id === linea.id
                        ? { outline: '1px solid var(--accent)', outlineOffset: '-1px' }
                        : {}}
                    >
                      <td>
                        {(() => { const a = iconoAlerta(linea); return a ? (
                          <span className={`badge ${a.badge}`}>{a.label}</span>
                        ) : null })()}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {linea.fecha_tarea || '—'}
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linea.nombre_empleado || '—'}
                      </td>
                      <td className="mono">{linea.legajo_asignado || linea.legajo_campo}</td>
                      <td><span className="badge badge-muted">{linea.empresa_asignada || '—'}</span></td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linea.nombre_tarea || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {linea.nombre_cliente} · {linea.nombre_finca}
                      </td>
                      <td>
                        {linea.linea_incompleta
                          ? <span className="badge badge-warn">INCOMPLETA</span>
                          : <span className="badge badge-muted mono">{linea.grupo_pago_aplicado || '—'}</span>}
                      </td>
                      <td className="mono">{fmt(linea.hsjornal)}</td>
                      <td className="mono">{fmt(linea.hsmaquina)}</td>
                      <td className="mono">{fmt(linea.tancadas)}</td>
                      <td className="mono">{fmt(linea.unidades)}</td>
                      <td className="mono" style={{ fontWeight: 500 }}>
                        {linea.importe_total ? `$${Number(linea.importe_total).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {linea.conceptos?.length > 0
                          ? <span className="badge badge-info">+{linea.conceptos.length}</span>
                          : '—'}
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }} aria-hidden="true">›</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lineasFiltradas.length === 0 && (
                <div className={styles.empty}>Sin resultados para los filtros aplicados.</div>
              )}
            </div>
          )}
        </div>

        {/* Panel lateral de línea */}
        {lineaSeleccionada && (
          <PanelLinea
            linea={lineaSeleccionada}
            quincena={preliqData?.quincena}
            onGuardar={(datos) => guardar({ lineaId: lineaSeleccionada.id, datos })}
            onConceptoAgregado={handleConceptoAgregado}
            onEliminarConcepto={(conceptoId) => delConcepto(conceptoId)}
            onCerrar={() => setLineaSeleccionada(null)}
            guardando={guardando}
          />
        )}
      </div>
    </div>
  )
}