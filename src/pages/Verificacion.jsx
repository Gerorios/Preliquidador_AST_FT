import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarLineas, listarPreliquidaciones,
  buscarConceptosParaCombo,
  agregarConceptoMasivo, eliminarConceptoMasivo,
} from '../services/preliquidacion'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import styles from './Verificacion.module.css'

const SECCIONES = [
  { key: 'horas', label: '⏱ Horas excedidas', umbral: '> 13 hs/día' },
  { key: 'tancadas', label: '📦 Tancadas excedidas', umbral: '> 35/día' },
  { key: 'plantas', label: '🌱 Plantas excedidas', umbral: '> 6.000/día' },
  { key: 'empleados', label: '👤 Resumen por empleado', umbral: 'importe · días · $/día' },
  { key: 'plantas-jornal', label: '📊 Plantas vs Jornal', umbral: 'rendimiento por tarea' },
  { key: 'liquidacion', label: '✏ Liquidación por persona', umbral: 'ajuste masivo de conceptos' },
]

const UMBRAL_PROM_JORNAL_ALTO = 50000

function calcularExcesos(lineas) {
  const porEmpleadoFecha = {}
  for (const l of lineas) {
    const legajo = l.legajo_asignado || l.legajo_campo || ''
    const fecha = l.fecha_tarea || ''
    const clave = `${legajo}__${fecha}`
    if (!porEmpleadoFecha[clave]) {
      porEmpleadoFecha[clave] = {
        legajo, fecha, nombre_empleado: l.nombre_empleado,
        hsjornal: 0, tancadas: 0, plantas: 0, lineas: [],
      }
    }
    const g = porEmpleadoFecha[clave]
    g.hsjornal += Number(l.hsjornal || 0)
    g.tancadas += Number(l.tancadas || 0)
    if ((l.grupo_pago_aplicado || '').trim().toUpperCase() === 'PLANTA')
      g.plantas += Number(l.unidades || 0)
    g.lineas.push({
      id: l.id, nombre_tarea: l.nombre_tarea,
      nombre_cliente: l.nombre_cliente, nombre_finca: l.nombre_finca,
      hsjornal: Number(l.hsjornal || 0), tancadas: Number(l.tancadas || 0), unidades: Number(l.unidades || 0),
    })
  }
  const grupos = Object.values(porEmpleadoFecha)
  return {
    excesoHoras: grupos.filter(g => g.hsjornal > 13).map(g => ({ ...g, valor: g.hsjornal })).sort((a,b) => b.valor - a.valor),
    excesoTancadas: grupos.filter(g => g.tancadas > 35).map(g => ({ ...g, valor: g.tancadas })).sort((a,b) => b.valor - a.valor),
    excesoPlantas: grupos.filter(g => g.plantas > 6000).map(g => ({ ...g, valor: g.plantas })).sort((a,b) => b.valor - a.valor),
  }
}

function calcularResumenEmpleados(lineas) {
  const porEmpleado = {}
  for (const l of lineas) {
    const legajo = l.legajo_asignado || l.legajo_campo || ''
    if (!porEmpleado[legajo]) {
      porEmpleado[legajo] = {
        legajo, nombre_empleado: l.nombre_empleado, empresa_asignada: l.empresa_asignada,
        importe_total: 0, fechas: new Set(), lineas: [],
      }
    }
    const emp = porEmpleado[legajo]
    emp.importe_total += Number(l.importe_total || 0)
    if (l.fecha_tarea) emp.fechas.add(l.fecha_tarea)
    emp.lineas.push({
      id: l.id, fecha_tarea: l.fecha_tarea, nombre_tarea: l.nombre_tarea,
      nombre_cliente: l.nombre_cliente, nombre_finca: l.nombre_finca,
      hsjornal: Number(l.hsjornal || 0), importe_total: Number(l.importe_total || 0),
    })
  }
  return Object.values(porEmpleado).map(emp => {
    const dias = emp.fechas.size
    return {
      ...emp, dias_trabajados: dias,
      importe_por_dia: dias ? Math.round((emp.importe_total / dias) * 100) / 100 : 0,
      lineas: emp.lineas.sort((a,b) => (a.fecha_tarea||'').localeCompare(b.fecha_tarea||'')),
    }
  }).sort((a,b) => b.importe_total - a.importe_total)
}

