import { useState, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLineas, listarPreliquidaciones, obtenerControlPlantasJornal,
  obtenerControlTancadasJornal, setValorHoraPulv, setValorHoraTractorista,
} from '../services/preliquidacion'
import { claves } from '../services/claves'
import FiltrosBar from '../components/FiltrosBar'
import { PlantasJornal, TancadasJornal } from '../components/ControlesJornal'
import InputBusqueda from '../components/InputBusqueda'
import { agruparPosiblesDuplicados } from './posiblesDuplicados'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import styles from './Verificacion.module.css'

const SECCIONES = [
  { key: 'horas',          label: '⏱ Horas excedidas',      umbral: '> 13 hs/día' },
  { key: 'tancadas',       label: '📦 Tancadas excedidas',   umbral: '> 35/día' },
  { key: 'plantas',        label: '🌱 Plantas excedidas',    umbral: '> 6.000/día' },
  { key: 'empleados',      label: '👤 Resumen por empleado', umbral: 'importe · días · $/día' },
  { key: 'plantas-jornal', label: '📊 Plantas vs Jornal',    umbral: 'rendimiento por tarea' },
  { key: 'tancadas-jornal',label: '📊 Tancadas vs Jornal',   umbral: 'tancada vs jornal' },
  { key: 'posibles-duplicados', label: '⚠ Posibles duplicados', umbral: 'mismas unidades, distintas horas' },
]

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
      nombre_supervisor: l.nombre_supervisor,
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

// Fuera del componente y con `busqueda` como argumento: así no se recrea en
// cada render y los useMemo que la usan dependen sólo de sus datos y de
// `busqueda`. Adentro del componente, agregarla a las deps haría que los
// memos se recalcularan en cada render.
function filtrarBusqueda(lista, busqueda) {
  if (!busqueda) return lista
  const q = busqueda.toLowerCase()
  return lista.filter(item => item.nombre_empleado?.toLowerCase().includes(q) || item.legajo?.toLowerCase().includes(q))
}

