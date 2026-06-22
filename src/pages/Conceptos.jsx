import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarConceptosAgrupados,
  crearConcepto,
  actualizarConcepto,
  eliminarConcepto2,
} from '../services/preliquidacion'

const UNIDADES = [
  { value: 'hsjornal', label: 'Hs. Jornal' },
  { value: 'hsmaquina', label: 'Hs. Máquina' },
  { value: 'tancadas', label: 'Tancadas' },
  { value: 'unidades', label: 'Unidades' },
  { value: 'jornal_tope1', label: 'Jornal (tope 1)' },
  { value: 'fijo', label: 'Fijo' },
]

const TIPOS = [
  { value: 'REMUNERATIVO', label: 'Remunerativo' },
  { value: 'NO_REMUNERATIVO', label: 'No remunerativo' },
  { value: 'JORNAL', label: 'Jornal' },
  { value: 'BONO_BOLSON', label: 'Bono bolsón' },
  { value: 'OTRO', label: 'Otro' },
]

const s = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' },
  sub: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5, maxWidth: 600 },
  toolbar: { display: 'flex', gap: 8, flexShrink: 0 },
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 },
  card: { border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' },
  cardHead: { padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: 12 },
  detalle: { fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 },
  reglasResumen: { display: 'flex', gap: 6, flexShrink: 0 },
  body: { padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 },
  reglaRow: { display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' },
  fieldLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 },
}

