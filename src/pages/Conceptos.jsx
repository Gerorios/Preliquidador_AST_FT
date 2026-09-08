import { useState, useMemo, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarConceptos, crearConcepto, actualizarConcepto, eliminarConcepto2,
  copiarConceptos, listarQuincenasConConceptos, listarConceptosFaltantes,
  listarSolapamientos,
  listarTareas, listarClientes, listarFincas, listarPreliquidaciones,
  obtenerPanelPrecios, aplicarPrecioMasivo, listarSupervisores,
} from '../services/preliquidacion'
import { listarQuincenasGerencial } from '../services/gerencial'
import CargandoContenido from '../core/ui/CargandoContenido'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import PanelPorConcepto from './PanelPorConcepto'
import useAuthStore from '../core/authStore'
import styles from './Conceptos.module.css'
import { UNIDADES, TIPOS, CATEGORIAS } from './conceptosConstantes'

// Descriptores de filtro para el Panel de precios y la tab Específicos
// (FiltrosBar generalizado — ambos filtran por los mismos tres campos).
const CAMPOS_PANEL = [
  { key: 'tarea',      label: 'Tarea',      field: 'tarea_nombre' },
  { key: 'cliente',    label: 'Cliente',    field: 'cliente_nombre' },
  { key: 'finca',      label: 'Finca',      field: 'finca_nombre' },
  { key: 'supervisor', label: 'Supervisor', field: 'supervisor_nombre' },
]

// Columnas de la tabla del Panel de precios (tab 5) — resizeables estilo
// Excel. 'chk' es la columna del checkbox de selección: no lleva label ni
// resizer (su ancho no se toca). El resto define su ancho default acá y lo
// persiste en localStorage bajo LS_KEY_ANCHOS_PANEL cuando el usuario arrastra.
const COLUMNAS_PANEL = [
  { key: 'chk',       label: null },
  { key: 'tarea',     label: 'TAREA' },
  { key: 'codigo',    label: 'CÓDIGO' },
  { key: 'cliente',   label: 'CLIENTE' },
  { key: 'finca',     label: 'FINCA' },
  { key: 'cat',       label: 'CAT' },
  { key: 'unidad',    label: 'UNIDAD' },
  { key: 'reemplaza', label: 'REEMPLAZA' },
  { key: 'anterior',  label: 'P. ANTERIOR' },
  { key: 'precio',    label: 'PRECIO' },
]
const ANCHOS_PANEL_DEFAULT = {
  chk: 34, tarea: 220, codigo: 50, cliente: 150, finca: 130,
  cat: 40, unidad: 100, reemplaza: 60, anterior: 85, precio: 130,
}
const LS_KEY_ANCHOS_PANEL = 'panel-precios-anchos'
const LS_KEY_VISTA_PANEL = 'panel-precios-vista'

// Los 4 alcances de una regla: común (solo tarea), por cliente (todas las
// fincas de ese cliente), por finca (cliente+finca puntual, el "específico"
// histórico) y por supervisor. Cliente y supervisor son mutuamente
// excluyentes en el backend.
const ALCANCES = [
  { value: 'comun',      label: 'Común' },
  { value: 'cliente',    label: 'Por cliente' },
  { value: 'finca',      label: 'Por finca' },
  { value: 'supervisor', label: 'Por supervisor' },
]

// Deriva el alcance de un item ya guardado a partir de sus campos.
const alcanceDeItem = (item) => {
  if (item.supervisor_nombre) return 'supervisor'
  if (item.cliente_nombre && item.finca_nombre) return 'finca'
  if (item.cliente_nombre) return 'cliente'
  return 'comun'
}

// Tabs 1-4 son las 4 solapas de reglas (una por alcance); cada una pide su
// propio scope al backend (GET /precios/conceptos?scope=comun|cliente|finca|
// supervisor — el viejo 'especifico' quedó legado y ya no se usa). El
// queryKey incluye el scope, así que cada solapa cachea por separado.
const SCOPE_POR_TAB = { 1: 'comun', 2: 'cliente', 3: 'finca', 4: 'supervisor' }
const NOMBRE_SCOPE = { 1: 'comunes', 2: 'por cliente', 3: 'por finca', 4: 'por supervisor' }

// ─── Constantes ───────────────────────────────────────────────────────────────

// Convierte una fecha ISO (YYYY-MM-DD) de quincena en el label amigable
// "1ra MAY 2026" / "2da MAY 2026" (día 1-15 = 1ra, 16+ = 2da).
const formatQuincenaLabel = (fechaISO) => {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const mes = new Date(y, m - 1, 1).toLocaleString('es-AR', { month: 'short' }).toUpperCase()
  return `${d <= 15 ? '1ra' : '2da'} ${mes} ${y}`
}

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
  // Un concepto específico nuevo nace con "Reemplaza al común" tildado; los
  // comunes no muestran el checkbox y viajan siempre en false.
  const [nuevaRegla, setNuevaRegla] = useState({ ...EMPTY_REGLA, reemplaza_comun: !esComun })
  const [reglaCreada, setReglaCreada] = useState(null)

  const primera = reglas[0]
  const alcance = esComun ? 'comun' : alcanceDeItem(primera)
  const titulo = (() => {
    if (esComun) return primera.tarea_nombre
    if (alcance === 'supervisor') return `${primera.tarea_nombre} — Supervisor: ${primera.supervisor_nombre}`
    if (alcance === 'cliente') return `${primera.tarea_nombre} — ${primera.cliente_nombre} (todas las fincas)`
    return `${primera.tarea_nombre} — ${primera.cliente_nombre}${primera.finca_nombre ? ` / ${primera.finca_nombre}` : ''}`
  })()

  const handleAgregar = () => {
    if (!nuevaRegla.codigo) { toast.error('Ingresá un código'); return }
    const codigo = parseInt(nuevaRegla.codigo)
    const datos = {
      quincena,
      tarea_nombre:   primera.tarea_nombre,
      cliente_nombre: esComun ? null : (primera.cliente_nombre ?? null),
      finca_nombre:   esComun ? null : (primera.finca_nombre ?? null),
      supervisor_nombre: esComun ? null : (primera.supervisor_nombre ?? null),
      codigo,
      unidad_base: nuevaRegla.unidad_base,
      precio:      nuevaRegla.precio !== '' ? parseFloat(nuevaRegla.precio) : null,
      tipo:        nuevaRegla.tipo,
      categoria:   nuevaRegla.categoria !== '' ? parseInt(nuevaRegla.categoria) : null,
      reemplaza_comun: esComun ? false : nuevaRegla.reemplaza_comun,
    }
    const onSuccess = () => {
      setNuevaRegla({ ...EMPTY_REGLA, reemplaza_comun: !esComun })
      setReglaCreada(codigo)
    }
    // Desde un grupo no sabemos qué finca falta: el diálogo solo ofrece
    // "Sumar igual" o "Cancelar". El onError vive en la mutation (ver
    // mutCrear más abajo en Conceptos()), así que acá solo pasamos variables.
    mutCrear({ datos, onSuccess, fincaNueva: null })
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead} onClick={() => setAbierto(o => !o)}>
        <span className={styles.cardTitle}>{titulo}</span>
        <div className={styles.cardBadges}>
          {alcance === 'cliente' && (
            <span className="badge badge-info">Cliente: {primera.cliente_nombre} — todas las fincas</span>
          )}
          {alcance === 'supervisor' && (
            <span className="badge badge-info">Supervisor: {primera.supervisor_nombre}</span>
          )}
          {reglas.filter(r => r.codigo != null).map(r => (
            <span key={r.id} className="badge badge-muted mono">{r.codigo}</span>
          ))}
          {reglas.every(r => r.codigo == null) && (
            <span className="badge badge-warn">Sin código</span>
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
          {reglaCreada != null ? (
            <PromptOtraRegla
              codigo={reglaCreada}
              combo={titulo}
              onOtra={() => setReglaCreada(null)}
              onListo={() => { setReglaCreada(null); setAbierto(false) }}
            />
          ) : (
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
          )}
        </div>
      )}
    </div>
  )
}