function calcularPlantasJornal(lineas) {
  const grupos = {}
  for (const l of lineas.filter(l => (l.grupo_pago_aplicado||'').trim().toUpperCase() === 'PLANTA')) {
    const clave = `${l.nombre_cliente||''}__${l.nombre_finca||''}__${l.nombre_tarea||''}`
    if (!grupos[clave]) grupos[clave] = { nombre_cliente: l.nombre_cliente, nombre_finca: l.nombre_finca, nombre_tarea: l.nombre_tarea, sumaPrecio: 0, cantidadPrecios: 0, unidades: 0, hs: 0 }
    const g = grupos[clave]
    if (l.precio_a != null) { g.sumaPrecio += Number(l.precio_a); g.cantidadPrecios++ }
    g.unidades += Number(l.unidades || 0)
    g.hs += Number(l.hsmaquina || 0)
  }
  const filas = Object.values(grupos).map(g => {
    const p = g.cantidadPrecios ? g.sumaPrecio / g.cantidadPrecios : 0
    const phsm = g.hs ? g.unidades / g.hs : 0
    return {
      nombre_cliente: g.nombre_cliente, nombre_finca: g.nombre_finca, nombre_tarea: g.nombre_tarea,
      precio_promedio: Math.round(p*100)/100, unidades: Math.round(g.unidades*100)/100, hs: Math.round(g.hs*100)/100,
      plantas_por_hsm: Math.round(phsm*100)/100, plantas_por_hsm_x8: Math.round(phsm*8*100)/100,
      prom_jornal: Math.round(phsm*8*p*100)/100,
    }
  }).sort((a,b) => (a.nombre_cliente||'').localeCompare(b.nombre_cliente||'') || (a.nombre_finca||'').localeCompare(b.nombre_finca||''))
  const tu = filas.reduce((s,f) => s+f.unidades, 0), th = filas.reduce((s,f) => s+f.hs, 0)
  const tp = filas.length ? filas.reduce((s,f) => s+f.precio_promedio, 0)/filas.length : 0
  const tphsm = th ? tu/th : 0
  return { filas, totales: { unidades: Math.round(tu*100)/100, hs: Math.round(th*100)/100, precio_promedio: Math.round(tp*100)/100, plantas_por_hsm: Math.round(tphsm*100)/100, plantas_por_hsm_x8: Math.round(tphsm*8*100)/100, prom_jornal: Math.round(tphsm*8*tp*100)/100 } }
}