export default function Conceptos() {
  const qc = useQueryClient()
  const [busqueda, setBusqueda] = useState('')
  const [soloSinReglas, setSoloSinReglas] = useState(false)
  const [abierto, setAbierto] = useState(null)
  const [nuevaRegla, setNuevaRegla] = useState({})

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['conceptos-agrupados', busqueda, soloSinReglas],
    queryFn: () => listarConceptosAgrupados({
      busqueda: busqueda || undefined,
      solo_sin_reglas: soloSinReglas,
    }),
  })

  const invalidar = () => qc.invalidateQueries({ queryKey: ['conceptos-agrupados'] })

  const { mutate: crear, isPending: creando } = useMutation({
    mutationFn: (datos) => crearConcepto(datos),
    onSuccess: () => { toast.success('Regla agregada'); invalidar() },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: actualizar } = useMutation({
    mutationFn: ({ id, datos }) => actualizarConcepto(id, datos),
    onSuccess: () => { toast.success('Regla actualizada'); invalidar() },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: eliminar } = useMutation({
    mutationFn: (id) => eliminarConcepto2(id),
    onSuccess: () => { toast.success('Regla eliminada'); invalidar() },
    onError: (err) => toast.error(err.message),
  })

  const handleAgregarRegla = (detalle) => {
    const r = nuevaRegla[detalle] || {}
    if (!r.codigo) { toast.error('Ingresá un código'); return }
    crear({
      detalle,
      codigo: parseInt(r.codigo),
      unidad_base: r.unidad_base || 'fijo',
      precio: r.precio ? parseFloat(r.precio) : null,
      tipo: r.tipo || 'OTRO',
    })
    setNuevaRegla(prev => ({ ...prev, [detalle]: {} }))
  }

  const setNueva = (detalle, campo, valor) => {
    setNuevaRegla(prev => ({ ...prev, [detalle]: { ...prev[detalle], [campo]: valor } }))
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Maestro de Conceptos de Liquidación</div>
          <div style={s.sub}>
            Cada combinación de tarea+cliente+finca+grupo de pago puede tener varias reglas
            (código + unidad de medida + precio). Se aplican automáticamente a todas las líneas
            que coincidan con "↻ Aplicar conceptos" desde Revisión.
          </div>
        </div>
      </div>

      <div style={s.toolbar}>
        <input
          className="input"
          style={{ width: 320 }}
          placeholder="Buscar por tarea, cliente, finca..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <button
          className={`btn btn-sm ${soloSinReglas ? 'btn-primary' : ''}`}
          onClick={() => setSoloSinReglas(!soloSinReglas)}
        >
          ⚠ Solo sin reglas
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center' }}>
          {grupos.length} combinaciones
        </span>
      </div>

      <div style={s.list}>
        {isLoading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}><span className="spinner" /> Cargando...</div>}

        {!isLoading && grupos.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No hay combinaciones para mostrar.
          </div>
        )}

        {grupos.map(g => {
          const tieneReglas = g.reglas.some(r => r.codigo !== null)
          return (
            <div key={g.detalle} style={s.card}>
              <div style={s.cardHead} onClick={() => setAbierto(abierto === g.detalle ? null : g.detalle)}>
                <div style={s.detalle}>{g.detalle}</div>
                <div style={s.reglasResumen}>
                  {!tieneReglas && (
                    <span className="badge badge-warn" style={{ fontSize: 10 }}>Sin reglas</span>
                  )}
                  {g.reglas.filter(r => r.codigo !== null).map(r => (
                    <span key={r.id} className="badge badge-muted mono" style={{ fontSize: 10 }}>
                      {r.codigo}
                    </span>
                  ))}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{abierto === g.detalle ? '▲' : '▼'}</span>
                </div>
              </div>

              {abierto === g.detalle && (
                <div style={s.body}>
                  {g.reglas.filter(r => r.codigo !== null).map(r => (
                    <ReglaRow
                      key={r.id}
                      regla={r}
                      onActualizar={(datos) => actualizar({ id: r.id, datos })}
                      onEliminar={() => eliminar(r.id)}
                    />
                  ))}

                  {/* Nueva regla */}
                  <div style={s.reglaRow}>
                    <div>
                      <div style={s.fieldLabel}>Código</div>
                      <input
                        className="input input-mono"
                        type="number"
                        style={{ width: 90 }}
                        value={nuevaRegla[g.detalle]?.codigo || ''}
                        onChange={e => setNueva(g.detalle, 'codigo', e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Unidad de medida</div>
                      <select
                        className="input"
                        style={{ width: 160 }}
                        value={nuevaRegla[g.detalle]?.unidad_base || 'fijo'}
                        onChange={e => setNueva(g.detalle, 'unidad_base', e.target.value)}
                      >
                        {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Precio</div>
                      <input
                        className="input input-mono"
                        type="number"
                        style={{ width: 120 }}
                        placeholder="(usa precio de la línea)"
                        value={nuevaRegla[g.detalle]?.precio || ''}
                        onChange={e => setNueva(g.detalle, 'precio', e.target.value)}
                      />
                    </div>
                    <div>
                      <div style={s.fieldLabel}>Tipo</div>
                      <select
                        className="input"
                        style={{ width: 160 }}
                        value={nuevaRegla[g.detalle]?.tipo || 'OTRO'}
                        onChange={e => setNueva(g.detalle, 'tipo', e.target.value)}
                      >
                        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => handleAgregarRegla(g.detalle)} disabled={creando}>
                      {creando ? <span className="spinner" /> : '+ Agregar regla'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReglaRow({ regla, onActualizar, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    codigo: regla.codigo,
    unidad_base: regla.unidad_base,
    precio: regla.precio ?? '',
    tipo: regla.tipo,
  })

  const guardar = () => {
    onActualizar({
      codigo: parseInt(form.codigo),
      unidad_base: form.unidad_base,
      precio: form.precio === '' ? null : parseFloat(form.precio),
      tipo: form.tipo,
    })
    setEditando(false)
  }

  if (!editando) {
    return (
      <div style={{ ...s.reglaRow, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
        <span className="badge badge-muted mono" style={{ fontSize: 11 }}>Código {regla.codigo}</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {UNIDADES.find(u => u.value === regla.unidad_base)?.label || regla.unidad_base}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
          {regla.precio != null ? `$${Number(regla.precio).toLocaleString('es-AR')}` : '(precio de línea)'}
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
  }

  return (
    <div style={{ ...s.reglaRow, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <input className="input input-mono" type="number" style={{ width: 90 }} value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} />
      <select className="input" style={{ width: 160 }} value={form.unidad_base} onChange={e => setForm(f => ({ ...f, unidad_base: e.target.value }))}>
        {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
      </select>
      <input className="input input-mono" type="number" style={{ width: 120 }} value={form.precio} onChange={e => setForm(f => ({ ...f, precio: e.target.value }))} />
      <select className="input" style={{ width: 160 }} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
        {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4 }}>
        <button className="btn btn-primary btn-sm" onClick={guardar}>✓</button>
        <button className="btn btn-sm" onClick={() => setEditando(false)}>✕</button>
      </div>
    </div>
  )
}