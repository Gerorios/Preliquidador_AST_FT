import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarPreciosMaestro, crearPrecioMaestro, actualizarPrecioMaestro,
  eliminarPrecioMaestro, copiarQuincena, listarQuincenasConPrecios,
  listarClientes, listarFincas, listarTareas, listarGruposPago,
  obtenerPrecioSugerido, obtenerPreciosFaltantes, listarPreliquidaciones,
  listarPreciosComunes, crearPrecioComun, eliminarPrecioComun,
  copiarQuincenaComunes, listarQuincenasConPreciosComunes,
} from '../services/preliquidacion'
import styles from './Precios.module.css'

const QUINCENAS_RAPIDAS = () => {
  const hoy = new Date()
  const opts = []
  for (let m = 0; m < 4; m++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - m, 1)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const mes = d.toLocaleString('es-AR', { month: 'short' }).toUpperCase()
    opts.push({ label: `1ra ${mes} ${y}`, value: `${y}-${mo}-01` })
    opts.push({ label: `2da ${mes} ${y}`, value: `${y}-${mo}-16` })
  }
  return opts
}

const TABS = ['Precios comunes', 'Tareas sin precio']

export default function Precios() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [quincena, setQuincena] = useState(QUINCENAS_RAPIDAS()[0].value)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [quincenaOrigen, setQuincenaOrigen] = useState('')
  const [mostrarCargados, setMostrarCargados] = useState(false)

  // Filtros del listado de faltantes — para acotar la lista en vez de
  // ver todas las combinaciones sin precio de una sola vez.
  const [faltantesFiltros, setFaltantesFiltros] = useState({
    cliente: '', finca: '', tarea: '', grupo_pago: '',
  })

  // Fila de faltante que se está cargando (carga inline, ya no es un panel aparte)
  const [filaCargando, setFilaCargando] = useState(null) // índice o null
  const [cargaForm, setCargaForm] = useState({})
  const [sugerencia, setSugerencia] = useState(null)
  const [buscandoSugerencia, setBuscandoSugerencia] = useState(false)

  // Precio común nuevo
  const [nuevoComun, setNuevoComun] = useState({ tarea_nombre: '', grupo_pago: '', precio: '' })

  // Queries
  const { data: precios = [], isLoading } = useQuery({
    queryKey: ['precios-maestro', quincena, filtroCliente],
    queryFn: () => listarPreciosMaestro(quincena, filtroCliente || undefined),
    enabled: tab === 1,
  })

  const { data: preciosComunes = [], isLoading: cargandoComunes } = useQuery({
    queryKey: ['precios-comunes', quincena],
    queryFn: () => listarPreciosComunes(quincena),
    enabled: tab === 0,
  })

  // Quincenas con datos para copiar — distintas según la pestaña activa:
  // en "Precios comunes" se copia desde quincenas que tienen comunes,
  // en "Tareas sin precio" se copia desde quincenas que tienen específicos.
  const { data: quincenasExistentes = [] } = useQuery({
    queryKey: ['quincenas-precios', tab],
    queryFn: () => tab === 0 ? listarQuincenasConPreciosComunes() : listarQuincenasConPrecios(),
  })

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: listarClientes,
    staleTime: Infinity,
  })

  const { data: fincas = [] } = useQuery({
    queryKey: ['fincas', clienteNuevo],
    queryFn: () => listarFincas(clienteNuevo),
    enabled: !!clienteNuevo,
  })

  const { data: tareas = [] } = useQuery({
    queryKey: ['tareas'],
    queryFn: listarTareas,
    staleTime: Infinity,
  })

  const { data: gruposPago = [] } = useQuery({
    queryKey: ['grupos-pago'],
    queryFn: listarGruposPago,
    staleTime: Infinity,
  })

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: ['preliquidaciones'],
    queryFn: listarPreliquidaciones,
  })

  // Preliquidación correspondiente a la quincena elegida arriba — se busca
  // automáticamente, sin que el liquidador tenga que elegirla dos veces.
  const preliqDeQuincena = useMemo(
    () => preliquidaciones.find(p => p.quincena === quincena),
    [preliquidaciones, quincena]
  )

  const { data: faltantesCrudo = [], isLoading: cargandoFaltantes } = useQuery({
    queryKey: ['precios-faltantes', preliqDeQuincena?.id],
    queryFn: () => obtenerPreciosFaltantes(preliqDeQuincena.id),
    enabled: tab === 1 && !!preliqDeQuincena,
  })

  // Opciones de filtro derivadas de los faltantes reales de esta quincena
  // (en cascada: cada desplegable solo muestra valores que coexisten con
  // los demás filtros ya elegidos, igual que en Revisión)
  const opcionesFaltantes = useMemo(() => {
    const campoMap = { cliente: 'cliente_nombre', finca: 'finca_nombre', tarea: 'tarea_nombre', grupo_pago: 'grupo_pago' }
    const opcionesPara = (campo) => {
      let subset = faltantesCrudo
      for (const [key, valor] of Object.entries(faltantesFiltros)) {
        if (key === campo || !valor) continue
        subset = subset.filter(f => f[campoMap[key]] === valor)
      }
      return [...new Set(subset.map(f => f[campoMap[campo]]).filter(Boolean))].sort()
    }
    return {
      clientes: opcionesPara('cliente'),
      fincas: opcionesPara('finca'),
      tareas: opcionesPara('tarea'),
      grupos_pago: opcionesPara('grupo_pago'),
    }
  }, [faltantesCrudo, faltantesFiltros])

  const faltantes = useMemo(() => {
    return faltantesCrudo.filter(f => {
      if (faltantesFiltros.cliente && f.cliente_nombre !== faltantesFiltros.cliente) return false
      if (faltantesFiltros.finca && f.finca_nombre !== faltantesFiltros.finca) return false
      if (faltantesFiltros.tarea && f.tarea_nombre !== faltantesFiltros.tarea) return false
      if (faltantesFiltros.grupo_pago && f.grupo_pago !== faltantesFiltros.grupo_pago) return false
      return true
    })
  }, [faltantesCrudo, faltantesFiltros])

  const limpiarFiltrosFaltantes = () => setFaltantesFiltros({ cliente: '', finca: '', tarea: '', grupo_pago: '' })
  const hayFiltrosFaltantesActivos = Object.values(faltantesFiltros).some(Boolean)

  // Al cambiar de quincena, resetear filtros y carga en curso
  useEffect(() => {
    limpiarFiltrosFaltantes()
    setFilaCargando(null)
  }, [quincena])

  // Al cambiar de pestaña, cerrar el panel de copiar y resetear el origen
  // elegido — la lista de quincenas de origen cambia entre comunes/específicos.
  useEffect(() => {
    setMostrarCopiar(false)
    setQuincenaOrigen('')
  }, [tab])

  // Sugerencia al completar cliente+finca+tarea de la fila que se está cargando
  useEffect(() => {
    if (filaCargando === null) { setSugerencia(null); return }
    const f = faltantes[filaCargando]
    if (!f) return
    setBuscandoSugerencia(true)
    obtenerPrecioSugerido(f.cliente_nombre, f.finca_nombre, f.tarea_nombre)
      .then(data => setSugerencia(data.precio_a ? data : null))
      .catch(() => setSugerencia(null))
      .finally(() => setBuscandoSugerencia(false))
  }, [filaCargando])

  const invalidarTodo = () => {
    qc.invalidateQueries({ queryKey: ['precios-maestro'] })
    qc.invalidateQueries({ queryKey: ['precios-comunes'] })
    qc.invalidateQueries({ queryKey: ['quincenas-precios'] })
    qc.invalidateQueries({ queryKey: ['precios-faltantes'] })
  }

  // ── Mutations precios específicos ──
  const { mutate: guardarNuevo, isPending: guardandoNuevo } = useMutation({
    mutationFn: (datos) => crearPrecioMaestro(datos),
    onSuccess: () => {
      toast.success('Precio cargado')
      setFilaCargando(null)
      setCargaForm({})
      setSugerencia(null)
      invalidarTodo()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: guardarEdicion } = useMutation({
    mutationFn: ({ id, datos }) => actualizarPrecioMaestro(id, datos),
    onSuccess: () => {
      toast.success('Precio actualizado')
      setEditandoId(null)
      invalidarTodo()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: eliminar } = useMutation({
    mutationFn: (id) => eliminarPrecioMaestro(id),
    onSuccess: () => { toast.success('Precio eliminado'); invalidarTodo() },
    onError: (err) => toast.error(err.message),
  })

  // Copiar quincena anterior — contextual a la pestaña activa: en
  // "Precios comunes" copia precio_comun, en "Tareas sin precio" copia
  // precio_maestro (específicos). Antes el botón solo hacía lo segundo
  // sin importar en qué pestaña se estuviera.
  const { mutate: copiar, isPending: copiando } = useMutation({
    mutationFn: () => tab === 0
      ? copiarQuincenaComunes(quincenaOrigen, quincena)
      : copiarQuincena(quincenaOrigen, quincena),
    onSuccess: (data) => {
      toast.success(data.detalle || 'Quincena copiada')
      setMostrarCopiar(false)
      setQuincenaOrigen('')
      invalidarTodo()
    },
    onError: (err) => toast.error(err.message),
  })

  // ── Mutations precios comunes ──
  const { mutate: guardarComun, isPending: guardandoComun } = useMutation({
    mutationFn: (datos) => crearPrecioComun(datos),
    onSuccess: () => {
      toast.success('Precio común guardado')
      setNuevoComun({ tarea_nombre: '', grupo_pago: '', precio: '' })
      invalidarTodo()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: eliminarComun } = useMutation({
    mutationFn: (id) => eliminarPrecioComun(id),
    onSuccess: () => { toast.success('Precio común eliminado'); invalidarTodo() },
    onError: (err) => toast.error(err.message),
  })

  const iniciarEdicion = (precio) => {
    setEditandoId(precio.id)
    setEditForm({
      cliente_nombre: precio.cliente_nombre,
      finca_nombre: precio.finca_nombre,
      tarea_nombre: precio.tarea_nombre,
      grupo_pago_default: precio.grupo_pago_default,
      grupo_pago_override: precio.grupo_pago_override || '',
      quincena: precio.quincena,
      precio_a: precio.precio_a || '',
    })
  }

  const handleGuardarEdicion = (id) => {
    guardarEdicion({ id, datos: { ...editForm, precio_a: parseFloat(editForm.precio_a) || null } })
  }

  const iniciarCarga = (idx, f) => {
    setFilaCargando(idx)
    setCargaForm({
      grupo_pago_default: f.grupo_pago || '',
      precio_a: f.precio_sugerido || '',
    })
  }

  const handleGuardarCarga = (f) => {
    if (!cargaForm.grupo_pago_default) {
      toast.error('Elegí el grupo de pago')
      return
    }
    guardarNuevo({
      cliente_nombre: f.cliente_nombre,
      finca_nombre: f.finca_nombre,
      tarea_nombre: f.tarea_nombre,
      grupo_pago_default: cargaForm.grupo_pago_default,
      grupo_pago_override: '',
      quincena,
      precio_a: parseFloat(cargaForm.precio_a) || null,
    })
  }

  const handleGuardarComun = () => {
    if (!nuevoComun.tarea_nombre || !nuevoComun.grupo_pago || !nuevoComun.precio) {
      toast.error('Completá tarea, grupo de pago y precio')
      return
    }
    guardarComun({ ...nuevoComun, quincena, precio: parseFloat(nuevoComun.precio) })
  }

  const preciosFiltrados = precios.filter(p => {
    if (busqueda) {
      const q = busqueda.toLowerCase()
      if (!p.tarea_nombre?.toLowerCase().includes(q) &&
          !p.finca_nombre?.toLowerCase().includes(q) &&
          !p.cliente_nombre?.toLowerCase().includes(q)) return false
    }
    return true
  })

  const etiquetaCopiar = tab === 0 ? 'precios comunes' : 'precios específicos'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Maestro de Precios</h1>
          <p className={styles.sub}>
            Los <strong>precios comunes</strong> aplican a todas las combinaciones por grupo de pago.
            En <strong>tareas sin precio</strong> se cargan los precios específicos que faltan para esta quincena.
          </p>
        </div>
      </header>

      {/* Selector quincena */}
      <div className={styles.topRow}>
        <select className="input" value={quincena} onChange={e => setQuincena(e.target.value)} style={{ width: 200 }}>
          {QUINCENAS_RAPIDAS().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button className="btn btn-sm" onClick={() => setMostrarCopiar(!mostrarCopiar)}>
          ⧉ Copiar {etiquetaCopiar} de quincena anterior
        </button>
      </div>

      {/* Panel copiar quincena — contextual a la pestaña activa */}
      {mostrarCopiar && (
        <div className={styles.copiarPanel}>
          <span className={styles.copiarLabel}>Copiar {etiquetaCopiar} desde:</span>
          <select className="input" value={quincenaOrigen} onChange={e => setQuincenaOrigen(e.target.value)} style={{ width: 180 }}>
            <option value="">— Seleccionar —</option>
            {quincenasExistentes.filter(q => q !== quincena).map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <span className={styles.copiarArrow}>→ {quincena}</span>
          <button className="btn btn-primary btn-sm" onClick={() => copiar()} disabled={!quincenaOrigen || copiando}>
            {copiando ? <><span className="spinner" /> Copiando...</> : 'Copiar'}
          </button>
          <button className="btn btn-sm" onClick={() => setMostrarCopiar(false)}>Cancelar</button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={i} className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`} onClick={() => setTab(i)}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Precios comunes ── */}
      {tab === 0 && (
        <div className={styles.tableSection}>
          {/* Formulario inline para agregar precio común */}
          <div className={styles.comunForm}>
            <div className={styles.comunFormTitle}>AGREGAR PRECIO COMÚN — aplica a todas las combinaciones de ese grupo de pago</div>
            <div className={styles.comunFormRow}>
              <div>
                <div className="field-label">Tarea</div>
                <select className="input" value={nuevoComun.tarea_nombre} onChange={e => setNuevoComun(f => ({ ...f, tarea_nombre: e.target.value }))} style={{ width: 220 }}>
                  <option value="">— Seleccionar —</option>
                  {tareas.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <div className="field-label">Grupo de pago</div>
                <select className="input" value={nuevoComun.grupo_pago} onChange={e => setNuevoComun(f => ({ ...f, grupo_pago: e.target.value }))} style={{ width: 180 }}>
                  <option value="">— Seleccionar —</option>
                  {gruposPago.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <div className="field-label">Precio</div>
                <input className="input input-mono" type="number" placeholder="$0" value={nuevoComun.precio} onChange={e => setNuevoComun(f => ({ ...f, precio: e.target.value }))} style={{ width: 120 }} />
              </div>
              <button className="btn btn-primary" onClick={handleGuardarComun} disabled={guardandoComun} style={{ alignSelf: 'flex-end' }}>
                {guardandoComun ? <span className="spinner" /> : '+ Guardar'}
              </button>
            </div>
          </div>

          {cargandoComunes ? (
            <div className={styles.loading}><span className="spinner" /> Cargando...</div>
          ) : preciosComunes.length === 0 ? (
            <div className={styles.empty}>No hay precios comunes para esta quincena.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TAREA</th>
                    <th>GRUPO DE PAGO</th>
                    <th>PRECIO</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {preciosComunes.map(p => (
                    <tr key={p.id}>
                      <td>{p.tarea_nombre}</td>
                      <td><span className="badge badge-muted mono">{p.grupo_pago}</span></td>
                      <td className="mono" style={{ fontWeight: 500 }}>
                        ${Number(p.precio).toLocaleString('es-AR')}
                      </td>
                      <td>
                        <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('¿Eliminar?')) eliminarComun(p.id) }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: Tareas sin precio ── */}
      {tab === 1 && (
        <div className={styles.tableSection} style={{ overflow: 'auto' }}>

          {!preliqDeQuincena && (
            <div className={styles.empty}>
              No hay una preliquidación generada para esta quincena todavía.
            </div>
          )}

          {preliqDeQuincena && (
            <>
              {/* Filtros — siempre visibles, sin necesidad de hacer click en nada */}
              <div className={styles.faltantesFiltros}>
                <select
                  className="input input-sm"
                  style={{ width: 160 }}
                  value={faltantesFiltros.cliente}
                  onChange={e => setFaltantesFiltros(f => ({ ...f, cliente: e.target.value }))}
                >
                  <option value="">— Cliente —</option>
                  {opcionesFaltantes.clientes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  className="input input-sm"
                  style={{ width: 160 }}
                  value={faltantesFiltros.finca}
                  onChange={e => setFaltantesFiltros(f => ({ ...f, finca: e.target.value }))}
                >
                  <option value="">— Finca —</option>
                  {opcionesFaltantes.fincas.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select
                  className="input input-sm"
                  style={{ width: 180 }}
                  value={faltantesFiltros.tarea}
                  onChange={e => setFaltantesFiltros(f => ({ ...f, tarea: e.target.value }))}
                >
                  <option value="">— Tarea —</option>
                  {opcionesFaltantes.tareas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select
                  className="input input-sm"
                  style={{ width: 150 }}
                  value={faltantesFiltros.grupo_pago}
                  onChange={e => setFaltantesFiltros(f => ({ ...f, grupo_pago: e.target.value }))}
                >
                  <option value="">— Grupo de pago —</option>
                  {opcionesFaltantes.grupos_pago.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                {hayFiltrosFaltantesActivos && (
                  <button className="btn btn-sm" onClick={limpiarFiltrosFaltantes}>✕ Limpiar filtros</button>
                )}
              </div>

              {cargandoFaltantes && <div className={styles.faltantesLoading}><span className="spinner" /> Analizando...</div>}

              {!cargandoFaltantes && faltantesCrudo.length === 0 && (
                <div className={styles.faltantesOk}>✓ Todos los precios están cargados para esta quincena</div>
              )}

              {!cargandoFaltantes && faltantesCrudo.length > 0 && faltantes.length === 0 && (
                <div className={styles.faltantesOk}>Sin resultados para los filtros aplicados.</div>
              )}

              {faltantes.length > 0 && (
                <div className={styles.faltantesTable} style={{ maxHeight: 'none' }}>
                  <div className={styles.faltantesCount}>
                    {faltantes.length} combinaciones sin precio
                    {hayFiltrosFaltantesActivos && ` (de ${faltantesCrudo.length} totales)`}
                  </div>
                  {faltantes.map((f, i) => (
                    <div key={i} className={styles.faltanteRow} style={{ flexWrap: 'wrap' }}>
                      <div className={styles.faltanteInfo}>
                        <span className={styles.faltanteCliente}>{f.cliente_nombre}</span>
                        <span className={styles.faltanteSep}>·</span>
                        <span className={styles.faltanteFinca}>{f.finca_nombre}</span>
                        <span className={styles.faltanteSep}>·</span>
                        <span className={styles.faltanteTarea}>{f.tarea_nombre}</span>
                        {f.grupo_pago && <span className="badge badge-muted" style={{ fontSize: 10 }}>{f.grupo_pago}</span>}
                      </div>

                      {filaCargando === i ? (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', width: '100%', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                          <div>
                            <div className="field-label">Grupo de pago</div>
                            <select
                              className="input input-sm"
                              style={{ width: 160 }}
                              value={cargaForm.grupo_pago_default || ''}
                              onChange={e => setCargaForm(c => ({ ...c, grupo_pago_default: e.target.value }))}
                            >
                              <option value="">— Seleccionar —</option>
                              {gruposPago.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                          </div>
                          <div>
                            <div className="field-label">
                              Precio
                              {buscandoSugerencia && <span style={{ marginLeft: 6, color: 'var(--text-muted)', fontSize: 10 }}>buscando...</span>}
                            </div>
                            <input
                              className="input input-mono input-sm"
                              type="number"
                              placeholder="$0"
                              style={{ width: 120 }}
                              value={cargaForm.precio_a || ''}
                              onChange={e => setCargaForm(c => ({ ...c, precio_a: e.target.value }))}
                              autoFocus
                            />
                          </div>
                          {sugerencia && (
                            <div className={styles.sugerencia} onClick={() => setCargaForm(c => ({ ...c, precio_a: sugerencia.precio_a, grupo_pago_default: sugerencia.grupo_pago_default || c.grupo_pago_default }))}>
                              <span className={styles.sugerenciaPrecio}>${Number(sugerencia.precio_a).toLocaleString('es-AR')}</span>
                              <span className={styles.sugerenciaQ}>({sugerencia.quincena})</span>
                              <span className={styles.sugerenciaUsar}>Usar →</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                            <button className="btn btn-sm" onClick={() => setFilaCargando(null)}>Cancelar</button>
                            <button className="btn btn-primary btn-sm" onClick={() => handleGuardarCarga(f)} disabled={guardandoNuevo}>
                              {guardandoNuevo ? <span className="spinner" /> : 'Guardar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className={styles.faltanteAccion}>
                          {f.precio_sugerido
                            ? <span className={styles.faltanteSugerido}>Último: ${Number(f.precio_sugerido).toLocaleString('es-AR')} ({f.quincena_sugerida})</span>
                            : <span className={styles.faltanteNuevo}>Sin historial</span>
                          }
                          <button className="btn btn-primary btn-sm" onClick={() => iniciarCarga(i, f)}>
                            Cargar precio →
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Precios específicos ya cargados — colapsable, para corregir algo existente */}
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <button
                  className="btn btn-sm"
                  onClick={() => setMostrarCargados(!mostrarCargados)}
                  style={{ marginBottom: mostrarCargados ? 10 : 0 }}
                >
                  {mostrarCargados ? '▾' : '▸'} Precios específicos ya cargados ({precios.length})
                </button>

                {mostrarCargados && (
                  <>
                    <div className={styles.toolbar}>
                      <div className={styles.toolbarLeft}>
                        <select className="input" value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)} style={{ width: 200 }}>
                          <option value="">Todos los clientes</option>
                          {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input className="input" placeholder="Buscar tarea o finca..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={{ width: 220 }} />
                      </div>
                      <span className={styles.contador}>{preciosFiltrados.length} precios</span>
                    </div>

                    {isLoading ? (
                      <div className={styles.loading}><span className="spinner" /> Cargando precios...</div>
                    ) : preciosFiltrados.length === 0 ? (
                      <div className={styles.empty}>Sin resultados.</div>
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>CLIENTE</th>
                              <th>FINCA</th>
                              <th>TAREA</th>
                              <th>GRUPO PAGO</th>
                              <th>OVERRIDE</th>
                              <th>PRECIO A</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {preciosFiltrados.map(precio => (
                              editandoId === precio.id ? (
                                <FilaEdicion key={precio.id} form={editForm} setForm={setEditForm} gruposPago={gruposPago} onGuardar={() => handleGuardarEdicion(precio.id)} onCancelar={() => setEditandoId(null)} />
                              ) : (
                                <tr key={precio.id}>
                                  <td>{precio.cliente_nombre}</td>
                                  <td>{precio.finca_nombre}</td>
                                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{precio.tarea_nombre}</td>
                                  <td><span className="badge badge-muted mono">{precio.grupo_pago_default}</span></td>
                                  <td>
                                    {precio.grupo_pago_override
                                      ? <span className="badge badge-info mono">{precio.grupo_pago_override}</span>
                                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                    }
                                  </td>
                                  <td className="mono" style={{ fontWeight: 500 }}>
                                    {precio.precio_a ? `$${Number(precio.precio_a).toLocaleString('es-AR')}` : <span className="badge badge-warn">Sin precio</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="btn btn-sm" onClick={() => iniciarEdicion(precio)}>Editar</button>
                                      <button className="btn btn-sm btn-danger" onClick={() => { if (confirm('¿Eliminar?')) eliminar(precio.id) }}>✕</button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function FilaEdicion({ form, setForm, gruposPago, onGuardar, onCancelar }) {
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <tr style={{ background: 'var(--accent-glow)' }}>
      <td>{form.cliente_nombre}</td>
      <td>{form.finca_nombre}</td>
      <td>{form.tarea_nombre}</td>
      <td>
        <select className="input input-mono" style={{ minWidth: 140 }} value={form.grupo_pago_default} onChange={e => set('grupo_pago_default', e.target.value)}>
          {gruposPago.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </td>
      <td>
        <select className="input input-mono" style={{ minWidth: 140 }} value={form.grupo_pago_override || ''} onChange={e => set('grupo_pago_override', e.target.value || null)}>
          <option value="">— Default —</option>
          {gruposPago.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </td>
      <td>
        <input className="input input-mono" type="number" style={{ width: 110 }} value={form.precio_a || ''} onChange={e => set('precio_a', e.target.value)} autoFocus />
      </td>
      <td>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-primary btn-sm" onClick={onGuardar}>✓</button>
          <button className="btn btn-sm" onClick={onCancelar}>✕</button>
        </div>
      </td>
    </tr>
  )
}