export default function Verificacion() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [seccion, setSeccion] = useState('horas')
  const [expandido, setExpandido] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})

  const { data: preliqData } = useQuery({
    queryKey: ['preliq', id],
    queryFn: () => listarPreliquidaciones().then(list => list.find(p => String(p.id) === String(id))),
  })

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['lineas', id, {}],
    queryFn: () => listarLineas(id, {}),
  })

  const lineasFiltradas = useMemo(() => {
    let r = lineas
    if (filtros.cliente)    r = r.filter(l => l.nombre_cliente === filtros.cliente)
    if (filtros.finca)      r = r.filter(l => l.nombre_finca === filtros.finca)
    if (filtros.tarea)      r = r.filter(l => l.nombre_tarea === filtros.tarea)
    if (filtros.empresa)    r = r.filter(l => l.empresa_asignada === filtros.empresa)
    if (filtros.grupo_pago) r = r.filter(l => l.grupo_pago_aplicado === filtros.grupo_pago)
    if (filtros.supervisor) r = r.filter(l => l.nombre_supervisor === filtros.supervisor)
    return r
  }, [lineas, filtros])

  const { excesoHoras, excesoTancadas, excesoPlantas } = useMemo(() => calcularExcesos(lineasFiltradas), [lineasFiltradas])
  const resumenEmpleadosCompleto = useMemo(() => calcularResumenEmpleados(lineasFiltradas), [lineasFiltradas])
  const plantasJornal = useMemo(() => calcularPlantasJornal(lineasFiltradas), [lineasFiltradas])

  const filtrarBusqueda = (lista) => {
    if (!busqueda) return lista
    const q = busqueda.toLowerCase()
    return lista.filter(item => item.nombre_empleado?.toLowerCase().includes(q) || item.legajo?.toLowerCase().includes(q))
  }

  const excesoHorasF = useMemo(() => filtrarBusqueda(excesoHoras), [excesoHoras, busqueda])
  const excesoTancadasF = useMemo(() => filtrarBusqueda(excesoTancadas), [excesoTancadas, busqueda])
  const excesoPlantasF = useMemo(() => filtrarBusqueda(excesoPlantas), [excesoPlantas, busqueda])
  const resumenEmpleados = useMemo(() => filtrarBusqueda(resumenEmpleadosCompleto), [resumenEmpleadosCompleto, busqueda])

  const refrescarLineas = () => qc.invalidateQueries({ queryKey: ['lineas', id] })

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <button className="btn btn-sm" onClick={() => navigate(`/revision/${id}`)}>← Volver a revisión</button>
        <div className={styles.titulo}>Verificación {preliqData?.quincena ? `· ${preliqData.quincena}` : ''}</div>
        {seccion !== 'plantas-jornal' && seccion !== 'liquidacion' && (
          <input className="input" style={{ width: 240, marginLeft: 'auto' }} placeholder="Buscar empleado o legajo..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
        )}
      </div>

      <FiltrosBar lineas={lineas} filtros={filtros} onChange={setFiltros} busqueda="" onBusqueda={() => {}} mostrarAlertas={false} />

      <div className={styles.nav}>
        {SECCIONES.map(s => {
          const cantidad = { horas: excesoHorasF.length, tancadas: excesoTancadasF.length, plantas: excesoPlantasF.length, empleados: resumenEmpleados.length, 'plantas-jornal': null, liquidacion: null }[s.key]
          return (
            <button key={s.key} className={`${styles.navItem} ${seccion === s.key ? styles.navItemActive : ''}`} onClick={() => setSeccion(s.key)}>
              <span className={styles.navLabel}>{s.label}</span>
              <span className={styles.navUmbral}>{s.umbral}</span>
              {cantidad != null && cantidad > 0 && <span className="badge badge-warn mono" style={{ marginLeft: 8 }}>{cantidad}</span>}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className={styles.loading}><span className="spinner" /> Cargando líneas...</div>
      ) : (
        <div className={styles.content}>
          {seccion === 'horas' && <ListaExceso titulo="Empleados con más de 13 horas jornal en un mismo día" items={excesoHorasF} unidad="hs" expandido={expandido} setExpandido={setExpandido} />}
          {seccion === 'tancadas' && <ListaExceso titulo="Empleados con más de 35 tancadas en un mismo día" items={excesoTancadasF} unidad="tancadas" expandido={expandido} setExpandido={setExpandido} />}
          {seccion === 'plantas' && <ListaExceso titulo="Empleados con más de 6.000 plantas en un mismo día" items={excesoPlantasF} unidad="plantas" expandido={expandido} setExpandido={setExpandido} />}
          {seccion === 'empleados' && <ResumenEmpleados items={resumenEmpleados} expandido={expandido} setExpandido={setExpandido} />}
          {seccion === 'plantas-jornal' && <PlantasJornal data={plantasJornal} />}
          {seccion === 'liquidacion' && <LiquidacionPersona lineas={lineasFiltradas} onCambio={refrescarLineas} />}
        </div>
      )}
    </div>
  )
}

// ─── Sección: Liquidación por persona ────────────────────────────────────────

