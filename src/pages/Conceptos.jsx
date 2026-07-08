import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto2,
  copiarConceptos, listarQuincenasConConceptos, listarConceptosFaltantes,
  listarTareas, listarClientes, listarFincas, listarPreliquidaciones,
} from '../services/preliquidacion'
import CargandoContenido from '../components/layout/CargandoContenido'
import styles from './Conceptos.module.css'

// ─── Constantes ───────────────────────────────────────────────────────────────

// Convierte una fecha ISO (YYYY-MM-DD) de quincena en el label amigable
// "1ra MAY 2026" / "2da MAY 2026" (día 1-15 = 1ra, 16+ = 2da).
const formatQuincenaLabel = (fechaISO) => {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const mes = new Date(y, m - 1, 1).toLocaleString('es-AR', { month: 'short' }).toUpperCase()
  return `${d <= 15 ? '1ra' : '2da'} ${mes} ${y}`
}

const UNIDADES = [
  { value: 'hsjornal',     label: 'Hs. Jornal' },
  { value: 'hsmaquina',    label: 'Hs. Máquina' },
  { value: 'tancadas',     label: 'Tancadas' },
  { value: 'unidades',     label: 'Unidades' },
  { value: 'jornal_tope1', label: 'Jornal (tope 1)' },
  { value: 'fijo',         label: 'Fijo' },
]

const TIPOS = [
  { value: 'REMUNERATIVO',    label: 'Remunerativo' },
  { value: 'NO_REMUNERATIVO', label: 'No remunerativo' },
  { value: 'JORNAL',          label: 'Jornal' },
  { value: 'BONO_BOLSON',     label: 'Bono bolsón' },
  { value: 'OTRO',            label: 'Otro' },
]

