import { useState, useMemo, useEffect, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLineas, listarPreliquidaciones, obtenerControlPlantasJornal,
  obtenerControlTancadasJornal, setValorHoraPulv,
} from '../services/preliquidacion'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import CargandoContenido from '../components/layout/CargandoContenido'
import styles from './Verificacion.module.css'

const SECCIONES = [
  { key: 'horas',          label: '⏱ Horas excedidas',      umbral: '> 13 hs/día' },
  { key: 'tancadas',       label: '📦 Tancadas excedidas',   umbral: '> 35/día' },
  { key: 'plantas',        label: '🌱 Plantas excedidas',    umbral: '> 6.000/día' },
  { key: 'empleados',      label: '👤 Resumen por empleado', umbral: 'importe · días · $/día' },
  { key: 'plantas-jornal', label: '📊 Plantas vs Jornal',    umbral: 'rendimiento por tarea' },
  { key: 'tancadas-jornal',label: '📊 Tancadas vs Jornal',   umbral: 'tancada vs jornal' },
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
    excesoHoras:    grupos.filter(g => g.hsjornal > 13).map(g => ({ ...g, valor: g.hsjornal })).sort((a,b) => b.valor - a.valor),
    excesoTancadas: grupos.filter(g => g.tancadas > 35).map(g => ({ ...g, valor: g.tancadas })).sort((a,b) => b.valor - a.valor),
    excesoPlantas:  grupos.filter(g => g.plantas > 6000).map(g => ({ ...g, valor: g.plantas })).sort((a,b) => b.valor - a.valor),
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
      importe_total: Number(l.importe_total || 0),
      conceptos: l.conceptos || [],
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

export default function Verificacion() {
  const [preliqId, setPreliqId] = useState(null)
  const [seccion, setSeccion] = useState('horas')
  const [expandido, setExpandido] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: ['preliquidaciones'],
    queryFn: listarPreliquidaciones,
  })

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['lineas-verif', preliqId],
    queryFn: () => listarLineas(preliqId, {}),
    enabled: !!preliqId,
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

  // El precio por planta sale del maestro de conceptos (backend), no de un
  // campo local — precio_a quedó vacío desde WS1 (modelo viejo, sin reemplazo
  // en el frontend). El backend ya tenía el cálculo correcto expuesto.
  const { data: plantasJornal = { filas: [], totales: {} } } = useQuery({
    queryKey: ['control-plantas-jornal', preliqId],
    queryFn: () => obtenerControlPlantasJornal(preliqId),
    enabled: !!preliqId && seccion === 'plantas-jornal',
  })

  const queryClient = useQueryClient()
  const { data: tancadasJornal = { filas: [], totales: {}, valor_hora_pulv: null } } = useQuery({
    queryKey: ['control-tancadas-jornal', preliqId],
    queryFn: () => obtenerControlTancadasJornal(preliqId),
    enabled: !!preliqId && seccion === 'tancadas-jornal',
  })
  const guardarValorHora = useMutation({
    mutationFn: (valor) => setValorHoraPulv(preliqId, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['control-tancadas-jornal', preliqId] }),
  })

  const filtrarBusqueda = (lista) => {
    if (!busqueda) return lista
    const q = busqueda.toLowerCase()
    return lista.filter(item => item.nombre_empleado?.toLowerCase().includes(q) || item.legajo?.toLowerCase().includes(q))
  }

  const excesoHorasF    = useMemo(() => filtrarBusqueda(excesoHoras),            [excesoHoras, busqueda])
  const excesoTancadasF = useMemo(() => filtrarBusqueda(excesoTancadas),         [excesoTancadas, busqueda])
  const excesoPlantasF  = useMemo(() => filtrarBusqueda(excesoPlantas),          [excesoPlantas, busqueda])
  const resumenEmpleados = useMemo(() => filtrarBusqueda(resumenEmpleadosCompleto), [resumenEmpleadosCompleto, busqueda])

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Verificación</div>
        <select
          className="input"
          style={{ width: 200 }}
          value={preliqId || ''}
          onChange={e => {
            setPreliqId(e.target.value || null)
            setFiltros({})
            setBusqueda('')
            setExpandido(null)
            setSeccion('horas')
          }}
        >
          <option value="">— Seleccionar quincena —</option>
          {preliquidaciones.map(p => (
            <option key={p.id} value={p.id}>{p.quincena}</option>
          ))}
        </select>
        {preliqId && seccion !== 'plantas-jornal' && (
          <input
            className="input"
            style={{ width: 240, marginLeft: 'auto' }}
            placeholder="Buscar empleado o legajo..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        )}
      </div>

      {!preliqId ? (
        <div className={styles.empty} style={{ padding: 40, textAlign: 'center' }}>
          Seleccioná una quincena para ver la verificación.
        </div>
      ) : (
        <>
          <FiltrosBar lineas={lineas} filtros={filtros} onChange={setFiltros} busqueda="" onBusqueda={() => {}} mostrarAlertas={false} />

          <div className={styles.nav}>
            {SECCIONES.map(s => {
              const cantidad = {
                horas:          excesoHorasF.length,
                tancadas:       excesoTancadasF.length,
                plantas:        excesoPlantasF.length,
                empleados:      resumenEmpleados.length,
                'plantas-jornal': null,
                'tancadas-jornal': null,
              }[s.key]
              return (
                <button
                  key={s.key}
                  className={`${styles.navItem} ${seccion === s.key ? styles.navItemActive : ''}`}
                  onClick={() => setSeccion(s.key)}
                >
                  <span className={styles.navLabel}>{s.label}</span>
                  <span className={styles.navUmbral}>{s.umbral}</span>
                  {cantidad != null && cantidad > 0 && (
                    <span className="badge badge-warn mono" style={{ marginLeft: 8 }}>{cantidad}</span>
                  )}
                </button>
              )
            })}
          </div>

          {isLoading ? (
            <CargandoContenido texto="Cargando líneas…" />
          ) : (
            <div className={styles.content}>
              {seccion === 'horas'         && <ListaExceso titulo="Empleados con más de 13 horas jornal en un mismo día" items={excesoHorasF} unidad="hs" expandido={expandido} setExpandido={setExpandido} />}
              {seccion === 'tancadas'      && <ListaExceso titulo="Empleados con más de 35 tancadas en un mismo día" items={excesoTancadasF} unidad="tancadas" expandido={expandido} setExpandido={setExpandido} />}
              {seccion === 'plantas'       && <ListaExceso titulo="Empleados con más de 6.000 plantas en un mismo día" items={excesoPlantasF} unidad="plantas" expandido={expandido} setExpandido={setExpandido} />}
              {seccion === 'empleados'     && <ResumenEmpleados items={resumenEmpleados} expandido={expandido} setExpandido={setExpandido} />}
              {seccion === 'plantas-jornal'&& <PlantasJornal data={plantasJornal} />}
              {seccion === 'tancadas-jornal'&& <TancadasJornal data={tancadasJornal} onGuardar={(v) => guardarValorHora.mutate(v)} guardando={guardarValorHora.isPending} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Secciones ────────────────────────────────────────────────────────────────

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

const UNIDAD_LABEL = {
  hsjornal: 'hs jornal',
  hsmaquina: 'hs máquina',
  tancadas: 'tancadas',
  unidades: 'unidades',
  jornal_tope1: 'jornal',
}

// Texto del badge de un concepto adicional. Muestra la ecuación
// "cantidad unidad × $precio = $importe" cuando la unidad tiene una cantidad
// significativa; los casos sin cantidad real (fijo, manual, o datos faltantes)
// caen a "— $importe".
function etiquetaConcepto(c) {
  const importe = Number(c.importe || 0).toLocaleString('es-AR')
  const esManual = c.codigo_concepto === null || c.codigo_concepto === undefined
  if (esManual) return `Manual — $${importe}`

  const cod = `Cód. ${c.codigo_concepto}`
  // fijo: la cantidad es siempre 1 y no hay unidad real → sin ecuación.
  if (c.unidad_base === 'fijo') return `${cod} — fijo — $${importe}`

  const label = UNIDAD_LABEL[c.unidad_base]
  if (!label || c.cantidad == null || c.precio == null) return `${cod} — $${importe}`

  const cant = Number(c.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const precio = Number(c.precio).toLocaleString('es-AR')
  return `${cod} — ${cant} ${label} × $${precio} = $${importe}`
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
                  <div className={styles.lineasHeadEmpleado}><span>Fecha</span><span>Tarea</span><span>Cliente · Finca</span><span>Importe</span></div>
                  {emp.lineas.map(l => (
                    <Fragment key={l.id}>
                      <div className={styles.lineaRowEmpleado}>
                        <span className="mono">{l.fecha_tarea || '—'}</span>
                        <span>{l.nombre_tarea}</span>
                        <span className={styles.lineaMuted}>{l.nombre_cliente} · {l.nombre_finca}</span>
                        <span className="mono">${l.importe_total.toLocaleString('es-AR')}</span>
                      </div>
                      {l.conceptos.length > 0 && (
                        <div className={styles.conceptosDia}>
                          {l.conceptos.map(c => (
                            <span key={c.id} className="badge badge-muted mono">
                              {etiquetaConcepto(c)}
                            </span>
                          ))}
                        </div>
                      )}
                    </Fragment>
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

function TancadasJornal({ data, onGuardar, guardando }) {
  const filas = data?.filas || []
  const totales = data?.totales
  const valorHora = data?.valor_hora_pulv ?? null

  const [input, setInput] = useState(valorHora == null ? '' : String(valorHora))
  // Re-sincroniza el input cuando llega/cambia el valor del backend (ej. al
  // cambiar de quincena o tras guardar).
  useEffect(() => { setInput(valorHora == null ? '' : String(valorHora)) }, [valorHora])

  const guardar = () => {
    const t = input.trim()
    onGuardar(t === '' ? null : Number(t))
  }

  const fmt = (n) => n == null ? '—' : n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  const fmtMoney = (n) => n == null ? '—' : `$${n.toLocaleString('es-AR')}`
  // DIFF viene como ratio crudo; se muestra en %. Positivo = tancada más caro.
  const fmtPct = (d) => d == null ? '—' : `${d > 0 ? '+' : ''}${(d * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`

  return (
    <div>
      <div className={styles.seccionTitulo}>Control pago — Tancadas vs Jornal · {filas.length} combinaciones cliente/finca/tarea</div>

      <div className={styles.vhpBar}>
        <label className={styles.vhpLabel}>Valor hora pulverización</label>
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
          <span className={styles.vhpAviso}>Cargá el valor hora para ver la comparación a jornal.</span>
        )}
      </div>

      {filas.length === 0 ? (
        <div className={styles.empty}>No hay líneas pagadas por tancada en esta quincena.</div>
      ) : (
        <div className={styles.pjTableWrap}>
          <table className={styles.pjTable}>
            <thead>
              <tr>
                <th>Cliente</th><th>Finca</th><th>Tarea</th>
                <th className="mono">Tancadas</th><th className="mono">Hs jornal</th><th className="mono">Hs máquina</th>
                <th className="mono">Valor s/jornal</th><th className="mono">Precio</th><th className="mono">Valor s/tancada</th><th className="mono">Diff</th>
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
