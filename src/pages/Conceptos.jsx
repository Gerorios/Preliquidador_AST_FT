import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto2,
  copiarConceptos, listarQuincenasConConceptos, listarConceptosFaltantes,
  listarTareas, listarClientes, listarFincas, listarPreliquidaciones,
  obtenerPanelPrecios, aplicarPrecioMasivo,
} from '../services/preliquidacion'
import CargandoContenido from '../components/layout/CargandoContenido'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import styles from './Conceptos.module.css'

// Descriptores de filtro para el Panel de precios (FiltrosBar generalizado).
const CAMPOS_PANEL = [
  { key: 'tarea',   label: 'Tarea',   field: 'tarea_nombre' },
  { key: 'cliente', label: 'Cliente', field: 'cliente_nombre' },
  { key: 'finca',   label: 'Finca',   field: 'finca_nombre' },
]

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

const CATEGORIAS = [1, 2, 3, 4, 5, 6, 7]

const EMPTY_REGLA = { codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '', reemplaza_comun: false }

// ─── ReglaRow: fila editable de una regla ────────────────────────────────────

function ReglaRow({ regla, esComun, onActualizar, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    codigo:      regla.codigo ?? '',
    unidad_base: regla.unidad_base,
    precio:      regla.precio ?? '',
    tipo:        regla.tipo,
    categoria:   regla.categoria ?? '',
    reemplaza_comun: regla.reemplaza_comun ?? false,
  })

  const guardar = () => {
    onActualizar({
      codigo:      form.codigo !== '' ? parseInt(form.codigo) : null,
      unidad_base: form.unidad_base,
      precio:      form.precio !== '' ? parseFloat(form.precio) : null,
      tipo:        form.tipo,
      categoria:   form.categoria !== '' ? parseInt(form.categoria) : null,
      ...(esComun ? {} : { reemplaza_comun: form.reemplaza_comun }),
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
      {regla.categoria != null && (
        <span className="badge badge-muted mono">Cat. {regla.categoria}</span>
      )}
      {regla.heredado && (
        <span className="badge badge-warn">Heredado</span>
      )}
      {!esComun && regla.reemplaza_comun && (
        <span className="badge badge-info" title="Esta línea paga solo lo específico, sin sumar los comunes de la tarea">
          Reemplaza al común
        </span>
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
      <div><div className="field-label">Categoría</div>
        <select className="input" style={{ width: 130 }} value={form.categoria}
          onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
          <option value="">— Sin categoría —</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>Categoría {c}</option>)}
        </select>
      </div>
      {!esComun && (
        <label className={styles.checkboxLabel} title="La línea de esta finca paga solo lo específico, sin sumar los comunes de la tarea">
          <input type="checkbox" checked={form.reemplaza_comun}
            onChange={e => setForm(f => ({ ...f, reemplaza_comun: e.target.checked }))} />
          Reemplaza al común
        </label>
      )}
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
      categoria:   nuevaRegla.categoria !== '' ? parseInt(nuevaRegla.categoria) : null,
      reemplaza_comun: esComun ? false : nuevaRegla.reemplaza_comun,
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
              esComun={esComun}
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
            <div><div className="field-label">Categoría</div>
              <select className="input" style={{ width: 130 }} value={nuevaRegla.categoria}
                onChange={e => setNuevaRegla(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">— Sin categoría —</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>Categoría {c}</option>)}
              </select>
            </div>
            {!esComun && (
              <label className={styles.checkboxLabel} title="La línea de esta finca paga solo lo específico, sin sumar los comunes de la tarea">
                <input type="checkbox" checked={nuevaRegla.reemplaza_comun}
                  onChange={e => setNuevaRegla(f => ({ ...f, reemplaza_comun: e.target.checked }))} />
                Reemplaza al común
              </label>
            )}
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
      categoria:   form.categoria !== '' ? parseInt(form.categoria) : null,
      reemplaza_comun: scope === 'comun' ? false : form.reemplaza_comun,
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
                <div><div className="field-label">Categoría</div>
                  <select className="input" style={{ width: 130 }} value={form.categoria}
                    onChange={e => setForm(fo => ({ ...fo, categoria: e.target.value }))}>
                    <option value="">— Sin categoría —</option>
                    {CATEGORIAS.map(c => <option key={c} value={c}>Categoría {c}</option>)}
                  </select>
                </div>
                {scope === 'especifico' && (
                  <label className={styles.checkboxLabel} title="La línea de esta finca paga solo lo específico, sin sumar los comunes de la tarea">
                    <input type="checkbox" checked={form.reemplaza_comun}
                      onChange={e => setForm(fo => ({ ...fo, reemplaza_comun: e.target.checked }))} />
                    Reemplaza al común
                  </label>
                )}
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

// ─── PanelPrecioRow: fila plana editable del Panel de precios ───────────────

function PanelPrecioRow({ fila, onGuardarPrecio, guardando }) {
  const [editando, setEditando] = useState(false)
  const [precio, setPrecio] = useState(fila.precio ?? '')

  useEffect(() => {
    if (!editando) setPrecio(fila.precio ?? '')
  }, [fila.precio, editando])

  const confirmar = () => {
    const valor = precio !== '' ? parseFloat(precio) : null
    if (valor == null || Number.isNaN(valor)) { toast.error('Ingresá un precio válido'); return }
    onGuardarPrecio(fila.id, valor)
    setEditando(false)
  }

  return (
    <tr className={fila.heredado ? styles.panelRowHeredado : undefined}>
      <td>{fila.tarea_nombre}</td>
      <td className="mono">{fila.codigo ?? '—'}</td>
      <td>{fila.cliente_nombre || <span className={styles.textoMuted}>— (común)</span>}</td>
      <td>{fila.finca_nombre || '—'}</td>
      <td>{fila.categoria != null ? `Cat. ${fila.categoria}` : '—'}</td>
      <td>{UNIDADES.find(u => u.value === fila.unidad_base)?.label || fila.unidad_base}</td>
      <td>
        {fila.reemplaza_comun && (
          <span className="badge badge-info" title="Esta línea paga solo lo específico, sin sumar los comunes de la tarea">
            Reemplaza
          </span>
        )}
      </td>
      <td className="mono">
        {fila.precio_anterior != null ? `$${Number(fila.precio_anterior).toLocaleString('es-AR')}` : '—'}
      </td>
      <td>
        {editando ? (
          <div className={styles.panelPrecioEdit}>
            <input className="input input-mono" type="number" style={{ width: 100 }}
              autoFocus
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }} />
            <button className="btn btn-primary btn-sm" onClick={confirmar} disabled={guardando}>✓</button>
            <button className="btn btn-sm" onClick={() => setEditando(false)}>✕</button>
          </div>
        ) : (
          <span className={styles.panelPrecioValor} onClick={() => setEditando(true)}>
            {fila.precio != null ? `$${Number(fila.precio).toLocaleString('es-AR')}` : <span className={styles.precioVacio}>sin precio</span>}
            {fila.heredado && <span className="badge badge-warn" style={{ marginLeft: 8 }}>Heredado</span>}
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Conceptos() {
  const qc = useQueryClient()
  const [tab, setTab] = useState(1)        // 0=faltantes 1=comunes 2=específicos 3=panel de precios
  const [quincena, setQuincena] = useState('')
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [quincenaOrigen, setQuincenaOrigen] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [soloHeredados, setSoloHeredados] = useState(false)
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [filtroCodigoPanel, setFiltroCodigoPanel] = useState('')
  const [filtrosPanel, setFiltrosPanel] = useState({})
  const [precioMasivo, setPrecioMasivo] = useState('')
  const [formNuevo, setFormNuevo] = useState({
    tarea_nombre: '', cliente_nombre: '', finca_nombre: '',
    codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '',
    reemplaza_comun: false,
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
    enabled: !!quincena && (tab === 1 || tab === 2),
  })

  const { data: panelPrecios = [], isLoading: cargandoPanel } = useQuery({
    queryKey: ['panel-precios', quincena],
    queryFn: () => obtenerPanelPrecios(quincena),
    enabled: !!quincena && tab === 3,
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
    qc.invalidateQueries({ queryKey: ['panel-precios'] })
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

  const { mutate: mutGuardarPrecioPanel, isPending: guardandoPrecioPanel } = useMutation({
    mutationFn: ({ id, precio }) => actualizarConcepto(id, { precio }),
    onSuccess: () => { toast.success('Precio actualizado'); invalidar() },
    onError: err => toast.error(err.message),
  })

  const { mutate: mutPrecioMasivo, isPending: aplicandoMasivo } = useMutation({
    mutationFn: ({ ids, precio }) => aplicarPrecioMasivo(ids, precio),
    onSuccess: data => {
      toast.success(`Precio aplicado a ${data.lineas_afectadas ?? data.actualizados ?? ''} línea(s)`.trim())
      setPrecioMasivo('')
      invalidar()
    },
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

  // Panel de precios: filtro por código (texto, "tipeo y aplico") combinado
  // con los filtros de FiltrosBar (match exacto por tarea/cliente/finca).
  // Los comunes tienen cliente_nombre/finca_nombre en null: al filtrar por
  // esos campos, esas filas simplemente no matchean (no rompen).
  const panelFiltrado = useMemo(() => {
    let filas = panelPrecios
    const qCodigo = filtroCodigoPanel.trim()
    if (qCodigo) {
      filas = filas.filter(f => String(f.codigo ?? '').startsWith(qCodigo))
    }
    for (const c of CAMPOS_PANEL) {
      const valor = filtrosPanel[c.key]
      if (valor) {
        filas = filas.filter(f => f[c.field] === valor)
      }
    }
    return filas
  }, [panelPrecios, filtroCodigoPanel, filtrosPanel])

  const handleAplicarPrecioMasivo = () => {
    const valor = precioMasivo !== '' ? parseFloat(precioMasivo) : null
    if (valor == null || Number.isNaN(valor)) { toast.error('Ingresá un precio válido'); return }
    if (panelFiltrado.length === 0) { toast.error('No hay filas para aplicar'); return }
    if (!window.confirm(`¿Aplicar $${valor.toLocaleString('es-AR')} a ${panelFiltrado.length} fila(s)?`)) return
    mutPrecioMasivo({ ids: panelFiltrado.map(f => f.id), precio: valor })
  }

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
      categoria:   formNuevo.categoria !== '' ? parseInt(formNuevo.categoria) : null,
      reemplaza_comun: tab === 2 ? formNuevo.reemplaza_comun : false,
    })
    setFormNuevo({ tarea_nombre: '', cliente_nombre: '', finca_nombre: '', codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '', reemplaza_comun: false })
    setMostrarNuevo(false)
  }

  const TABS = [
    { label: `Sin concepto${faltantes.length > 0 ? ` (${faltantes.length})` : ''}`, alert: faltantes.length > 0 },
    { label: 'Comunes' },
    { label: 'Específicos' },
    { label: 'Panel de precios' },
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
        {(tab === 1 || tab === 2) && (
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
      {(tab === 1 || tab === 2) && (
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
              <div><div className="field-label">Categoría</div>
                <select className="input" style={{ width: 130 }} value={formNuevo.categoria}
                  onChange={e => setFormNuevo(f => ({ ...f, categoria: e.target.value }))}>
                  <option value="">— Sin categoría —</option>
                  {CATEGORIAS.map(c => <option key={c} value={c}>Categoría {c}</option>)}
                </select>
              </div>
              {tab === 2 && (
                <label className={styles.checkboxLabel} title="La línea de esta finca paga solo lo específico, sin sumar los comunes de la tarea">
                  <input type="checkbox" checked={formNuevo.reemplaza_comun}
                    onChange={e => setFormNuevo(f => ({ ...f, reemplaza_comun: e.target.checked }))} />
                  Reemplaza al común
                </label>
              )}
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

      {/* Tab 3: Panel de precios */}
      {tab === 3 && (
        <div className={styles.tabContent}>
          {/* Una sola barra de filtros: código (texto) + cliente/finca/tarea
              (cascada), todo dentro de FiltrosBar. */}
          <FiltrosBar
            datos={panelPrecios}
            campos={CAMPOS_PANEL}
            filtros={filtrosPanel}
            onChange={setFiltrosPanel}
            busqueda={filtroCodigoPanel}
            onBusqueda={setFiltroCodigoPanel}
            placeholderBusqueda="Filtrar por código..."
            mostrarAlertas={false}
          />

          {/* Barra de acción: precio masivo sobre lo filtrado (no es un filtro). */}
          <div className={styles.searchBar}>
            <input className="input input-mono" type="number" style={{ width: 120 }}
              placeholder="$ precio"
              value={precioMasivo} onChange={e => setPrecioMasivo(e.target.value)} />
            <button className="btn btn-sm btn-primary"
              onClick={handleAplicarPrecioMasivo}
              disabled={aplicandoMasivo || panelFiltrado.length === 0}>
              {aplicandoMasivo ? <><span className="spinner" /> Aplicando...</> : `Aplicar a los filtrados (${panelFiltrado.length})`}
            </button>
            <span className={styles.searchCount}>
              {panelFiltrado.length} de {panelPrecios.length} conceptos
            </span>
          </div>

          <div className={styles.list}>
            {cargandoPanel && <CargandoContenido texto="Cargando panel de precios…" />}
            {!cargandoPanel && panelFiltrado.length === 0 && (
              <div className={styles.empty}>
                {panelPrecios.length === 0
                  ? 'No hay conceptos cargados para esta quincena.'
                  : 'Ningún concepto coincide con los filtros aplicados.'}
              </div>
            )}
            {!cargandoPanel && panelFiltrado.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>TAREA</th><th>CÓDIGO</th><th>CLIENTE</th><th>FINCA</th>
                      <th>CAT</th><th>UNIDAD</th><th>REEMPLAZA</th><th>PRECIO ANTERIOR</th><th>PRECIO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelFiltrado.map(fila => (
                      <PanelPrecioRow
                        key={fila.id}
                        fila={fila}
                        onGuardarPrecio={(id, precio) => mutGuardarPrecioPanel({ id, precio })}
                        guardando={guardandoPrecioPanel}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