const EMPTY_REGLA = { codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO' }

// ─── ReglaRow: fila editable de una regla ────────────────────────────────────

function ReglaRow({ regla, onActualizar, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    codigo:      regla.codigo ?? '',
    unidad_base: regla.unidad_base,
    precio:      regla.precio ?? '',
    tipo:        regla.tipo,
  })

  const guardar = () => {
    onActualizar({
      codigo:      form.codigo !== '' ? parseInt(form.codigo) : null,
      unidad_base: form.unidad_base,
      precio:      form.precio !== '' ? parseFloat(form.precio) : null,
      tipo:        form.tipo,
    })
    setEditando(false)
  }

  if (!editando) return (
    <div className={styles.reglaRow}>
      <span className="badge badge-muted mono">
        {regla.codigo != null ? `Cód. ${regla.codigo}` : <span className={styles.textoMuted}>Sin código</span>}
      </span>
      <span className={styles.unidadValor}>
        {UNIDADES.find(u => u.value === regla.unidad_base)?.label || regla.unidad_base}
      </span>
      <span className={styles.precioValor}>
        {regla.precio != null ? `$${Number(regla.precio).toLocaleString('es-AR')}` : <span className={styles.precioVacio}>sin precio</span>}
      </span>
      <span className="badge badge-info">
        {TIPOS.find(t => t.value === regla.tipo)?.label || regla.tipo}
      </span>
      {regla.heredado && (
        <span className="badge badge-warn">Heredado</span>
      )}
      <div className={styles.rowActions}>
        <button className="btn btn-sm" onClick={() => setEditando(true)}>Editar</button>
        <button className="btn btn-sm btn-danger" onClick={onEliminar}>✕</button>
      </div>
    </div>
  )

  return (
    <div className={styles.reglaRow}>
      <div><div className="field-label">Código</div>
        <input className="input input-mono" type="number" style={{ width: 90 }}
          value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
      </div>
      <div><div className="field-label">Unidad</div>
        <select className="input" style={{ width: 150 }} value={form.unidad_base}
          onChange={e => setForm(f => ({ ...f, unidad_base: e.target.value }))}>
          {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <div><div className="field-label">Precio</div>
        <input className="input input-mono" type="number" style={{ width: 120 }}
          value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
      </div>
      <div><div className="field-label">Tipo</div>
        <select className="input" style={{ width: 150 }} value={form.tipo}
          onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div className={styles.rowActions} style={{ marginLeft: 0, alignSelf: 'flex-end' }}>
        <button className="btn btn-primary btn-sm" onClick={guardar}>✓</button>
        <button className="btn btn-sm" onClick={() => setEditando(false)}>✕</button>
      </div>
    </div>
  )
}

// ─── GrupoCard: card colapsable para tarea+cliente+finca ─────────────────────

function GrupoCard({ reglas, quincena, esComun, mutCrear, mutActualizar, mutEliminar }) {
  const [abierto, setAbierto] = useState(false)
  const [nuevaRegla, setNuevaRegla] = useState(EMPTY_REGLA)

  const primera = reglas[0]
  const titulo = esComun
    ? `${primera.tarea_nombre}`
    : `${primera.tarea_nombre} — ${primera.cliente_nombre}${primera.finca_nombre ? ` / ${primera.finca_nombre}` : ''}`

  const handleAgregar = () => {
    if (!nuevaRegla.codigo) { toast.error('Ingresá un código'); return }
    mutCrear({
      quincena,
      tarea_nombre:   primera.tarea_nombre,
      cliente_nombre: esComun ? null : primera.cliente_nombre,
      finca_nombre:   esComun ? null : primera.finca_nombre,
      codigo:      parseInt(nuevaRegla.codigo),
      unidad_base: nuevaRegla.unidad_base,
      precio:      nuevaRegla.precio !== '' ? parseFloat(nuevaRegla.precio) : null,
      tipo:        nuevaRegla.tipo,
    })
    setNuevaRegla(EMPTY_REGLA)
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead} onClick={() => setAbierto(o => !o)}>
        <span className={styles.cardTitle}>{titulo}</span>
        <div className={styles.cardBadges}>
          {reglas.filter(r => r.codigo != null).map(r => (
            <span key={r.id} className="badge badge-muted mono">{r.codigo}</span>
          ))}
          {reglas.every(r => r.codigo == null) && (
            <span className="badge badge-warn">Sin código</span>
          )}
          {reglas.some(r => r.heredado) && (
            <span className="badge badge-warn">Heredado</span>
          )}
        </div>
        <span className={styles.cardChevron}>{abierto ? '▲' : '▼'}</span>
      </div>

      {abierto && (
        <div className={styles.cardBody}>
          {reglas.map(r => (
            <ReglaRow
              key={r.id}
              regla={r}
              onActualizar={(datos) => mutActualizar({ id: r.id, datos })}
              onEliminar={() => mutEliminar(r.id)}
            />
          ))}

          {/* Agregar nueva regla */}
          <div className={`${styles.reglaRow} ${styles.reglaRowNew}`}>
            <div><div className="field-label">Código</div>
              <input className="input input-mono" type="number" style={{ width: 90 }} placeholder="—"
                value={nuevaRegla.codigo}
                onChange={e => setNuevaRegla(f => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div><div className="field-label">Unidad</div>
              <select className="input" style={{ width: 150 }} value={nuevaRegla.unidad_base}
                onChange={e => setNuevaRegla(f => ({ ...f, unidad_base: e.target.value }))}>
                {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div><div className="field-label">Precio</div>
              <input className="input input-mono" type="number" style={{ width: 120 }} placeholder="$0"
                value={nuevaRegla.precio}
                onChange={e => setNuevaRegla(f => ({ ...f, precio: e.target.value }))} />
            </div>
            <div><div className="field-label">Tipo</div>
              <select className="input" style={{ width: 150 }} value={nuevaRegla.tipo}
                onChange={e => setNuevaRegla(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}
              onClick={handleAgregar}>
              + Agregar regla
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FilaFaltante: fila expandible de la tabla "Sin concepto" ────────────────

function FilaFaltante({ f, idx, quincena, todasFaltantes, mutCrear }) {
  const [abierta, setAbierta] = useState(false)
  const [scope, setScope] = useState('especifico') // 'especifico' | 'comun'
  const [form, setForm] = useState(EMPTY_REGLA)

  const cantidadConMismaTarea = useMemo(
    () => todasFaltantes.filter(x => x.tarea_nombre === f.tarea_nombre).length,
    [todasFaltantes, f.tarea_nombre]
  )

  const handleGuardar = () => {
    if (!form.codigo) { toast.error('Ingresá un código'); return }
    mutCrear({
      quincena,
      tarea_nombre:   f.tarea_nombre,
      cliente_nombre: scope === 'comun' ? null : f.cliente_nombre,
      finca_nombre:   scope === 'comun' ? null : f.finca_nombre,
      codigo:      parseInt(form.codigo),
      unidad_base: form.unidad_base,
      precio:      form.precio !== '' ? parseFloat(form.precio) : null,
      tipo:        form.tipo,
    })
    setForm(EMPTY_REGLA)
    setAbierta(false)
  }

  return (
    <>
      <tr className={styles.faltanteRow} onClick={() => setAbierta(o => !o)}>
        <td>
          <span className={styles.faltanteChevron}>{abierta ? '▲' : '▼'}</span>
          {f.tarea_nombre}
        </td>
        <td>{f.cliente_nombre || <span className={styles.textoMuted}>— (común)</span>}</td>
        <td>{f.finca_nombre || '—'}</td>
      </tr>
      {abierta && (
        <tr className={styles.faltanteExpandRow}>
          <td colSpan={3}>
            <div className={styles.faltanteExpand}>
              <div className={styles.faltanteTareaFija}>{f.tarea_nombre}</div>

              <div className={styles.scopeChoice}>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={scope === 'especifico'}
                    onChange={() => setScope('especifico')} />
                  Específico — {f.cliente_nombre}{f.finca_nombre ? ` / ${f.finca_nombre}` : ''}
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={scope === 'comun'}
                    onChange={() => setScope('comun')} />
                  Común
                  {cantidadConMismaTarea > 1 && (
                    <span className={styles.textoMuted}> — Afecta a {cantidadConMismaTarea} casos con esta tarea</span>
                  )}
                </label>
              </div>

              <div className={styles.reglaRow}>
                <div><div className="field-label">Código</div>
                  <input className="input input-mono" type="number" style={{ width: 90 }} placeholder="—"
                    value={form.codigo}
                    onChange={e => setForm(fo => ({ ...fo, codigo: e.target.value }))} />
                </div>
                <div><div className="field-label">Unidad</div>
                  <select className="input" style={{ width: 150 }} value={form.unidad_base}
                    onChange={e => setForm(fo => ({ ...fo, unidad_base: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div><div className="field-label">Precio</div>
                  <input className="input input-mono" type="number" style={{ width: 120 }} placeholder="$0"
                    value={form.precio}
                    onChange={e => setForm(fo => ({ ...fo, precio: e.target.value }))} />
                </div>
                <div><div className="field-label">Tipo</div>
                  <select className="input" style={{ width: 150 }} value={form.tipo}
                    onChange={e => setForm(fo => ({ ...fo, tipo: e.target.value }))}>
                    {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={handleGuardar}>
                  Guardar
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Conceptos() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(1)        // 0=faltantes 1=comunes 2=específicos
  const [quincena, setQuincena] = useState('')
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [quincenaOrigen, setQuincenaOrigen] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloHeredados, setSoloHeredados] = useState(false)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    tarea_nombre: '', cliente_nombre: '', finca_nombre: '',
    codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO',
  })

  const scope = tab === 1 ? 'comun' : 'especifico'

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: ['preliquidaciones-generadas'],
    queryFn: listarPreliquidaciones,
  })

  // Quincenas realmente generadas (deduplicadas, más reciente primero).
  const quincenasGeneradas = useMemo(() => {
    const vistas = new Set()
    const lista = []
    for (const p of preliquidaciones) {
      if (!vistas.has(p.quincena)) {
        vistas.add(p.quincena)
        lista.push({ value: p.quincena, label: formatQuincenaLabel(p.quincena) })
      }
    }
    lista.sort((a, b) => b.value.localeCompare(a.value))
    return lista
  }, [preliquidaciones])

  // Arranca en la quincena generada más reciente apenas llega la data.
  useEffect(() => {
    if (!quincena && quincenasGeneradas.length > 0) {
      setQuincena(quincenasGeneradas[0].value)
    }
  }, [quincena, quincenasGeneradas])

  const { data: faltantes = [] } = useQuery({
    queryKey: ['conceptos-faltantes', quincena],
    queryFn: () => listarConceptosFaltantes(quincena),
    enabled: !!quincena,
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['conceptos', quincena, scope],
    queryFn: () => listarConceptos(quincena, scope),
    enabled: !!quincena && tab !== 0,
  })

  const { data: quincenasExistentes = [] } = useQuery({
    queryKey: ['quincenas-conceptos'],
    queryFn: listarQuincenasConConceptos,
  })

  const { data: tareas = [] } = useQuery({ queryKey: ['tareas'], queryFn: listarTareas, staleTime: Infinity })
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: listarClientes, staleTime: Infinity, enabled: tab === 2 })
  const { data: fincas = [] } = useQuery({
    queryKey: ['fincas', formNuevo.cliente_nombre],
    queryFn: () => listarFincas(formNuevo.cliente_nombre),
    enabled: tab === 2 && !!formNuevo.cliente_nombre,
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['conceptos'] })
    qc.invalidateQueries({ queryKey: ['conceptos-faltantes'] })
    qc.invalidateQueries({ queryKey: ['quincenas-conceptos'] })
    // Impacto reactivo (WS2): un cambio de concepto recalcula líneas en el
    // backend, así que refrescamos también Revisión y sus estadísticas.
    qc.invalidateQueries({ queryKey: ['lineas'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  const { mutate: mutCrear } = useMutation({
    mutationFn: crearConcepto,
    onSuccess: () => { toast.success('Regla guardada'); invalidar() },
    onError: err => toast.error(err.message),
  })

  const { mutate: mutActualizar } = useMutation({
    mutationFn: ({ id, datos }) => actualizarConcepto(id, datos),
    onSuccess: () => { toast.success('Regla actualizada'); invalidar() },
    onError: err => toast.error(err.message),
  })

  const { mutate: mutEliminar } = useMutation({
    mutationFn: eliminarConcepto2,
    onSuccess: () => { toast.success('Regla eliminada'); invalidar() },
    onError: err => toast.error(err.message),
  })

  const { mutate: copiar, isPending: copiando } = useMutation({
    mutationFn: () => copiarConceptos(quincenaOrigen, quincena),
    onSuccess: data => {
      toast.success(data.detalle || 'Copiado')
      setMostrarCopiar(false); setQuincenaOrigen(''); invalidar()
    },
    onError: err => toast.error(err.message),
  })

  // Agrupar items por tarea+cliente+finca
  const grupos = useMemo(() => {
    const map = {}
    for (const item of items) {
      const key = tab === 1
        ? item.tarea_nombre
        : `${item.tarea_nombre}||${item.cliente_nombre || ''}||${item.finca_nombre || ''}`
      if (!map[key]) map[key] = []
      map[key].push(item)
    }
    return map
  }, [items, tab])

  const gruposFiltrados = useMemo(() => {
    let entradas = Object.entries(grupos)
    if (busqueda) {
      const q = busqueda.toLowerCase()
      entradas = entradas.filter(([key]) => key.toLowerCase().includes(q))
    }
    if (soloHeredados) {
      entradas = entradas.filter(([, reglas]) => reglas.some(r => r.heredado))
    }
    return Object.fromEntries(entradas)
  }, [grupos, busqueda, soloHeredados])

  const handleCrearNuevo = () => {
    if (!formNuevo.tarea_nombre) { toast.error('Completá la tarea'); return }
    if (tab === 2 && !formNuevo.cliente_nombre) { toast.error('Completá el cliente'); return }
    if (!formNuevo.codigo) { toast.error('Ingresá un código'); return }
    mutCrear({
      quincena,
      tarea_nombre:   formNuevo.tarea_nombre,
      cliente_nombre: tab === 2 ? formNuevo.cliente_nombre : null,
      finca_nombre:   tab === 2 ? (formNuevo.finca_nombre || null) : null,
      codigo:      parseInt(formNuevo.codigo),
      unidad_base: formNuevo.unidad_base,
      precio:      formNuevo.precio !== '' ? parseFloat(formNuevo.precio) : null,
      tipo:        formNuevo.tipo,
    })
    setFormNuevo({ tarea_nombre: '', cliente_nombre: '', finca_nombre: '', codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO' })
    setMostrarNuevo(false)
  }

  const TABS = [
    { label: `Sin concepto${faltantes.length > 0 ? ` (${faltantes.length})` : ''}`, alert: faltantes.length > 0 },
    { label: 'Comunes' },
    { label: 'Específicos' },
  ]

  const cantGrupos = Object.keys(gruposFiltrados).length

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <span className={styles.title}>Maestro de Conceptos y Precios</span>
        <select className="input" value={quincena}
          onChange={e => { setQuincena(e.target.value); setMostrarCopiar(false) }}
          style={{ width: 200 }}
          disabled={quincenasGeneradas.length === 0}>
          {quincenasGeneradas.length === 0
            ? <option value="">— Sin quincenas generadas —</option>
            : quincenasGeneradas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab !== 0 && (
          <button className="btn btn-sm" onClick={() => setMostrarCopiar(o => !o)}>
            ⧉ Copiar de quincena anterior
          </button>
        )}
      </div>

      {/* Panel copiar */}
      {mostrarCopiar && (
        <div className={styles.copyPanel}>
          <span className={styles.textoMuted}>Copiar desde:</span>
          <select className="input" value={quincenaOrigen}
            onChange={e => setQuincenaOrigen(e.target.value)} style={{ width: 180 }}>
            <option value="">— Seleccionar —</option>
            {quincenasExistentes.filter(q => q !== quincena).map(q =>
              <option key={q} value={q}>{q}</option>
            )}
          </select>
          <span className={styles.copyArrow}>→ {quincena}</span>
          <button className="btn btn-primary btn-sm"
            onClick={() => copiar()} disabled={!quincenaOrigen || copiando}>
            {copiando ? <><span className="spinner" /> Copiando...</> : 'Copiar'}
          </button>
          <button className="btn btn-sm" onClick={() => setMostrarCopiar(false)}>Cancelar</button>
        </div>
      )}

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={i}
            className={`chip ${tab === i ? (t.alert ? 'chip-alert' : 'chip-active') : ''}`}
            onClick={() => { setTab(i); setBusqueda(''); setMostrarNuevo(false) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 0: Faltantes */}
      {tab === 0 && (
        <div className={styles.tabPane}>
          {faltantes.length === 0 ? (
            <div className={styles.emptyOk}>
              ✓ Todas las tareas de esta quincena tienen concepto cargado.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TAREA</th><th>CLIENTE</th><th>FINCA</th>
                  </tr>
                </thead>
                <tbody>
                  {faltantes.map((f, i) => (
                    <FilaFaltante
                      key={i}
                      idx={i}
                      f={f}
                      quincena={quincena}
                      todasFaltantes={faltantes}
                      mutCrear={mutCrear}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tabs 1 y 2: Comunes / Específicos */}
      {tab !== 0 && (
        <div className={styles.tabContent}>
          {/* Barra búsqueda + nuevo */}
          <div className={styles.searchBar}>
            <input className="input" style={{ width: 320 }}
              placeholder={tab === 1 ? 'Buscar tarea...' : 'Buscar tarea, cliente, finca...'}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <label className={styles.checkboxLabel}>
              <input type="checkbox" checked={soloHeredados}
                onChange={e => setSoloHeredados(e.target.checked)} />
              Mostrar solo heredados
            </label>
            <button className="btn btn-sm btn-primary" onClick={() => setMostrarNuevo(o => !o)}>
              {mostrarNuevo ? '✕ Cancelar' : '+ Nuevo'}
            </button>
            <span className={styles.searchCount}>
              {cantGrupos} {tab === 1 ? 'comunes' : 'específicos'}
            </span>
          </div>

          {/* Formulario nuevo grupo */}
          {mostrarNuevo && (
            <div className={styles.newGroupForm}>
              <div><div className="field-label">Tarea</div>
                <select className="input" style={{ width: 220 }} value={formNuevo.tarea_nombre}
                  onChange={e => setFormNuevo(f => ({ ...f, tarea_nombre: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {tareas.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              {tab === 2 && (
                <>
                  <div><div className="field-label">Cliente</div>
                    <select className="input" style={{ width: 180 }} value={formNuevo.cliente_nombre}
                      onChange={e => setFormNuevo(f => ({ ...f, cliente_nombre: e.target.value, finca_nombre: '' }))}>
                      <option value="">— Seleccionar —</option>
                      {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><div className="field-label">Finca</div>
                    <select className="input" style={{ width: 160 }} value={formNuevo.finca_nombre}
                      onChange={e => setFormNuevo(f => ({ ...f, finca_nombre: e.target.value }))}
                      disabled={!formNuevo.cliente_nombre}>
                      <option value="">— Seleccionar —</option>
                      {fincas.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div><div className="field-label">Código</div>
                <input className="input input-mono" type="number" style={{ width: 90 }} placeholder="—"
                  value={formNuevo.codigo}
                  onChange={e => setFormNuevo(f => ({ ...f, codigo: e.target.value }))} />
              </div>
              <div><div className="field-label">Unidad</div>
                <select className="input" style={{ width: 150 }} value={formNuevo.unidad_base}
                  onChange={e => setFormNuevo(f => ({ ...f, unidad_base: e.target.value }))}>
                  {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div><div className="field-label">Precio</div>
                <input className="input input-mono" type="number" style={{ width: 120 }} placeholder="$0"
                  value={formNuevo.precio}
                  onChange={e => setFormNuevo(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div><div className="field-label">Tipo</div>
                <select className="input" style={{ width: 150 }} value={formNuevo.tipo}
                  onChange={e => setFormNuevo(f => ({ ...f, tipo: e.target.value }))}>
                  {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}
                onClick={handleCrearNuevo}>
                Guardar
              </button>
            </div>
          )}

          {/* Lista colapsable */}
          <div className={styles.list}>
            {isLoading && <CargandoContenido texto="Cargando conceptos…" />}
            {!isLoading && cantGrupos === 0 && (
              <div className={styles.empty}>
                No hay conceptos {tab === 1 ? 'comunes' : 'específicos'} para esta quincena.
                Usá "+ Nuevo" para agregar.
              </div>
            )}
            {Object.entries(gruposFiltrados).map(([key, reglas]) => (
              <GrupoCard
                key={key}
                reglas={reglas}
                quincena={quincena}
                esComun={tab === 1}
                mutCrear={mutCrear}
                mutActualizar={mutActualizar}
                mutEliminar={mutEliminar}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
