import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto2,
  copiarConceptos, listarQuincenasConConceptos, listarConceptosFaltantes,
  listarTareas, listarClientes, listarFincas,
} from '../services/preliquidacion'

// ─── Constantes ───────────────────────────────────────────────────────────────

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

const s = {
  page:       { display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' },
  topbar:     { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' },
  title:      { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginRight: 'auto' },
  tabs:       { display: 'flex', gap: 4, flexShrink: 0 },
  tab:        { padding: '5px 14px', fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)' },
  tabActive:  { background: 'var(--accent)', border: '1px solid var(--accent)', color: '#fff' },
  tabAlert:   { background: '#c0392b', border: '1px solid #c0392b', color: '#fff' },
  list:       { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  card:       { border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' },
  cardHead:   { padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  cardBody:   { padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 },
  reglaRow:   { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', padding: '6px 0', borderBottom: '1px solid var(--border)' },
  fieldLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 3 },
  copyPanel:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 12 },
}

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
    <div style={s.reglaRow}>
      <span className="badge badge-muted mono" style={{ fontSize: 11 }}>
        {regla.codigo != null ? `Cód. ${regla.codigo}` : <span style={{ color: 'var(--text-muted)' }}>Sin código</span>}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)', minWidth: 120 }}>
        {UNIDADES.find(u => u.value === regla.unidad_base)?.label || regla.unidad_base}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)', minWidth: 100 }}>
        {regla.precio != null ? `$${Number(regla.precio).toLocaleString('es-AR')}` : <span style={{ color: 'var(--text-muted)' }}>sin precio</span>}
      </span>
      <span className="badge badge-info" style={{ fontSize: 10 }}>
        {TIPOS.find(t => t.value === regla.tipo)?.label || regla.tipo}
      </span>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
        <button className="btn btn-sm" onClick={() => setEditando(true)}>Editar</button>
        <button className="btn btn-sm btn-danger" onClick={onEliminar}>✕</button>
      </div>
    </div>
  )

  return (
    <div style={s.reglaRow}>
      <div><div style={s.fieldLabel}>Código</div>
        <input className="input input-mono" type="number" style={{ width: 90 }}
          value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
      </div>
      <div><div style={s.fieldLabel}>Unidad</div>
        <select className="input" style={{ width: 150 }} value={form.unidad_base}
          onChange={e => setForm(f => ({ ...f, unidad_base: e.target.value }))}>
          {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </div>
      <div><div style={s.fieldLabel}>Precio</div>
        <input className="input input-mono" type="number" style={{ width: 120 }}
          value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
      </div>
      <div><div style={s.fieldLabel}>Tipo</div>
        <select className="input" style={{ width: 150 }} value={form.tipo}
          onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
          {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4, alignSelf: 'flex-end' }}>
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

  const grupoKey = esComun
    ? primera.tarea_nombre
    : `${primera.tarea_nombre}||${primera.cliente_nombre}||${primera.finca_nombre}`

  return (
    <div style={s.card}>
      <div style={s.cardHead} onClick={() => setAbierto(o => !o)}>
        <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{titulo}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {reglas.filter(r => r.codigo != null).map(r => (
            <span key={r.id} className="badge badge-muted mono" style={{ fontSize: 10 }}>{r.codigo}</span>
          ))}
          {reglas.every(r => r.codigo == null) && (
            <span className="badge badge-warn" style={{ fontSize: 10 }}>Sin código</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 8 }}>{abierto ? '▲' : '▼'}</span>
      </div>

      {abierto && (
        <div style={s.cardBody}>
          {reglas.map(r => (
            <ReglaRow
              key={r.id}
              regla={r}
              onActualizar={(datos) => mutActualizar({ id: r.id, datos })}
              onEliminar={() => mutEliminar(r.id)}
            />
          ))}

          {/* Agregar nueva regla */}
          <div style={{ ...s.reglaRow, borderBottom: 'none', paddingTop: 10 }}>
            <div><div style={s.fieldLabel}>Código</div>
              <input className="input input-mono" type="number" style={{ width: 90 }} placeholder="—"
                value={nuevaRegla.codigo}
                onChange={e => setNuevaRegla(f => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div><div style={s.fieldLabel}>Unidad</div>
              <select className="input" style={{ width: 150 }} value={nuevaRegla.unidad_base}
                onChange={e => setNuevaRegla(f => ({ ...f, unidad_base: e.target.value }))}>
                {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div><div style={s.fieldLabel}>Precio</div>
              <input className="input input-mono" type="number" style={{ width: 120 }} placeholder="$0"
                value={nuevaRegla.precio}
                onChange={e => setNuevaRegla(f => ({ ...f, precio: e.target.value }))} />
            </div>
            <div><div style={s.fieldLabel}>Tipo</div>
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

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Conceptos() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(1)        // 0=faltantes 1=comunes 2=específicos
  const [quincena, setQuincena] = useState(QUINCENAS_RAPIDAS()[0].value)
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [quincenaOrigen, setQuincenaOrigen] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [formNuevo, setFormNuevo] = useState({
    tarea_nombre: '', cliente_nombre: '', finca_nombre: '',
    codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO',
  })

  const scope = tab === 1 ? 'comun' : 'especifico'

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
    if (!busqueda) return grupos
    const q = busqueda.toLowerCase()
    return Object.fromEntries(
      Object.entries(grupos).filter(([key]) => key.toLowerCase().includes(q))
    )
  }, [grupos, busqueda])

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
    <div style={s.page}>
      {/* Topbar */}
      <div style={s.topbar}>
        <span style={s.title}>Maestro de Conceptos y Precios</span>
        <select className="input" value={quincena}
          onChange={e => { setQuincena(e.target.value); setMostrarCopiar(false) }}
          style={{ width: 200 }}>
          {QUINCENAS_RAPIDAS().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab !== 0 && (
          <button className="btn btn-sm" onClick={() => setMostrarCopiar(o => !o)}>
            ⧉ Copiar de quincena anterior
          </button>
        )}
      </div>

      {/* Panel copiar */}
      {mostrarCopiar && (
        <div style={s.copyPanel}>
          <span style={{ color: 'var(--text-muted)' }}>Copiar desde:</span>
          <select className="input" value={quincenaOrigen}
            onChange={e => setQuincenaOrigen(e.target.value)} style={{ width: 180 }}>
            <option value="">— Seleccionar —</option>
            {quincenasExistentes.filter(q => q !== quincena).map(q =>
              <option key={q} value={q}>{q}</option>
            )}
          </select>
          <span style={{ color: 'var(--text-muted)' }}>→ {quincena}</span>
          <button className="btn btn-primary btn-sm"
            onClick={() => copiar()} disabled={!quincenaOrigen || copiando}>
            {copiando ? <><span className="spinner" /> Copiando...</> : 'Copiar'}
          </button>
          <button className="btn btn-sm" onClick={() => setMostrarCopiar(false)}>Cancelar</button>
        </div>
      )}

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map((t, i) => (
          <button key={i}
            style={{ ...s.tab, ...(tab === i ? (t.alert ? s.tabAlert : s.tabActive) : {}) }}
            onClick={() => { setTab(i); setBusqueda(''); setMostrarNuevo(false) }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 0: Faltantes */}
      {tab === 0 && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {faltantes.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
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
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{f.tarea_nombre}</td>
                      <td style={{ fontSize: 12 }}>{f.cliente_nombre || <span style={{ color: 'var(--text-muted)' }}>— (común)</span>}</td>
                      <td style={{ fontSize: 12 }}>{f.finca_nombre || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tabs 1 y 2: Comunes / Específicos */}
      {tab !== 0 && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Barra búsqueda + nuevo */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <input className="input" style={{ width: 320 }}
              placeholder={tab === 1 ? 'Buscar tarea...' : 'Buscar tarea, cliente, finca...'}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <button className="btn btn-sm btn-primary" onClick={() => setMostrarNuevo(o => !o)}>
              {mostrarNuevo ? '✕ Cancelar' : '+ Nuevo'}
            </button>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
              {cantGrupos} {tab === 1 ? 'comunes' : 'específicos'}
            </span>
          </div>

          {/* Formulario nuevo grupo */}
          {mostrarNuevo && (
            <div style={{ ...s.cardBody, border: '1px solid var(--accent-dim)', borderRadius: 6, flexShrink: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <div><div style={s.fieldLabel}>Tarea</div>
                <select className="input" style={{ width: 220 }} value={formNuevo.tarea_nombre}
                  onChange={e => setFormNuevo(f => ({ ...f, tarea_nombre: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {tareas.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              {tab === 2 && (
                <>
                  <div><div style={s.fieldLabel}>Cliente</div>
                    <select className="input" style={{ width: 180 }} value={formNuevo.cliente_nombre}
                      onChange={e => setFormNuevo(f => ({ ...f, cliente_nombre: e.target.value, finca_nombre: '' }))}>
                      <option value="">— Seleccionar —</option>
                      {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div><div style={s.fieldLabel}>Finca</div>
                    <select className="input" style={{ width: 160 }} value={formNuevo.finca_nombre}
                      onChange={e => setFormNuevo(f => ({ ...f, finca_nombre: e.target.value }))}
                      disabled={!formNuevo.cliente_nombre}>
                      <option value="">— Seleccionar —</option>
                      {fincas.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div><div style={s.fieldLabel}>Código</div>
                <input className="input input-mono" type="number" style={{ width: 90 }} placeholder="—"
                  value={formNuevo.codigo}
                  onChange={e => setFormNuevo(f => ({ ...f, codigo: e.target.value }))} />
              </div>
              <div><div style={s.fieldLabel}>Unidad</div>
                <select className="input" style={{ width: 150 }} value={formNuevo.unidad_base}
                  onChange={e => setFormNuevo(f => ({ ...f, unidad_base: e.target.value }))}>
                  {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div><div style={s.fieldLabel}>Precio</div>
                <input className="input input-mono" type="number" style={{ width: 120 }} placeholder="$0"
                  value={formNuevo.precio}
                  onChange={e => setFormNuevo(f => ({ ...f, precio: e.target.value }))} />
              </div>
              <div><div style={s.fieldLabel}>Tipo</div>
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
          <div style={s.list}>
            {isLoading && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="spinner" /> Cargando...
              </div>
            )}
            {!isLoading && cantGrupos === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
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