export default function Verificacion() {
  const [preliqId, setPreliqId] = useState(null)
  const [seccion, setSeccion] = useState('horas')
  const [expandido, setExpandido] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtros, setFiltros] = useState({})

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
  })

  // Misma clave que Revisión: las dos piden exactamente lo mismo (todas las
  // líneas de la quincena, sin filtros de servidor) y así una invalidación
  // desde Conceptos, Dashboard o una edición en Revisión también llega acá.
  // El filtro de mensualizados es de esta pantalla y se hace abajo, en cliente,
  // sobre la data cruda: por eso no va en un `select` ni cambia la clave.
  const { data: lineasCrudas = [], isLoading } = useQuery({
    queryKey: claves.lineas(preliqId),
    queryFn: () => listarLineas(preliqId, {}),
    enabled: !!preliqId,
  })
  // Personas mensualizadas (no jornalizadas): se excluyen de todas las
  // secciones de Verificación porque estos controles miden razonabilidad del
  // pago jornalizado y no aplican a un sueldo mensual fijo. Revisión (misma
  // fuente de líneas, otra página) no filtra por esto: ahí sí hay que
  // verlas/editarlas para liquidar su sueldo. Quién es mensualizado lo decide
  // el servidor (configuración por CUIL, fuera del código) y lo marca en cada
  // línea con `mensualizado`; el front no guarda datos de personas. Contra un
  // backend que no manda el campo no se filtra nada.
  const lineas = useMemo(
    () => lineasCrudas.filter(l => !l.mensualizado),
    [lineasCrudas]
  )

  const lineasFiltradas = useMemo(() => {
    let r = lineas
    if (filtros.cliente?.length)    r = r.filter(l => filtros.cliente.includes(l.nombre_cliente))
    if (filtros.finca?.length)      r = r.filter(l => filtros.finca.includes(l.nombre_finca))
    if (filtros.tarea?.length)      r = r.filter(l => filtros.tarea.includes(l.nombre_tarea))
    if (filtros.empresa?.length)    r = r.filter(l => filtros.empresa.includes(l.empresa_asignada))
    if (filtros.grupo_pago?.length) r = r.filter(l => filtros.grupo_pago.includes(l.grupo_pago_aplicado))
    if (filtros.supervisor?.length) r = r.filter(l => filtros.supervisor.includes(l.nombre_supervisor))
    return r
  }, [lineas, filtros])

  const { excesoHoras, excesoTancadas, excesoPlantas } = useMemo(() => calcularExcesos(lineasFiltradas), [lineasFiltradas])
  const resumenEmpleadosCompleto = useMemo(() => calcularResumenEmpleados(lineasFiltradas), [lineasFiltradas])
  const posiblesDuplicadosCompleto = useMemo(() => agruparPosiblesDuplicados(lineasFiltradas), [lineasFiltradas])

  // El precio por planta sale del pago real congelado (backend): lo que
  // efectivamente se pagó en las líneas, venga del camino que venga.
  const { data: plantasJornal = { filas: [], totales: {}, valor_hora_tractorista: null } } = useQuery({
    queryKey: ['control-plantas-jornal', preliqId],
    queryFn: () => obtenerControlPlantasJornal(preliqId),
    enabled: !!preliqId && seccion === 'plantas-jornal',
  })

  const queryClient = useQueryClient()
  const guardarValorHoraTractorista = useMutation({
    mutationFn: (valor) => setValorHoraTractorista(preliqId, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['control-plantas-jornal', preliqId] }),
  })
  const { data: tancadasJornal = { filas: [], totales: {}, valor_hora_pulv: null } } = useQuery({
    queryKey: ['control-tancadas-jornal', preliqId],
    queryFn: () => obtenerControlTancadasJornal(preliqId),
    enabled: !!preliqId && seccion === 'tancadas-jornal',
  })
  const guardarValorHora = useMutation({
    mutationFn: (valor) => setValorHoraPulv(preliqId, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['control-tancadas-jornal', preliqId] }),
  })

  // `busqueda` llega ya debounceada desde InputBusqueda (dueño del input):
  // tipear no re-renderiza esta página hasta que el valor se asienta.
  const excesoHorasF    = useMemo(() => filtrarBusqueda(excesoHoras, busqueda),            [excesoHoras, busqueda])
  const excesoTancadasF = useMemo(() => filtrarBusqueda(excesoTancadas, busqueda),         [excesoTancadas, busqueda])
  const excesoPlantasF  = useMemo(() => filtrarBusqueda(excesoPlantas, busqueda),          [excesoPlantas, busqueda])
  const resumenEmpleados = useMemo(() => filtrarBusqueda(resumenEmpleadosCompleto, busqueda), [resumenEmpleadosCompleto, busqueda])
  const posiblesDuplicados = useMemo(() => filtrarBusqueda(posiblesDuplicadosCompleto, busqueda), [posiblesDuplicadosCompleto, busqueda])

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
          <InputBusqueda
            key={preliqId}
            style={{ width: 240, marginLeft: 'auto' }}
            placeholder="Buscar empleado o legajo..."
            value={busqueda}
            onChange={setBusqueda}
          />
        )}
      </div>

      {!preliqId ? (
        <div className={styles.empty} style={{ padding: 40, textAlign: 'center' }}>
          Seleccioná una quincena para ver la verificación.
        </div>
      ) : (
        <>
          <FiltrosBar lineas={lineas} filtros={filtros} onChange={setFiltros} busqueda={busqueda} onBusqueda={setBusqueda} mostrarAlertas={false} mostrarBusqueda={false} />

          <div className={styles.nav}>
            {SECCIONES.map(s => {
              const cantidad = {
                horas:          excesoHorasF.length,
                tancadas:       excesoTancadasF.length,
                plantas:        excesoPlantasF.length,
                empleados:      resumenEmpleados.length,
                'plantas-jornal': null,
                'tancadas-jornal': null,
                'posibles-duplicados': posiblesDuplicados.length,
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
              {seccion === 'plantas-jornal'&& <PlantasJornal data={plantasJornal} onGuardar={(v) => guardarValorHoraTractorista.mutate(v)} guardando={guardarValorHoraTractorista.isPending} />}
              {seccion === 'tancadas-jornal'&& <TancadasJornal data={tancadasJornal} onGuardar={(v) => guardarValorHora.mutate(v)} guardando={guardarValorHora.isPending} />}
              {seccion === 'posibles-duplicados' && <ListaPosiblesDuplicados items={posiblesDuplicados} expandido={expandido} setExpandido={setExpandido} />}
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
                  <div className={styles.lineasHead}><span>Tarea</span><span>Cliente · Finca</span><span>Superv.</span><span>Hs.jorn.</span><span>Tanc.</span><span>Unid.</span></div>
                  {item.lineas.map(l => (
                    <div key={l.id} className={styles.lineaRow}>
                      <span>{l.nombre_tarea}</span>
                      <span className={styles.lineaMuted}>{l.nombre_cliente} · {l.nombre_finca}</span>
                      <span className={styles.lineaMuted}>{l.nombre_supervisor || '—'}</span>
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

// Las líneas llegan crudas de la API (los Decimal como string, '4.00'): se
// muestran como número, y el 0 o el nulo como '—', igual que en ListaExceso.
const numeroOGuion = (v) => Number(v || 0) || '—'
const pesos = (v) => `$${Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

// Cada tarjeta es un grupo de líneas iguales salvo en las horas (la marca la
// pone el backend). El importe de la derecha es el que está en duda: la suma
// del grupo menos la línea de mayor importe, o sea lo que sobraría si sólo una
// de ellas fuera trabajo real.
function ListaPosiblesDuplicados({ items, expandido, setExpandido }) {
  if (items.length === 0) return <div className={styles.empty}>✓ No hay posibles duplicados.</div>
  return (
    <div>
      <div className={styles.seccionTitulo}>Líneas iguales con distintas horas en un mismo día — {items.length} casos</div>
      <div className={styles.lista}>
        {items.map((item) => {
          const abierto = expandido === item.clave
          const lineas = [...item.lineas].sort((a, b) => a.id - b.id)
          return (
            <div key={item.clave} className={styles.card}>
              <div className={styles.cardHead} onClick={() => setExpandido(abierto ? null : item.clave)}>
                <div className={styles.cardInfo}>
                  <span className={styles.cardNombre}>{item.nombre_empleado || '—'}</span>
                  <span className={styles.cardLegajo}>legajo {item.legajo || '—'}</span>
                  <span className={styles.cardFecha}>{item.fecha}</span>
                </div>
                <div className={styles.cardValor} title="Importe en duda: la suma de las líneas del grupo menos la de mayor importe">{pesos(item.valor)}</div>
                <span className={styles.cardChevron}>{abierto ? '▲' : '▼'}</span>
              </div>
              {abierto && (
                <div className={styles.cardBody}>
                  <div className={styles.lineasHeadPosibles}><span>Tarea</span><span>Cliente · Finca</span><span>Superv.</span><span>Hs.jorn.</span><span>Hs.máq.</span><span>Tanc.</span><span>Unid.</span><span>Importe</span><span /></div>
                  {lineas.map(l => (
                    <div key={l.id} className={styles.lineaRowPosibles}>
                      <span>{l.nombre_tarea}</span>
                      <span className={styles.lineaMuted}>{l.nombre_cliente} · {l.nombre_finca}</span>
                      <span className={styles.lineaMuted}>{l.nombre_supervisor || '—'}</span>
                      <span className="mono">{numeroOGuion(l.hsjornal)}</span>
                      <span className="mono">{numeroOGuion(l.hsmaquina)}</span>
                      <span className="mono">{numeroOGuion(l.tancadas)}</span>
                      <span className="mono">{numeroOGuion(l.unidades)}</span>
                      <span className="mono">{pesos(l.importe_total)}</span>
                      <span>
                        {l.es_duplicado
                          ? <span className="badge badge-danger">DUPLICADO</span>
                          : l.es_posible_duplicado && <span className="badge badge-warn">POSIBLE DUPLICADO</span>}
                      </span>
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
  jornal_tope1_mas_excedente: 'jornal',
}

// Texto del badge de un concepto adicional: "Cód. N — cantidad unidad — $precio"
// (el precio unitario por el que se paga, sin el importe total). Los casos sin
// cantidad real (fijo) muestran "— fijo — $precio"; los manuales, sin código ni
// precio, muestran solo su "— $importe".
function etiquetaConcepto(c) {
  const importe = Number(c.importe || 0).toLocaleString('es-AR')
  const esManual = c.codigo_concepto === null || c.codigo_concepto === undefined
  if (esManual) return `Manual — $${importe}`

  const cod = `Cód. ${c.codigo_concepto}`
  const precio = c.precio != null ? Number(c.precio).toLocaleString('es-AR') : null
  // fijo: la cantidad es siempre 1 y no hay unidad real → sin cantidad.
  if (c.unidad_base === 'fijo') return `${cod} — fijo — $${precio ?? importe}`

  const label = UNIDAD_LABEL[c.unidad_base]
  if (!label || c.cantidad == null || precio == null) return `${cod} — $${precio ?? importe}`

  const cant = Number(c.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return `${cod} — ${cant} ${label} — $${precio}`
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