function LiquidacionPersona({ lineas, onCambio }) {
  const [busqPersona, setBusqPersona] = useState('')
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [codigoConcepto, setCodigoConcepto] = useState('')
  const [mostrarCombo, setMostrarCombo] = useState(false)

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

  // Agrupar lineas por empleado
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

  // Conceptos únicos en las líneas seleccionadas
  const conceptosEnSeleccion = useMemo(() => {
    if (!persona) return []
    const lineasSel = persona.lineas.filter(l => seleccionadas.has(l.id))
    const mapa = {}
    for (const l of lineasSel) {
      for (const c of (l.conceptos || [])) {
        const codigo = c.codigo_concepto ?? c.codigo
        if (codigo == null || codigo === undefined) continue
        if (!mapa[codigo]) mapa[codigo] = { codigo, descripcion: c.descripcion, count: 0 }
        mapa[codigo].count++
      }
    }
    return Object.values(mapa)
  }, [persona, seleccionadas, lineas])

  const toggleLinea = (id) => setSeleccionadas(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const toggleTodas = () => {
    if (!persona) return
    const todos = persona.lineas.map(l => l.id)
    const todasSel = todos.every(id => seleccionadas.has(id))
    setSeleccionadas(todasSel ? new Set() : new Set(todos))
  }

  if (!personaSeleccionada) {
    return (
      <div>
        <div className={styles.seccionTitulo}>Liquidación por persona — seleccioná un empleado para ver y ajustar sus conceptos</div>
        <input
          className="input"
          style={{ width: 320, marginBottom: 12 }}
          placeholder="Buscar por nombre o legajo..."
          value={busqPersona}
          onChange={e => setBusqPersona(e.target.value)}
          autoFocus
        />
        <div className={styles.lista}>
          {empleadosFiltrados.map(emp => (
            <div key={emp.legajo} className={styles.card} style={{ cursor: 'pointer' }} onClick={() => { setPersonaSeleccionada(emp.legajo); setSeleccionadas(new Set()) }}>
              <div className={styles.cardHead}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardNombre}>{emp.nombre_empleado || '—'}</span>
                  <span className={styles.cardLegajo}>legajo {emp.legajo || '—'}</span>
                  <span className="badge badge-muted">{emp.empresa_asignada || '—'}</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.lineas.length} líneas →</span>
              </div>
            </div>
          ))}
          {empleadosFiltrados.length === 0 && <div className={styles.empty}>Sin resultados.</div>}
        </div>
      </div>
    )
  }

  if (!persona) return null

  const importe_total = persona.lineas.reduce((s, l) => s + Number(l.importe_total || 0), 0)
  const dias = new Set(persona.lineas.map(l => l.fecha_tarea).filter(Boolean)).size
  const cantSel = seleccionadas.size

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-sm" onClick={() => { setPersonaSeleccionada(null); setSeleccionadas(new Set()) }}>← Volver</button>
        <div>
          <span className={styles.cardNombre}>{persona.nombre_empleado}</span>
          <span className={styles.cardLegajo} style={{ marginLeft: 8 }}>legajo {persona.legajo}</span>
          <span className="badge badge-muted" style={{ marginLeft: 8 }}>{persona.empresa_asignada}</span>
        </div>
        <div className={styles.resumenStats} style={{ marginLeft: 'auto' }}>
          <span className={styles.statItem}><span className={styles.statLabel}>Días</span><span className={styles.statValor}>{dias}</span></span>
          <span className={styles.statItem}><span className={styles.statLabel}>Total</span><span className={styles.statValorTotal}>${importe_total.toLocaleString('es-AR')}</span></span>
        </div>
      </div>

      {/* Acciones masivas — solo visibles si hay líneas seleccionadas */}
      {cantSel > 0 && (
        <div style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{cantSel} línea{cantSel > 1 ? 's' : ''} seleccionada{cantSel > 1 ? 's' : ''}</span>

          {/* Agregar concepto */}
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

          {/* Eliminar conceptos existentes en la selección */}
          {conceptosEnSeleccion.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 8 }}>
              {conceptosEnSeleccion.map(c => (
                <button key={`quitar-${c.codigo}`} className="btn btn-sm btn-danger" onClick={() => eliminar(c.codigo)} disabled={eliminando}>
                  {eliminando ? <span className="spinner" /> : `✕ Quitar cód. ${c.codigo} (${c.count})`}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabla de líneas con checkboxes */}
      <div className="table-wrap" style={{ maxHeight: 500, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 32 }}>
                <input type="checkbox" checked={persona.lineas.length > 0 && persona.lineas.every(l => seleccionadas.has(l.id))} onChange={toggleTodas} />
              </th>
              <th>Fecha</th>
              <th>Tarea</th>
              <th>Cliente · Finca</th>
              <th>Hs.jorn</th>
              <th>Importe</th>
              <th>Conceptos</th>
            </tr>
          </thead>
          <tbody>
            {persona.lineas.map(l => (
              <tr key={l.id} onClick={() => toggleLinea(l.id)} style={{ cursor: 'pointer', background: seleccionadas.has(l.id) ? 'var(--accent-glow)' : undefined }}>
                <td onClick={e => e.stopPropagation()}>
                  <input type="checkbox" checked={seleccionadas.has(l.id)} onChange={() => toggleLinea(l.id)} />
                </td>
                <td className="mono" style={{ fontSize: 11 }}>{l.fecha_tarea || '—'}</td>
                <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.nombre_tarea}</td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.nombre_cliente} · {l.nombre_finca}</td>
                <td className="mono">{l.hsjornal || '—'}</td>
                <td className="mono">${Number(l.importe_total || 0).toLocaleString('es-AR')}</td>
                <td>
                  {(l.conceptos || []).length > 0
                    ? <span className="badge badge-info">+{l.conceptos.length}</span>
                    : <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Secciones existentes ─────────────────────────────────────────────────────

function ListaExceso({ titulo, items, unidad, expandido, setExpandido }) {
  if (items.length === 0) return <div className={styles.empty}>✓ No hay excesos para este control.</div>
  return (
    <div>
      <div className={styles.seccionTitulo}>{titulo} — {items.length} casos</div>
      <div className={styles.lista}>
        {items.map((item) => {
          const clave = `${item.legajo}-${item.fecha}`
          const abierto = expandido === clave
          return (
            <div key={clave} className={styles.card}>
              <div className={styles.cardHead} onClick={() => setExpandido(abierto ? null : clave)}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardNombre}>{item.nombre_empleado || '—'}</span>
                  <span className={styles.cardLegajo}>legajo {item.legajo || '—'}</span>
                  <span className={styles.cardFecha}>{item.fecha}</span>
                </div>
                <div className={styles.cardValor}>{item.valor.toLocaleString('es-AR', { maximumFractionDigits: 2 })} {unidad}</div>
                <span className={styles.cardChevron}>{abierto ? '▲' : '▼'}</span>
              </div>
              {abierto && (
                <div className={styles.cardBody}>
                  <div className={styles.lineasHead}><span>Tarea</span><span>Cliente · Finca</span><span>Hs.jorn.</span><span>Tanc.</span><span>Unid.</span></div>
                  {item.lineas.map(l => (
                    <div key={l.id} className={styles.lineaRow}>
                      <span>{l.nombre_tarea}</span>
                      <span className={styles.lineaMuted}>{l.nombre_cliente} · {l.nombre_finca}</span>
                      <span className="mono">{l.hsjornal || '—'}</span>
                      <span className="mono">{l.tancadas || '—'}</span>
                      <span className="mono">{l.unidades || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResumenEmpleados({ items, expandido, setExpandido }) {
  if (items.length === 0) return <div className={styles.empty}>No hay datos para mostrar.</div>
  return (
    <div>
      <div className={styles.seccionTitulo}>Importe, días trabajados y $/día por empleado — {items.length} empleados</div>
      <div className={styles.lista}>
        {items.map(emp => {
          const abierto = expandido === emp.legajo
          return (
            <div key={emp.legajo} className={styles.card}>
              <div className={styles.cardHead} onClick={() => setExpandido(abierto ? null : emp.legajo)}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardNombre}>{emp.nombre_empleado || '—'}</span>
                  <span className={styles.cardLegajo}>legajo {emp.legajo || '—'}</span>
                  <span className="badge badge-muted">{emp.empresa_asignada || '—'}</span>
                </div>
                <div className={styles.resumenStats}>
                  <span className={styles.statItem}><span className={styles.statLabel}>Días</span><span className={styles.statValor}>{emp.dias_trabajados}</span></span>
                  <span className={styles.statItem}><span className={styles.statLabel}>$/día</span><span className={styles.statValor}>${emp.importe_por_dia.toLocaleString('es-AR')}</span></span>
                  <span className={styles.statItem}><span className={styles.statLabel}>Total</span><span className={styles.statValorTotal}>${emp.importe_total.toLocaleString('es-AR')}</span></span>
                </div>
                <span className={styles.cardChevron}>{abierto ? '▲' : '▼'}</span>
              </div>
              {abierto && (
                <div className={styles.cardBody}>
                  <div className={styles.lineasHeadEmpleado}><span>Fecha</span><span>Tarea</span><span>Cliente · Finca</span><span>Hs.jorn.</span><span>Importe</span></div>
                  {emp.lineas.map(l => (
                    <div key={l.id} className={styles.lineaRowEmpleado}>
                      <span className="mono">{l.fecha_tarea || '—'}</span>
                      <span>{l.nombre_tarea}</span>
                      <span className={styles.lineaMuted}>{l.nombre_cliente} · {l.nombre_finca}</span>
                      <span className="mono">{l.hsjornal || '—'}</span>
                      <span className="mono">${l.importe_total.toLocaleString('es-AR')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlantasJornal({ data }) {
  const filas = data?.filas || []
  const totales = data?.totales
  if (filas.length === 0) return <div className={styles.empty}>No hay líneas con grupo de pago "PLANTA" para los filtros aplicados.</div>
  return (
    <div>
      <div className={styles.seccionTitulo}>Control pago — Plantas vs Jornal · {filas.length} combinaciones cliente/finca/tarea</div>
      <div className={styles.pjTableWrap}>
        <table className={styles.pjTable}>
          <thead>
            <tr>
              <th>Cliente</th><th>Finca</th><th>Tarea</th>
              <th className="mono">Precio</th><th className="mono">Un</th><th className="mono">Hs</th>
              <th className="mono">Plantas/Hsm</th><th className="mono">Plantas/Hsm×8</th><th className="mono">Prom Jornal</th>
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
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}