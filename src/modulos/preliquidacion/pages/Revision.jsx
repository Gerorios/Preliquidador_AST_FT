import { useState, useMemo, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import toast from 'react-hot-toast'
import {
  listarLineas, obtenerEstadisticas,
  actualizarLinea, eliminarConcepto,
  listarPreliquidaciones,
  buscarConceptosParaCombo, agregarConceptoMasivo, eliminarConceptoMasivo,
  legajosPorCuil, reasignarEmpresaMasivo,
  exportarQuincenaExcel,
} from '../services/preliquidacion'
import { claves } from '../services/claves'
import PanelLinea from '../components/PanelLinea'
import DialogoOpcionExtra from '../components/DialogoOpcionExtra'
import FiltrosBar from '../components/FiltrosBar'
import SelectorQuincena from '../components/SelectorQuincena'
import { filtrarLineas, pasaBusquedaYAlertas, CAMPOS_LINEAS } from './filtrarLineas'
import AlertasBanner from '../components/AlertasBanner'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import { alertaDe, siguienteOrden, ordenarLineas } from './ordenarLineas'
import { totalesLineas } from './totalesLineas'
import styles from './Revision.module.css'
import Icono from '../../../core/ui/iconos'
import { useEstadoPantalla } from '../estadoPantallas'

// En Revisión no se filtra por empresa: no se usa.
const CAMPOS_REVISION = CAMPOS_LINEAS.filter(c => c.key !== 'empresa')

function fmt(v) {
  if (v === null || v === undefined || v === '' || Number(v) === 0) return '—'
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

// Badge de cada alerta. La precedencia la decide `alertaDe` (la misma que usa
// el orden por la columna de alerta), acá sólo se elige el color.
const BADGE_ALERTA = {
  DUPLICADO:  'badge-danger',
  'POSIBLE DUPLICADO': 'badge-warn',
  INCOMPLETA: 'badge-warn',
  LEGAJO:     'badge-warn',
  EMPRESA:    'badge-info',
}

// Encabezados de la tabla principal. Las claves son las de COLUMNAS_ORDEN
// (ordenarLineas.js). La de alerta no tiene texto: se nombra con aria-label.
const ORDENAR = 'Ordenar por esta columna'
const COLUMNAS_TABLA = [
  { clave: 'alerta',        label: '',                title: ORDENAR, ariaLabel: 'Alerta' },
  { clave: 'fecha',         label: 'FECHA',           title: ORDENAR },
  { clave: 'empleado',      label: 'EMPLEADO',        title: ORDENAR },
  { clave: 'legajo',        label: 'LEGAJO',          title: ORDENAR },
  { clave: 'empresa',       label: 'EMPRESA',         title: ORDENAR },
  { clave: 'tarea',         label: 'TAREA',           title: ORDENAR },
  { clave: 'supervisor',    label: 'SUPERVISOR',      title: ORDENAR },
  { clave: 'cliente_finca', label: 'CLIENTE · FINCA', title: ORDENAR },
  { clave: 'grupo_pago',    label: 'GRUPO PAGO',      title: ORDENAR },
  { clave: 'hsjornal',      label: 'HS. JORN.',       title: 'Horas jornal' },
  { clave: 'hsmaquina',     label: 'HS. MAQ.',        title: 'Horas máquina' },
  { clave: 'tancadas',      label: 'TANC.',           title: 'Tancadas' },
  { clave: 'unidades',      label: 'UNID.',           title: 'Unidades / plantas / bins' },
  { clave: 'importe',       label: 'IMPORTE',         title: ORDENAR },
  { clave: 'conceptos',     label: 'CONCEPTOS',       title: ORDENAR },
]

// ─── Liquidación masiva por persona ──────────────────────────────────────────

function LiquidacionPersona({ lineas, onCambio, quincena }) {
  const [busqPersona, setBusqPersona] = useState('')
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null)
  const [seleccionadas, setSeleccionadas] = useState(new Set())
  const [codigoConcepto, setCodigoConcepto] = useState('')
  const [mostrarCombo, setMostrarCombo] = useState(false)
  const [gruposCuil, setGruposCuil] = useState(null)
  const [empresaPorGrupo, setEmpresaPorGrupo] = useState({})
  // Concepto extra masivo frenado por un 409 (ADR-0015): `detalle` es el
  // detail del 409 que abre el diálogo, y `opcion` la ya elegida, que viaja
  // en el reintento de "codigo_repetido".
  const [pedidoMasivo, setPedidoMasivo] = useState(null)

  const { data: conceptosDisponibles = [] } = useQuery({
    queryKey: claves.conceptosCombo(quincena),
    queryFn: () => buscarConceptosParaCombo('', quincena),
    enabled: mostrarCombo && !!quincena,
  })

  const { mutate: agregar, isPending: agregando } = useMutation({
    mutationFn: ({ opcion, siRepetido = 'frenar' } = {}) => {
      const codigo = parseInt(codigoConcepto)
      if (!codigo || isNaN(codigo)) throw new Error('Seleccioná un concepto')
      return agregarConceptoMasivo([...seleccionadas], codigo, { opcion, siRepetido })
    },
    onSuccess: (data) => {
      // El backend dice cuántas líneas actualizó y cuántas salteó.
      toast.success(data?.detalle || 'Concepto agregado a las líneas seleccionadas')
      setPedidoMasivo(null)
      setCodigoConcepto('')
      setMostrarCombo(false)
      setSeleccionadas(new Set())
      onCambio()
    },
    onError: (err, variables) => {
      const tipo = err.status === 409 ? err.detail?.tipo : null
      if (tipo === 'elegir_opcion' || tipo === 'codigo_repetido') {
        // Si la selección ya se limpió (se cambió de persona con el pedido en
        // vuelo), el diálogo no tiene a qué líneas aplicarse.
        if (seleccionadas.size > 0) setPedidoMasivo({ opcion: variables?.opcion, detalle: err.detail })
        return
      }
      setPedidoMasivo(null)
      toast.error(err.message)
    },
  })

  // Handlers del diálogo. Mientras hay un pedido en vuelo no hacen nada, así
  // un doble clic no manda dos altas.
  const elegirOpcionMasivo = (opcion) => {
    if (agregando) return
    agregar({ opcion })
  }
  const confirmarRepetidoMasivo = (siRepetido) => {
    if (agregando) return
    agregar({ opcion: pedidoMasivo.opcion, siRepetido })
  }
  const cancelarPedidoMasivo = () => {
    if (agregando) return
    setPedidoMasivo(null)
  }

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
    // Sin `lineas`: `persona` sale de `empleados`, que se reconstruye (objetos
    // nuevos) cada vez que cambia `lineas`, así que `persona` ya cambia de
    // referencia en ese caso y el memo se recalcula igual.
  }, [persona, seleccionadas])

  const toggleLinea = (id) => setSeleccionadas(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const toggleTodas = () => {
    if (!persona) return
    const todos = persona.lineas.map(l => l.id)
    const todasSel = todos.every(id => seleccionadas.has(id))
    setSeleccionadas(todasSel ? new Set() : new Set(todos))
  }

  // Limpia todo el estado de acciones en curso (agregar concepto, reasignar
  // empresa) al cambiar de persona — si no, un panel abierto sin confirmar
  // (ej. "Reasignar empresa" sin elegir empresa) queda pegado y reaparece
  // con los datos de la persona anterior al seleccionar otra.
  const cambiarPersona = (legajo) => {
    setPersonaSeleccionada(legajo)
    setSeleccionadas(new Set())
    setMostrarCombo(false)
    setCodigoConcepto('')
    setPedidoMasivo(null)
    setGruposCuil(null)
    setEmpresaPorGrupo({})
  }

  const liqStyles = {
    wrap:      { padding: '0 16px 16px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
    lista:     { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8, flex: 1, overflow: 'auto', minHeight: 0 },
    card:      { border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: 'var(--bg-surface)' },
    nombre:    { fontWeight: 600, fontSize: 13 },
    sub:       { fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 },
    acciones:  { background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 },
  }

  if (!personaSeleccionada) {
    return (
      <div style={liqStyles.wrap}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexShrink: 0 }}>
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
            <div key={emp.legajo} style={liqStyles.card} onClick={() => cambiarPersona(emp.legajo)}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <button className="btn btn-sm" onClick={() => cambiarPersona(null)}>← Volver</button>
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
                  {eliminando ? <span className="spinner" /> : <><Icono nombre="cerrar" size={14} enTexto /> Quitar cód. {c.codigo} ({c.count})</>}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-sm" onClick={() => abrirReasignar()} disabled={cargandoGrupos}>
            {cargandoGrupos ? <span className="spinner" /> : <><Icono nombre="intercambiar" size={14} enTexto /> Reasignar empresa</>}
          </button>
        </div>
      )}

      {gruposCuil && (
        <div style={{ ...liqStyles.acciones, flexDirection: 'column', alignItems: 'stretch', background: 'var(--info-dim)', borderColor: 'var(--info)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--info)' }}>Reasignar empresa — un bloque por persona (CUIL)</span>
          {gruposCuil.sin_cuil.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--warn)' }}>
              <Icono nombre="alerta" size={14} enTexto /> {gruposCuil.sin_cuil.length} línea{gruposCuil.sin_cuil.length > 1 ? 's' : ''} sin CUIL — no se pueden reasignar así, editalas a mano.
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

      <div className="table-wrap" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
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

      {pedidoMasivo && (
        <DialogoOpcionExtra
          detalle={pedidoMasivo.detalle}
          modo="masivo"
          onElegir={elegirOpcionMasivo}
          onConfirmarRepetido={confirmarRepetidoMasivo}
          onCancelar={cancelarPedidoMasivo}
        />
      )}
    </div>
  )
}