// ─── FranjaSolapamientos: aviso persistente de solapamientos por cliente ─────
//
// Solo se renderiza cuando hay al menos uno. Un solapamiento es una
// anomalía, no trabajo cotidiano: no merece solapa propia.
function FranjaSolapamientos({ items, onVerReglas, onVerEspecificas }) {
  const [abierta, setAbierta] = useState(true)
  if (!items.length) return null
  const n = items.length
  return (
    <div className={styles.franjaSolap} role="status">
      <div className={styles.franjaSolapHead} onClick={() => setAbierta(o => !o)}>
        <span>⚠ Esta quincena tiene {n} solapamiento{n === 1 ? '' : 's'} por cliente que suma{n === 1 ? '' : 'n'}</span>
        <span>{abierta ? '▲' : '▼'}</span>
      </div>
      {abierta && items.map(s => (
        <div key={`${s.tarea_nombre}|${s.cliente_nombre}`} className={styles.franjaSolapItem}>
          <span>
            <b>{s.tarea_nombre}</b> · {s.cliente_nombre}: {s.reglas_por_cliente.length} regla(s) por cliente
            {' '}+ {s.especificos.length} específica(s) en {s.fincas.join(', ')} · <b>{s.lineas_afectadas}</b> línea(s)
            {s.codigos_coincidentes.length > 0 && (
              <span className={styles.mismoCodigo}> · mismo código {s.codigos_coincidentes.join(', ')}: cobran DOS VECES</span>
            )}
          </span>
          <button className="btn btn-sm" onClick={() => onVerReglas(s)}>Ver por cliente</button>
          <button className="btn btn-sm" onClick={() => onVerEspecificas(s)}>Ver específicas</button>
        </div>
      ))}
    </div>
  )
}