// El selector de quincena navega dentro de esta misma ruta y React Router no
// vuelve a montar la página: sin `key`, la línea abierta en el panel y el modo
// de liquidación masiva seguirían siendo de la quincena anterior ("Guardar"
// editaría esa línea). Filtros, búsqueda y orden viven en useEstadoPantalla y
// se conservan igual.
export default function Revision() {
  const { id } = useParams()
  return <RevisionQuincena key={id} />
}

function RevisionQuincena() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [filtros, setFiltros] = useEstadoPantalla('revision.filtros', {})
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useEstadoPantalla('revision.busqueda', '')
  const [modoLiquidacion, setModoLiquidacion] = useState(false)
  const [exportando, setExportando] = useState(false)
  // Orden por columna: { clave, dir } o null (orden del server). Como los
  // filtros y la búsqueda, se guarda al ir y volver entre pantallas
  // (estadoPantallas) y vuelve a cero al recargar o al cerrar sesión.
  const [orden, setOrden] = useEstadoPantalla('revision.orden', null)

  const { data: preliqData } = useQuery({
    // Comparte el caché de la lista con Dashboard y el resto: `select` elige
    // esta preliquidación sin otro request ni otra clave que invalidar.
    // String() en ambos lados: `id` viene de useParams (string) y p.id es número.
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
    select: list => list.find(p => String(p.id) === String(id)),
  })
  const { data: preliquidaciones = [] } = useQuery({
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
  })

  const { data: stats } = useQuery({
    queryKey: claves.stats(id),
    queryFn: () => obtenerEstadisticas(id),
    // Sin polling agresivo: se invalida explícitamente tras cada mutación
    // (ver refrescarYSincronizarPanel y `guardar`). Este intervalo es solo
    // una red de seguridad por si algo externo cambia el estado.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  // La queryKey NO incluye `filtros`: todo el filtrado se hace en cliente
  // (`lineasFiltradas`, con `filtrarLineas`) para no re-pegarle al server ni
  // perder el caché cada vez que cambia un filtro. `placeholderData:
  // keepPreviousData` evita el parpadeo a "cargando" entre refetchs.
  // La clave es compartida con Verificación (mismo endpoint, sin filtros):
  // `placeholderData` es opción de este observer, no del caché, así que no
  // afecta a lo que ve Verificación.
  const { data: lineas = [], isLoading } = useQuery({
    queryKey: claves.lineas(id),
    queryFn: () => listarLineas(id),
    placeholderData: keepPreviousData,
  })

  // `busqueda` llega ya debounceada desde FiltrosBar (que es dueño del input):
  // tipear no re-renderiza esta página hasta que el valor se asienta.
  const lineasFiltradas = useMemo(
    () => filtrarLineas(lineas, busqueda, filtros, CAMPOS_REVISION),
    [lineas, busqueda, filtros],
  )
  // Las opciones de la barra salen de lo que ya pasa la búsqueda y las alertas.
  const prefiltro = useCallback(
    l => pasaBusquedaYAlertas(l, busqueda, filtros),
    [busqueda, filtros],
  )

  // El orden va encima del filtrado: al filtrar o al editar una línea se
  // recalcula y el orden elegido se mantiene.
  const lineasOrdenadas = useMemo(
    () => ordenarLineas(lineasFiltradas, orden),
    [lineasFiltradas, orden],
  )

  // Fila TOTAL: suma lo visible (filtrado, duplicadas incluidas). El orden no
  // cambia la suma, así que depende sólo de `lineasFiltradas`.
  const totales = useMemo(() => totalesLineas(lineasFiltradas), [lineasFiltradas])

  // Virtualización de la tabla: solo se montan en el DOM las filas visibles
  // (más un margen de overscan). Con 1.500-2.500 líneas, renderizarlas todas
  // congelaba el hilo principal ~1s por cada cambio de filtro o búsqueda.
  const scrollRef = useRef(null)
  const virtualizador = useVirtualizer({
    count: lineasOrdenadas.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 38,
    overscan: 12,
  })
  const filasVirtuales = virtualizador.getVirtualItems()
  const padTop = filasVirtuales.length ? filasVirtuales[0].start : 0
  const padBottom = filasVirtuales.length
    ? virtualizador.getTotalSize() - filasVirtuales[filasVirtuales.length - 1].end
    : 0

  // Clic en un encabezado: asc → desc → orden del server. Con el orden nuevo
  // la fila que estaba a la vista ya no es la misma, así que se vuelve arriba.
  const ordenarPor = (clave) => {
    setOrden(o => siguienteOrden(o, clave))
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  // Refetch masivo — se usa solo para operaciones donde la respuesta de la
  // mutación no trae suficiente info para actualizar el caché a mano
  // (agregar/eliminar concepto individual y las operaciones masivas de
  // LiquidacionPersona no devuelven la línea recalculada con su nuevo
  // importe_total/conceptos, ver services/preliquidacion_service.py
  // agregar_concepto / agregar_concepto_por_codigo / eliminar_concepto).
  const refrescarYSincronizarPanel = async () => {
    await qc.refetchQueries({ queryKey: claves.lineas(id) })
    const lineasFrescas = qc.getQueryData(claves.lineas(id))
    if (lineasFrescas && lineaSeleccionada) {
      const lineFresca = lineasFrescas.find(l => l.id === lineaSeleccionada.id)
      if (lineFresca) setLineaSeleccionada(lineFresca)
    }
    qc.invalidateQueries({ queryKey: claves.stats(id) })
  }

  const { mutate: guardar, isPending: guardando } = useMutation({
    mutationFn: ({ lineaId, datos }) => actualizarLinea(lineaId, datos),
    // actualizarLinea devuelve la línea completa ya recalculada, así que
    // acá no hace falta refetch: se actualiza el caché puntualmente.
    onSuccess: (data) => {
      toast.success('Línea actualizada')
      setLineaSeleccionada(data)
      qc.setQueryData(claves.lineas(id), (old) => old ? old.map(l => l.id === data.id ? data : l) : old)
      qc.invalidateQueries({ queryKey: claves.stats(id) })
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

  const handleExportarExcel = async () => {
    if (!id) return
    setExportando(true)
    try {
      await exportarQuincenaExcel(id)
    } catch (err) {
      console.error(err)
      toast.error('No se pudo exportar el Excel')
    } finally {
      setExportando(false)
    }
  }

  const claseLinea = (linea) => {
    if (linea.es_duplicado) return 'duplicado'
    if (linea.es_posible_duplicado) return 'alerta'
    if (linea.linea_incompleta) return 'alerta'
    if (linea.alerta_legajo || linea.alerta_empresa) return 'alerta'
    return ''
  }

  const iconoAlerta = (linea) => {
    const label = alertaDe(linea)
    return label ? { label, badge: BADGE_ALERTA[label] } : null
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className="btn btn-sm" onClick={() => navigate('/preliquidacion/dashboard')}>← Volver</button>
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
          {modoLiquidacion ? '← Volver a tabla' : <><Icono nombre="grilla" size={14} enTexto /> Liquidación masiva</>}
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleExportarExcel} disabled={!id || exportando}>
          {exportando ? 'Exportando…' : <><Icono nombre="descargar" size={14} enTexto /> Exportar Excel</>}
        </button>
      </div>

      {/* Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {stats?.incompletas > 0 && (
          <AlertasBanner
            mensaje={<><strong>{stats.incompletas} líneas incompletas</strong> — cargá los conceptos y precios en el maestro</>}
            ctaLabel="Ir a Conceptos →"
            ctaSubrayada={false}
            onFiltrar={() => navigate('/preliquidacion/conceptos')}
          />
        )}
        {stats?.lineas_con_alerta > 0 && stats?.incompletas === 0 && (
          <AlertasBanner
            total={stats.lineas_con_alerta}
            incompletas={stats.incompletas}
            duplicados={stats.duplicados}
            posiblesDuplicados={stats.posibles_duplicados}
            alertaLegajo={stats.alerta_legajo}
            onFiltrar={() => setFiltros(f => ({ ...f, solo_alertas: true }))}
          />
        )}
      </div>

      {modoLiquidacion && (
        <LiquidacionPersona
          lineas={lineas}
          onCambio={refrescarYSincronizarPanel}
          quincena={preliqData?.quincena}
        />
      )}

      <div className={styles.layout} style={{ display: modoLiquidacion ? 'none' : undefined }}>
        {/* Tabla */}
        <div className={styles.tablePane}>
          <FiltrosBar
            lineas={lineas}
            campos={CAMPOS_REVISION}
            filtros={filtros}
            onChange={setFiltros}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            prefiltro={prefiltro}
            quincena={(
              <SelectorQuincena
                preliquidaciones={preliquidaciones}
                value={Number(id)}
                onChange={nuevo => nuevo && navigate(`/preliquidacion/revision/${nuevo}`)}
              />
            )}
          />

          {isLoading ? (
            <CargandoContenido texto="Cargando líneas…" />
          ) : (
            <div className="table-wrap" style={{ flex: 1, overflow: 'auto' }} ref={scrollRef}>
              <table>
                <thead>
                  <tr>
                    {COLUMNAS_TABLA.map(c => {
                      const activa = orden?.clave === c.clave
                      return (
                        <th
                          key={c.clave}
                          scope="col"
                          className={styles.thOrdenable}
                          title={c.title}
                          aria-label={c.ariaLabel}
                          aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          onClick={() => ordenarPor(c.clave)}
                        >
                          {c.label}
                          <span className={styles.flecha} aria-hidden="true">
                            {activa ? <Icono nombre={orden.dir === 'asc' ? 'arriba' : 'abajo'} size={12} enTexto /> : ''}
                          </span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {padTop > 0 && <tr aria-hidden="true" style={{ height: padTop, border: 0 }} />}
                  {filasVirtuales.map(fila => {
                    const linea = lineasOrdenadas[fila.index]
                    return (
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
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linea.nombre_supervisor || '—'}
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
                        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', display: 'inline-flex' }} aria-hidden="true"><Icono nombre="derecha" size={13} enTexto /></span>
                      </td>
                    </tr>
                    )
                  })}
                  {padBottom > 0 && <tr aria-hidden="true" style={{ height: padBottom, border: 0 }} />}
                </tbody>
                {lineasFiltradas.length > 0 && (
                  <tfoot>
                    <tr className={styles.filaTotales}>
                      {/* Cubre de alerta a grupo pago: las 9 primeras de COLUMNAS_TABLA. */}
                      <td colSpan={9}>TOTAL</td>
                      <td className="mono">{fmt(totales.hsjornal)}</td>
                      <td className="mono">{fmt(totales.hsmaquina)}</td>
                      <td className="mono">{fmt(totales.tancadas)}</td>
                      <td className="mono">{fmt(totales.unidades)}</td>
                      <td className="mono">
                        {totales.importe_total
                          ? `$${totales.importe_total.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
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