// ─── DialogoSolapamiento: confirmación ante un 409 de solapamiento por cliente
//
// El backend detectó que la regla que se quiere crear SUMA a reglas del eje
// cliente ya existentes (por cliente vs específicas del mismo cliente —
// ADR-0011 reafirmado). No bloquea: muestra fincas, códigos coincidentes y
// líneas afectadas y pide una decisión explícita. El botón peligroso
// ("Sumar igual") NUNCA es el default.
function DialogoSolapamiento({ solapamiento, candidato, fincaNueva, onCrearSoloFinca, onSumarIgual, onCancelar }) {
  const s = solapamiento
  const esPorClienteSobreEsp = s.direccion === 'por_cliente_sobre_especificos'
  const grave = s.codigos_coincidentes.length > 0
  const n = s.lineas_afectadas

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar])

  const fmtPrecio = (p) => p == null ? '—' : `$ ${Number(p).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="titulo-solap">
      <div className={styles.dialogo}>
        <div id="titulo-solap" className={styles.dialogoTitulo}>
          ⚠ Esta regla se va a SUMAR a reglas ya existentes
        </div>

        <div className={styles.dialogoDatos}>
          <span className={styles.textoMuted}>Tarea</span><b>{s.tarea_nombre}</b>
          <span className={styles.textoMuted}>Cliente</span>
          <b>{s.cliente_nombre}{esPorClienteSobreEsp ? ' (todas las fincas)' : ` / ${candidato.finca_nombre}`}</b>
          <span className={styles.textoMuted}>Nueva regla</span>
          <span>cód. <b className="mono">{candidato.codigo}</b> · {fmtPrecio(candidato.precio)}{candidato.categoria ? ` · cat. ${candidato.categoria}` : ''}</span>
        </div>

        {esPorClienteSobreEsp ? (
          <>
            <div>Ya existen <b>{s.especificos.length}</b> regla(s) específica(s) de {s.cliente_nombre} para esta tarea:</div>
            <ul className={styles.dialogoLista}>
              {s.especificos.map(e => (
                <li key={e.id}>
                  Finca <b>{e.finca_nombre}</b> · cód. <span className="mono">{e.codigo ?? '—'}</span>
                  {e.categoria ? ` · cat. ${e.categoria}` : ''} · {fmtPrecio(e.precio)}
                  {e.mismo_codigo && <span className={styles.mismoCodigo}> ← mismo código</span>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div>Esta finca ya cobra por regla(s) <b>por cliente</b> de {s.cliente_nombre} (todas las fincas):</div>
            <ul className={styles.dialogoLista}>
              {s.reglas_por_cliente.map(r => (
                <li key={r.id}>
                  cód. <span className="mono">{r.codigo ?? '—'}</span>
                  {r.categoria ? ` · cat. ${r.categoria}` : ''} · {fmtPrecio(r.precio)}
                  {s.codigos_coincidentes.includes(r.codigo) && <span className={styles.mismoCodigo}> ← mismo código</span>}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className={`${styles.dialogoImpacto} ${grave ? styles.dialogoImpactoGrave : ''}`}>
          {grave
            ? <>Las <b>{n}</b> línea(s) de esta quincena que matchean ambas reglas cobrarían el código <span className="mono">{s.codigos_coincidentes.join(', ')}</span> DOS VECES.</>
            : <><b>{n}</b> línea(s) de esta quincena matchean ambas reglas y cobrarían las dos (códigos distintos).</>}
          {n === 0 && <div className={styles.textoMuted}>Hoy no hay líneas afectadas, pero el maestro se hereda a la quincena siguiente.</div>}
          {fincaNueva && <div>Solo la finca <b>{fincaNueva}</b> no tiene regla.</div>}
        </div>

        <div className={styles.dialogoBotones}>
          {onCrearSoloFinca
            ? <button className="btn btn-primary" autoFocus onClick={onCrearSoloFinca}>Crear solo para {fincaNueva}</button>
            : <button className="btn" autoFocus onClick={onCancelar}>Cancelar</button>}
          <button className="btn btn-danger" onClick={onSumarIgual}>
            {esPorClienteSobreEsp ? `Sumar igual a las ${s.especificos.length}` : 'Sumar igual'}
          </button>
          {onCrearSoloFinca && <button className="btn" onClick={onCancelar}>Cancelar</button>}
        </div>
      </div>
    </div>
  )
}

// ─── PromptOtraRegla: pregunta inline tras crear una regla ──────────────────
// Reemplaza al formulario recién confirmado; "Sí, otra" lo re-abre con el
// combo conservado, "No, listo" cierra como siempre.

function PromptOtraRegla({ codigo, combo, onOtra, onListo }) {
  return (
    <div className={styles.promptOtra}>
      <span>
        ✓ Regla <b className="mono">{codigo}</b> creada —{' '}
        <b>¿Crear otra regla para {combo}?</b>
      </span>
      <span className={styles.promptOtraBotones}>
        <button className="btn btn-sm" onClick={onOtra}>Sí, otra</button>
        <button className="btn btn-sm btn-primary" onClick={onListo}>No, listo</button>
      </span>
    </div>
  )
}

// ─── FilaFaltante: fila expandible de la tabla "Sin concepto" ────────────────

function FilaFaltante({ f, idx, quincena, todasFaltantes, mutCrear, mutCrearSinFaltantes, onFinEncadenado, supervisores }) {
  const [abierta, setAbierta] = useState(false)
  const [alcance, setAlcance] = useState('finca') // 'comun' | 'cliente' | 'finca' | 'supervisor'
  const [supervisorSel, setSupervisorSel] = useState('')
  // Arranca en 'finca', así que "Reemplaza al común" nace tildado.
  const [form, setForm] = useState({ ...EMPTY_REGLA, reemplaza_comun: true })
  // Una vez que el usuario toca el checkbox a mano, dejamos de pisarlo al
  // cambiar el alcance.
  const [reemplazaTocado, setReemplazaTocado] = useState(false)
  // Código de la última regla creada en esta ronda; non-null = mostrar el
  // prompt "¿Crear otra?" en lugar del formulario.
  const [reglaCreada, setReglaCreada] = useState(null)

  const cantidadConMismaTarea = useMemo(
    () => todasFaltantes.filter(x => x.tarea_nombre === f.tarea_nombre).length,
    [todasFaltantes, f.tarea_nombre]
  )

  const cambiarAlcance = (nuevo) => {
    setAlcance(nuevo)
    if (!reemplazaTocado) setForm(fo => ({ ...fo, reemplaza_comun: nuevo !== 'comun' }))
  }

  const handleGuardar = () => {
    if (!form.codigo) { toast.error('Ingresá un código'); return }
    if (alcance === 'supervisor' && !supervisorSel) { toast.error('Seleccioná un supervisor'); return }
    const codigo = parseInt(form.codigo)
    const datos = {
      quincena,
      tarea_nombre:   f.tarea_nombre,
      cliente_nombre: (alcance === 'cliente' || alcance === 'finca') ? f.cliente_nombre : null,
      finca_nombre:   alcance === 'finca' ? f.finca_nombre : null,
      supervisor_nombre: alcance === 'supervisor' ? supervisorSel : null,
      codigo,
      unidad_base: form.unidad_base,
      precio:      form.precio !== '' ? parseFloat(form.precio) : null,
      tipo:        form.tipo,
      categoria:   form.categoria !== '' ? parseInt(form.categoria) : null,
      reemplaza_comun: alcance === 'comun' ? false : form.reemplaza_comun,
    }
    const onSuccess = () => setReglaCreada(codigo)
    // Desde una faltante sabemos qué finca no tiene regla: si eligió "por
    // cliente" y solapa, el diálogo ofrece crear la específica de esa finca.
    // El onError vive en la mutation (ver mutCrearSinFaltantes en Conceptos()).
    mutCrearSinFaltantes({
      datos, onSuccess,
      fincaNueva: alcance === 'cliente' ? f.finca_nombre : null,
    })
  }

  const combo = `${f.tarea_nombre}${f.cliente_nombre ? ` · ${f.cliente_nombre}` : ''}${f.finca_nombre ? ` · ${f.finca_nombre}` : ''}`

  const otraRegla = () => {
    // Conserva alcance y supervisor; limpia código/unidad/precio/categoría.
    setForm(fo => ({ ...EMPTY_REGLA, reemplaza_comun: fo.reemplaza_comun }))
    setReglaCreada(null)
  }

  const terminarEncadenado = () => {
    setReglaCreada(null)
    setForm({ ...EMPTY_REGLA, reemplaza_comun: true })
    setAlcance('finca')
    setSupervisorSel('')
    setReemplazaTocado(false)
    setAbierta(false)
    onFinEncadenado()
  }

  return (
    <>
      <tr className={styles.faltanteRow} onClick={() => { if (reglaCreada != null) { terminarEncadenado(); return } setAbierta(o => !o) }}>
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

              {reglaCreada != null ? (
                <PromptOtraRegla codigo={reglaCreada} combo={combo} onOtra={otraRegla} onListo={terminarEncadenado} />
              ) : (
              <>
              <div className={styles.scopeChoice}>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={alcance === 'finca'}
                    onChange={() => cambiarAlcance('finca')} />
                  Por finca — {f.cliente_nombre}{f.finca_nombre ? ` / ${f.finca_nombre}` : ''}
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={alcance === 'cliente'}
                    onChange={() => cambiarAlcance('cliente')} />
                  Por cliente — {f.cliente_nombre} (todas las fincas)
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={alcance === 'supervisor'}
                    onChange={() => cambiarAlcance('supervisor')} />
                  Por supervisor
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name={`faltante-scope-${idx}`} checked={alcance === 'comun'}
                    onChange={() => cambiarAlcance('comun')} />
                  Común
                  {cantidadConMismaTarea > 1 && (
                    <span className={styles.textoMuted}> — Afecta a {cantidadConMismaTarea} casos con esta tarea</span>
                  )}
                </label>
              </div>

              {alcance === 'supervisor' && (
                <div>
                  <div className="field-label">Supervisor</div>
                  <select className="input" style={{ width: 220 }} value={supervisorSel}
                    onChange={e => setSupervisorSel(e.target.value)}>
                    <option value="">— Seleccionar —</option>
                    {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

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
                {alcance !== 'comun' && (
                  <label className={styles.checkboxLabel} title="La línea de esta finca paga solo lo específico, sin sumar los comunes de la tarea">
                    <input type="checkbox" checked={form.reemplaza_comun}
                      onChange={e => {
                        setReemplazaTocado(true)
                        setForm(fo => ({ ...fo, reemplaza_comun: e.target.checked }))
                      }} />
                    Reemplaza al común
                  </label>
                )}
                <button className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-end' }}
                  onClick={handleGuardar}>
                  Guardar
                </button>
              </div>
              </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── PanelPrecioRow: fila plana editable del Panel de precios ───────────────

function PanelPrecioRow({ fila, seleccionada, onToggleSeleccion, onGuardarPrecio, guardando }) {
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

  const unidadLabel = UNIDADES.find(u => u.value === fila.unidad_base)?.label || fila.unidad_base

  return (
    <tr className={seleccionada ? undefined : styles.filaExcluida}>
      <td>
        <input type="checkbox" checked={seleccionada}
          style={{ accentColor: 'var(--accent)', width: 17, height: 17, cursor: 'pointer' }}
          aria-label={`Incluir ${fila.tarea_nombre} en el precio masivo`}
          onChange={onToggleSeleccion} />
      </td>
      <td title={fila.tarea_nombre}>
        <div className={styles.celdaTruncada}>{fila.tarea_nombre}</div>
      </td>
      <td className="mono">{fila.codigo ?? '—'}</td>
      <td title={fila.supervisor_nombre ? `Supervisor: ${fila.supervisor_nombre}` : (fila.cliente_nombre || '— (común)')}>
        <div className={styles.celdaTruncada}>
          {fila.supervisor_nombre
            ? <span className="badge badge-info">Sup: {fila.supervisor_nombre}</span>
            : (fila.cliente_nombre || <span className={styles.textoMuted}>— (común)</span>)}
        </div>
      </td>
      <td title={fila.finca_nombre || ''}>
        <div className={styles.celdaTruncada}>{fila.finca_nombre || '—'}</div>
      </td>
      <td>{fila.categoria != null ? `Cat. ${fila.categoria}` : '—'}</td>
      <td title={unidadLabel}>
        <div className={styles.celdaTruncada}>{unidadLabel}</div>
      </td>
      <td>
        {fila.reemplaza_comun && (
          <span className="badge badge-info" title="Esta línea paga solo lo específico, sin sumar los comunes de la tarea">
            ✓
          </span>
        )}
      </td>
      <td className="mono">
        {fila.precio_anterior != null ? `$${Number(fila.precio_anterior).toLocaleString('es-AR')}` : '—'}
      </td>
      <td>
        {editando ? (
          <div className={styles.panelPrecioEdit}>
            <input className="input input-mono" type="number" style={{ width: 80 }}
              autoFocus
              value={precio}
              onChange={e => setPrecio(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }} />
            <button className="btn btn-primary btn-sm" onClick={confirmar} disabled={guardando}>✓</button>
            <button className="btn btn-sm" onClick={() => setEditando(false)}>✕</button>
          </div>
        ) : (
          <span
            className={styles.panelPrecioValor}
            onClick={() => setEditando(true)}
          >
            {fila.precio != null ? `$${Number(fila.precio).toLocaleString('es-AR')}` : <span className={styles.precioVacio}>sin precio</span>}
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Conceptos() {
  const qc = useQueryClient()
  // El gerente opera esta pantalla igual que admin/jefe (el backend ya le
  // permite las mutaciones). Lo único vedado es /api/preliquidacion/... (403),
  // así que su selector de quincenas no puede salir de listarPreliquidaciones:
  // usamos /gerencial/quincenas en su lugar (ver más abajo).
  const { usuario } = useAuthStore()
  const esGerente = usuario?.rol === 'gerente'
  const [tab, setTab] = useState(1)        // 0=faltantes 1=comunes 2=por cliente 3=por finca 4=por supervisor 5=panel de precios
  // Solapamiento por cliente pendiente de decisión: el POST respondió 409 y
  // guardamos lo necesario para reintentar (confirmando o como específica).
  const [pendienteSolap, setPendienteSolap] = useState(null)
  const [quincena, setQuincena] = useState('')
  const [mostrarCopiar, setMostrarCopiar] = useState(false)
  const [quincenaOrigen, setQuincenaOrigen] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtrosEspecificos, setFiltrosEspecificos] = useState({})
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [reglaCreadaNuevo, setReglaCreadaNuevo] = useState(null)
  const [filtroCodigoPanel, setFiltroCodigoPanel] = useState('')
  const [filtrosPanel, setFiltrosPanel] = useState({})
  // Vista del panel: 'regla' (tabla plana, con selección y precio masivo) o
  // 'concepto' (una fila por alcance, una columna por código — CONTEXT.md:
  // Concepto completo). Se recuerda la última elegida.
  const [vistaPanel, setVistaPanel] = useState(() => {
    try { return localStorage.getItem(LS_KEY_VISTA_PANEL) === 'concepto' ? 'concepto' : 'regla' } catch { return 'regla' }
  })
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_VISTA_PANEL, vistaPanel) } catch { /* sin localStorage: no persistimos */ }
  }, [vistaPanel])
  const [precioMasivo, setPrecioMasivo] = useState('')
  // Selección del panel: guardamos las EXCLUSIONES (filas destildadas), no
  // las inclusiones — así el default es "todas tildadas" y cambiar el filtro
  // resetea la selección sin sincronizar nada.
  const [exclusionesPanel, setExclusionesPanel] = useState(() => new Set())
  // Anchos de columna del Panel de precios, redimensionables a mano (estilo
  // Excel). Se leen de localStorage con merge sobre los defaults, así que
  // agregar/quitar columnas más adelante no rompe una preferencia vieja.
  const [anchosPanel, setAnchosPanel] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem(LS_KEY_ANCHOS_PANEL) || '{}')
      return { ...ANCHOS_PANEL_DEFAULT, ...guardado }
    } catch {
      return { ...ANCHOS_PANEL_DEFAULT }
    }
  })
  // Ref con el cleanup del resize en curso (listeners de document), para
  // poder desengancharlos si el componente se desmonta a mitad de un drag.
  const resizeCleanupPanelRef = useRef(null)
  useEffect(() => () => resizeCleanupPanelRef.current?.(), [])
  // Alcance del formulario "+ Nuevo": arranca acorde a la tab activa (comunes
  // → común, específicos → finca) pero el usuario puede cambiarlo a
  // cualquiera de los 4; reemplaza_comun nace en true y handleCrearNuevo lo
  // fuerza a false cuando el alcance es 'comun'.
  const [alcanceNuevo, setAlcanceNuevo] = useState('comun')
  const [formNuevo, setFormNuevo] = useState({
    tarea_nombre: '', cliente_nombre: '', finca_nombre: '', supervisor_nombre: '',
    codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '',
    reemplaza_comun: true,
  })

  const scope = SCOPE_POR_TAB[tab] // undefined en tab 0 (faltantes) y 5 (panel)

  // Sincroniza el alcance por defecto del form "+ Nuevo" con la solapa activa
  // cada vez que se cambia de tab (el form se resetea/oculta al cambiar tab,
  // así que no hay riesgo de pisar una elección en curso del usuario).
  useEffect(() => {
    setAlcanceNuevo(SCOPE_POR_TAB[tab] ?? 'comun')
  }, [tab])

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: ['preliquidaciones-generadas'],
    queryFn: listarPreliquidaciones,
    // El endpoint de preliquidaciones le da 403 al gerente: para ese rol el
    // selector sale de /gerencial/quincenas (ver query de abajo).
    enabled: !esGerente,
  })

  const { data: quincenasGerencial = [] } = useQuery({
    queryKey: ['gerencial-quincenas'],
    queryFn: listarQuincenasGerencial,
    enabled: esGerente,
  })

  const { data: quincenasExistentes = [] } = useQuery({
    queryKey: ['quincenas-conceptos'],
    queryFn: listarQuincenasConConceptos,
  })

  // Quincenas realmente generadas (deduplicadas, más reciente primero).
  const quincenasGeneradas = useMemo(() => {
    if (esGerente) {
      return [...quincenasGerencial]
        .sort((a, b) => b.localeCompare(a))
        .map(q => ({ value: q, label: formatQuincenaLabel(q) }))
    }
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
  }, [preliquidaciones, quincenasGerencial, esGerente])

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

  const { data: solapamientos = [] } = useQuery({
    queryKey: ['solapamientos', quincena],
    queryFn: () => listarSolapamientos(quincena),
    enabled: !!quincena,
  })

  // Cada solapa de reglas (1-4) pide únicamente su scope; el queryKey lleva
  // el scope, así que moverse entre solapas no pisa la caché de las otras.
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['conceptos', quincena, scope],
    queryFn: () => listarConceptos(quincena, scope),
    enabled: !!quincena && scope != null,
  })

  const { data: panelPrecios = [], isLoading: cargandoPanel } = useQuery({
    queryKey: ['panel-precios', quincena],
    queryFn: () => obtenerPanelPrecios(quincena),
    enabled: !!quincena && tab === 5,
  })

  const { data: tareas = [] } = useQuery({ queryKey: ['tareas'], queryFn: listarTareas, staleTime: Infinity })
  const { data: clientes = [] } = useQuery({ queryKey: ['clientes'], queryFn: listarClientes, staleTime: Infinity, enabled: tab >= 1 && tab <= 4 })
  // Supervisores de la quincena, para el alcance "Por supervisor" (dropdown
  // de matching exacto). Se usa tanto en Sin concepto (tab 0) como en el
  // form "+ Nuevo" de las 4 solapas de reglas (tab 1-4).
  const { data: supervisores = [] } = useQuery({
    queryKey: ['supervisores-conceptos', quincena],
    queryFn: () => listarSupervisores(quincena),
    enabled: !!quincena && tab <= 4,
  })
  const { data: fincas = [] } = useQuery({
    queryKey: ['fincas', formNuevo.cliente_nombre],
    queryFn: () => listarFincas(formNuevo.cliente_nombre),
    enabled: (tab >= 1 && tab <= 4) && !!formNuevo.cliente_nombre,
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['conceptos'] })
    qc.invalidateQueries({ queryKey: ['conceptos-faltantes'] })
    qc.invalidateQueries({ queryKey: ['quincenas-conceptos'] })
    qc.invalidateQueries({ queryKey: ['panel-precios'] })
    qc.invalidateQueries({ queryKey: ['solapamientos'] })
    // Impacto reactivo (WS2): un cambio de concepto recalcula líneas en el
    // backend, así que refrescamos también Revisión y sus estadísticas.
    qc.invalidateQueries({ queryKey: ['lineas'] })
    qc.invalidateQueries({ queryKey: ['stats'] })
  }

  // onError compartido por las 3 superficies de alta. Un 409 de solapamiento
  // abre el diálogo; cualquier otro error va al toast como siempre.
  // ctx = { datos, fincaNueva, mutate, onSuccess }
  const manejarErrorCrear = (err, ctx) => {
    if (err.status === 409 && err.detail?.tipo === 'solapamiento_por_cliente') {
      // ctx puede venir de un reintento (sumarIgual/crearSoloFinca) y arrastrar
      // el `solapamiento` del 409 anterior: va primero para que el nuevo
      // `err.detail.solapamiento` sea el que prevalece.
      setPendienteSolap({ ...ctx, solapamiento: err.detail.solapamiento })
      return
    }
    toast.error(err.message)
  }

  const cerrarSolap = () => setPendienteSolap(null)

  // "Ver por cliente" / "Ver específicas": van a la solapa correspondiente
  // (2 = Por cliente, 3 = Por finca) con la tarea en el buscador.
  const verReglasSolap = (s, tabDestino) => {
    setTab(tabDestino)
    setBusqueda(s.tarea_nombre)
    setFiltrosEspecificos({})
    setMostrarNuevo(false)
    setReglaCreadaNuevo(null)
  }

  const sumarIgual = () => {
    const p = pendienteSolap
    setPendienteSolap(null)
    const datos = { ...p.datos, confirmar_solapamiento: true }
    p.mutate({ ...p, datos })
  }

  const crearSoloFinca = () => {
    const p = pendienteSolap
    setPendienteSolap(null)
    // Convierte la regla por cliente en específica para la finca que faltaba.
    // Puede volver a dar 409 en la dirección inversa si ya existía otra regla
    // por cliente compatible: en ese caso el diálogo se reabre con ese detalle.
    const datos = { ...p.datos, finca_nombre: p.fincaNueva }
    p.mutate({ ...p, datos, fincaNueva: null })
  }

  // Las variables llevan el contexto completo: así el onError vive en la
  // mutation (siempre corre, aunque la fila/tarjeta que disparó el alta se
  // haya desmontado) y puede abrir el diálogo de solapamiento o el toast.
  // ctx = { datos, onSuccess, fincaNueva }
  const { mutate: mutCrear } = useMutation({
    mutationFn: ({ datos }) => crearConcepto(datos),
    onSuccess: (_data, ctx) => { toast.success('Regla guardada'); invalidar(); ctx.onSuccess?.() },
    onError: (err, ctx) => manejarErrorCrear(err, { ...ctx, mutate: mutCrear }),
  })

  // Variante para el encadenado desde "Sin concepto": NO invalida la lista
  // de faltantes — el combo recién completado debe seguir visible mientras
  // el liquidador decide si le crea otra regla. Faltantes se invalida al
  // cerrar el prompt (onFinEncadenado). Mismo patrón de onError a nivel
  // mutation que mutCrear (ver comentario arriba).
  const { mutate: mutCrearSinFaltantes } = useMutation({
    mutationFn: ({ datos }) => crearConcepto(datos),
    onSuccess: (_data, ctx) => {
      toast.success('Regla guardada')
      qc.invalidateQueries({ queryKey: ['conceptos'] })
      qc.invalidateQueries({ queryKey: ['quincenas-conceptos'] })
      qc.invalidateQueries({ queryKey: ['panel-precios'] })
      qc.invalidateQueries({ queryKey: ['solapamientos'] })
      qc.invalidateQueries({ queryKey: ['lineas'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      ctx.onSuccess?.()
    },
    onError: (err, ctx) => manejarErrorCrear(err, { ...ctx, mutate: mutCrearSinFaltantes }),
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
      if (data.solapamientos_heredados > 0) {
        const n = data.solapamientos_heredados
        toast(`Atención: ${n} solapamiento${n === 1 ? '' : 's'} por cliente heredado${n === 1 ? '' : 's'}. Revisá la franja de aviso.`,
          { icon: '⚠', duration: 8000 })
      }
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
        : `${item.tarea_nombre}||${item.cliente_nombre || ''}||${item.finca_nombre || ''}||${item.supervisor_nombre || ''}`
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
    // Filtros multi-select (solo solapas no-comunes). Todas las reglas de un
    // grupo comparten tarea/cliente/finca/supervisor, así que alcanza con
    // mirar la primera.
    if (tab >= 2 && tab <= 4) {
      for (const c of CAMPOS_PANEL) {
        const valores = filtrosEspecificos[c.key]
        if (valores?.length) {
          entradas = entradas.filter(([, reglas]) => valores.includes(reglas[0]?.[c.field]))
        }
      }
    }
    return Object.fromEntries(entradas)
  }, [grupos, busqueda, tab, filtrosEspecificos])

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
      const valores = filtrosPanel[c.key]
      if (valores?.length) {
        filas = filas.filter(f => valores.includes(f[c.field]))
      }
    }
    return filas
  }, [panelPrecios, filtroCodigoPanel, filtrosPanel])

  useEffect(() => { setExclusionesPanel(new Set()) }, [filtroCodigoPanel, filtrosPanel, quincena])

  const panelSeleccionado = useMemo(
    () => panelFiltrado.filter(f => !exclusionesPanel.has(f.id)),
    [panelFiltrado, exclusionesPanel]
  )

  const toggleSeleccionPanel = (id) => setExclusionesPanel(prev => {
    const s = new Set(prev)
    s.has(id) ? s.delete(id) : s.add(id)
    return s
  })

  const toggleTodasPanel = () => setExclusionesPanel(
    panelSeleccionado.length === panelFiltrado.length
      ? new Set(panelFiltrado.map(f => f.id))   // estaban todas: destildar todas
      : new Set()                                // había excluidas: tildar todas
  )

  // Persistencia del ancho de columnas del panel — se guarda en cada cambio,
  // así la preferencia sobrevive a un F5 o a cerrar la pestaña.
  useEffect(() => {
    try { localStorage.setItem(LS_KEY_ANCHOS_PANEL, JSON.stringify(anchosPanel)) } catch { /* localStorage no disponible: seguimos sin persistir */ }
  }, [anchosPanel])

  // Arranca el resize de una columna: guarda el ancho y la posición X de
  // inicio, y escucha mousemove/mouseup en document (el mouse puede salirse
  // del th mientras se arrastra). Ambos listeners se remueven a sí mismos en
  // mouseup; resizeCleanupPanelRef guarda esa misma función por si el
  // componente se desmonta a mitad del drag (ver el useEffect de arriba).
  const iniciarResizePanel = (clave) => (e) => {
    e.preventDefault()
    const startX = e.clientX
    const anchoInicial = anchosPanel[clave]
    const onMove = (ev) => {
      const nuevo = Math.max(50, anchoInicial + (ev.clientX - startX))
      setAnchosPanel(prev => ({ ...prev, [clave]: nuevo }))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      resizeCleanupPanelRef.current = null
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    resizeCleanupPanelRef.current = onUp
  }

  const restaurarAnchoPanel = (clave) => setAnchosPanel(prev => ({ ...prev, [clave]: ANCHOS_PANEL_DEFAULT[clave] }))

  const handleAplicarPrecioMasivo = () => {
    const valor = precioMasivo !== '' ? parseFloat(precioMasivo) : null
    if (valor == null || Number.isNaN(valor)) { toast.error('Ingresá un precio válido'); return }
    if (panelSeleccionado.length === 0) { toast.error('No hay filas seleccionadas'); return }
    const excluidas = panelFiltrado.length - panelSeleccionado.length
    const detalle = excluidas > 0 ? ` (${excluidas} destildada${excluidas > 1 ? 's' : ''} conserva${excluidas > 1 ? 'n' : ''} su precio)` : ''
    if (!window.confirm(`¿Aplicar $${valor.toLocaleString('es-AR')} a ${panelSeleccionado.length} fila(s)?${detalle}`)) return
    mutPrecioMasivo({ ids: panelSeleccionado.map(f => f.id), precio: valor })
  }

  const handleCrearNuevo = () => {
    if (!formNuevo.tarea_nombre) { toast.error('Completá la tarea'); return }
    if ((alcanceNuevo === 'cliente' || alcanceNuevo === 'finca') && !formNuevo.cliente_nombre) { toast.error('Completá el cliente'); return }
    if (alcanceNuevo === 'supervisor' && !formNuevo.supervisor_nombre) { toast.error('Seleccioná un supervisor'); return }
    if (!formNuevo.codigo) { toast.error('Ingresá un código'); return }
    const codigo = parseInt(formNuevo.codigo)
    const datos = {
      quincena,
      tarea_nombre:   formNuevo.tarea_nombre,
      cliente_nombre: (alcanceNuevo === 'cliente' || alcanceNuevo === 'finca') ? formNuevo.cliente_nombre : null,
      finca_nombre:   alcanceNuevo === 'finca' ? (formNuevo.finca_nombre || null) : null,
      supervisor_nombre: alcanceNuevo === 'supervisor' ? formNuevo.supervisor_nombre : null,
      codigo,
      unidad_base: formNuevo.unidad_base,
      precio:      formNuevo.precio !== '' ? parseFloat(formNuevo.precio) : null,
      tipo:        formNuevo.tipo,
      categoria:   formNuevo.categoria !== '' ? parseInt(formNuevo.categoria) : null,
      reemplaza_comun: alcanceNuevo === 'comun' ? false : formNuevo.reemplaza_comun,
    }
    const onSuccess = () => {
      // Conserva tarea/cliente/finca/supervisor y el alcance; limpia lo demás.
      setFormNuevo(f => ({ ...f, codigo: '', precio: '', categoria: '' }))
      setReglaCreadaNuevo(codigo)
    }
    mutCrear({ datos, onSuccess, fincaNueva: null })
  }

  const TABS = [
    { label: `Sin concepto${faltantes.length > 0 ? ` (${faltantes.length})` : ''}`, alert: faltantes.length > 0 },
    { label: 'Comunes' },
    { label: 'Por cliente' },
    { label: 'Por finca' },
    { label: 'Por supervisor' },
    { label: 'Panel de precios' },
  ]

  const cantGrupos = Object.keys(gruposFiltrados).length

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <span className={styles.title}>Maestro de Conceptos y Precios</span>
        <select className="input" value={quincena}
          onChange={e => { setQuincena(e.target.value); setMostrarCopiar(false); setFiltrosEspecificos({}) }}
          style={{ width: 200 }}
          disabled={quincenasGeneradas.length === 0}>
          {quincenasGeneradas.length === 0
            ? <option value="">— Sin quincenas generadas —</option>
            : quincenasGeneradas.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {tab >= 1 && tab <= 4 && (
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

      <FranjaSolapamientos items={solapamientos}
        onVerReglas={s => verReglasSolap(s, 2)}
        onVerEspecificas={s => verReglasSolap(s, 3)} />

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((t, i) => (
          <button key={i}
            className={`chip ${tab === i ? (t.alert ? 'chip-alert' : 'chip-active') : ''}`}
            onClick={() => { setTab(i); setBusqueda(''); setFiltrosEspecificos({}); setMostrarNuevo(false); setReglaCreadaNuevo(null) }}>
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
                      mutCrearSinFaltantes={mutCrearSinFaltantes}
                      onFinEncadenado={() => qc.invalidateQueries({ queryKey: ['conceptos-faltantes'] })}
                      supervisores={supervisores}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tabs 1-4: Comunes / Por cliente / Por finca / Por supervisor */}
      {tab >= 1 && tab <= 4 && (
        <div className={styles.tabContent}>
          {/* Barra búsqueda + nuevo */}
          <div className={styles.searchBar}>
            <input className="input" style={{ width: 320 }}
              placeholder={tab === 1 ? 'Buscar tarea...' : 'Buscar tarea, cliente, finca, supervisor...'}
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <button className="btn btn-sm btn-primary" onClick={() => { setMostrarNuevo(o => !o); setReglaCreadaNuevo(null) }}>
              {mostrarNuevo ? '✕ Cancelar' : '+ Nuevo'}
            </button>
            <span className={styles.searchCount}>
              {cantGrupos} {NOMBRE_SCOPE[tab]}
            </span>
          </div>

          {/* Filtros multi-select por cliente/finca/supervisor/tarea — solo
              solapas no-comunes (los comunes solo tienen tarea y el buscador
              les alcanza). La búsqueda de texto vive en la barra de arriba:
              mostrarBusqueda=false. */}
          {tab >= 2 && tab <= 4 && (
            <FiltrosBar
              datos={items}
              campos={CAMPOS_PANEL}
              filtros={filtrosEspecificos}
              onChange={setFiltrosEspecificos}
              mostrarAlertas={false}
              mostrarBusqueda={false}
            />
          )}

          {/* Formulario nuevo grupo */}
          {mostrarNuevo && reglaCreadaNuevo != null && (
            <PromptOtraRegla
              codigo={reglaCreadaNuevo}
              combo={`${formNuevo.tarea_nombre}${formNuevo.cliente_nombre ? ` · ${formNuevo.cliente_nombre}` : ''}${formNuevo.finca_nombre ? ` · ${formNuevo.finca_nombre}` : ''}${formNuevo.supervisor_nombre ? ` · Sup. ${formNuevo.supervisor_nombre}` : ''}`}
              onOtra={() => setReglaCreadaNuevo(null)}
              onListo={() => {
                setReglaCreadaNuevo(null)
                setFormNuevo({ tarea_nombre: '', cliente_nombre: '', finca_nombre: '', supervisor_nombre: '', codigo: '', unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '', reemplaza_comun: true })
                setAlcanceNuevo(SCOPE_POR_TAB[tab] ?? 'comun')
                setMostrarNuevo(false)
              }}
            />
          )}
          {mostrarNuevo && reglaCreadaNuevo == null && (
            <div className={styles.newGroupForm}>
              <div><div className="field-label">Tarea</div>
                <select className="input" style={{ width: 220 }} value={formNuevo.tarea_nombre}
                  onChange={e => setFormNuevo(f => ({ ...f, tarea_nombre: e.target.value }))}>
                  <option value="">— Seleccionar —</option>
                  {tareas.map(t => <option key={t.nombre} value={t.nombre}>{t.nombre}</option>)}
                </select>
              </div>
              <div>
                <div className="field-label">Alcance</div>
                <div className={styles.scopeChoice} style={{ gap: 12 }}>
                  {ALCANCES.map(a => (
                    <label key={a.value} className={styles.radioLabel}>
                      <input type="radio" name="alcance-nuevo" checked={alcanceNuevo === a.value}
                        onChange={() => setAlcanceNuevo(a.value)} />
                      {a.label}
                    </label>
                  ))}
                </div>
              </div>
              {(alcanceNuevo === 'cliente' || alcanceNuevo === 'finca') && (
                <>
                  <div><div className="field-label">Cliente</div>
                    <select className="input" style={{ width: 180 }} value={formNuevo.cliente_nombre}
                      onChange={e => setFormNuevo(f => ({ ...f, cliente_nombre: e.target.value, finca_nombre: '' }))}>
                      <option value="">— Seleccionar —</option>
                      {clientes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {alcanceNuevo === 'finca' && (
                    <div><div className="field-label">Finca</div>
                      <select className="input" style={{ width: 160 }} value={formNuevo.finca_nombre}
                        onChange={e => setFormNuevo(f => ({ ...f, finca_nombre: e.target.value }))}
                        disabled={!formNuevo.cliente_nombre}>
                        <option value="">— Seleccionar —</option>
                        {fincas.map(fn => <option key={fn} value={fn}>{fn}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
              {alcanceNuevo === 'supervisor' && (
                <div><div className="field-label">Supervisor</div>
                  <select className="input" style={{ width: 200 }} value={formNuevo.supervisor_nombre}
                    onChange={e => setFormNuevo(f => ({ ...f, supervisor_nombre: e.target.value }))}>
                    <option value="">— Seleccionar —</option>
                    {supervisores.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
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
              {alcanceNuevo !== 'comun' && (
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
                No hay conceptos {NOMBRE_SCOPE[tab]} para esta quincena.
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

      {/* Tab 5: Panel de precios */}
      {tab === 5 && (
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

          {/* Conmutador de vista + (solo en Por regla) barra de precio masivo. */}
          <div className={styles.searchBar}>
            <div className={styles.segmented} role="group" aria-label="Vista del panel">
              <button type="button" aria-pressed={vistaPanel === 'regla'}
                className={vistaPanel === 'regla' ? styles.segmentedOn : undefined}
                onClick={() => setVistaPanel('regla')}>Por regla</button>
              <button type="button" aria-pressed={vistaPanel === 'concepto'}
                className={vistaPanel === 'concepto' ? styles.segmentedOn : undefined}
                onClick={() => setVistaPanel('concepto')}>Por concepto</button>
            </div>
            {vistaPanel === 'regla' && (
              <>
                <input className="input input-mono" type="number" style={{ width: 120 }}
                  placeholder="$ precio"
                  value={precioMasivo} onChange={e => setPrecioMasivo(e.target.value)} />
                <button className="btn btn-sm btn-primary"
                  onClick={handleAplicarPrecioMasivo}
                  disabled={aplicandoMasivo || panelSeleccionado.length === 0}>
                  {aplicandoMasivo
                    ? <><span className="spinner" /> Aplicando...</>
                    : `Aplicar a la selección (${panelSeleccionado.length} de ${panelFiltrado.length})`}
                </button>
                <span className={styles.searchCount}>
                  {panelFiltrado.length - panelSeleccionado.length > 0
                    ? `${panelFiltrado.length - panelSeleccionado.length} destildada(s) conservan su precio`
                    : `${panelFiltrado.length} de ${panelPrecios.length} conceptos`}
                </span>
              </>
            )}
          </div>

          {vistaPanel === 'concepto' && (
            <div className={styles.list}>
              {cargandoPanel && <CargandoContenido texto="Cargando panel de precios…" />}
              {!cargandoPanel && (
                <PanelPorConcepto
                  reglas={panelPrecios}
                  quincena={quincena}
                  filtroCodigo={filtroCodigoPanel}
                  filtros={filtrosPanel}
                  onGuardarPrecio={(id, precio) => mutGuardarPrecioPanel({ id, precio })}
                  guardando={guardandoPrecioPanel}
                  onCrearRegla={(datos, onSuccess) => mutCrear({ datos, onSuccess, fincaNueva: null })}
                />
              )}
            </div>
          )}

          {vistaPanel === 'regla' && (
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
                  <table className={styles.panelTable}>
                    <colgroup>
                      {COLUMNAS_PANEL.map(c => <col key={c.key} style={{ width: anchosPanel[c.key] }} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        {COLUMNAS_PANEL.map(c => (
                          <th key={c.key} className={styles.thPanel}>
                            {c.key === 'chk' ? (
                              <input type="checkbox"
                                style={{ accentColor: 'var(--accent)', width: 17, height: 17, cursor: 'pointer' }}
                                aria-label="Seleccionar todas las filas filtradas"
                                checked={panelFiltrado.length > 0 && panelSeleccionado.length === panelFiltrado.length}
                                onChange={toggleTodasPanel} />
                            ) : c.label}
                            {c.key !== 'chk' && (
                              <div className={styles.thResizer}
                                onMouseDown={iniciarResizePanel(c.key)}
                                onDoubleClick={() => restaurarAnchoPanel(c.key)}
                                title="Arrastrar para redimensionar — doble click para restaurar" />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {panelFiltrado.map(fila => (
                        <PanelPrecioRow
                          key={fila.id}
                          fila={fila}
                          seleccionada={!exclusionesPanel.has(fila.id)}
                          onToggleSeleccion={() => toggleSeleccionPanel(fila.id)}
                          onGuardarPrecio={(id, precio) => mutGuardarPrecioPanel({ id, precio })}
                          guardando={guardandoPrecioPanel}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pendienteSolap && (
        <DialogoSolapamiento
          solapamiento={pendienteSolap.solapamiento}
          candidato={{
            codigo: pendienteSolap.datos.codigo,
            precio: pendienteSolap.datos.precio,
            categoria: pendienteSolap.datos.categoria,
            finca_nombre: pendienteSolap.datos.finca_nombre,
          }}
          fincaNueva={pendienteSolap.fincaNueva}
          onCrearSoloFinca={pendienteSolap.fincaNueva ? crearSoloFinca : null}
          onSumarIgual={sumarIgual}
          onCancelar={cerrarSolap}
        />
      )}
    </div>
  )
}
