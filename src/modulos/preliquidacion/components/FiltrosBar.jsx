import { useState, useMemo, useRef, useEffect } from 'react'

const ALERTAS = [
  { value: 'incompleta', label: 'Incompleta' },
  { value: 'alerta_legajo', label: 'Legajo inválido' },
  { value: 'alerta_empresa', label: 'Empresa a verificar' },
  { value: 'es_duplicado', label: 'Duplicado' },
]

// Set de filtros por defecto — el usado históricamente por Revisión/Verificación,
// operando sobre `lineas`. Si el consumidor no pasa `campos`, se usa este set
// para que el comportamiento quede idéntico al de antes de generalizar el
// componente.
const CAMPOS_DEFAULT = [
  { key: 'cliente',     label: 'Cliente',        field: 'nombre_cliente' },
  { key: 'finca',       label: 'Finca',          field: 'nombre_finca' },
  { key: 'tarea',       label: 'Tarea',          field: 'nombre_tarea' },
  { key: 'empresa',     label: 'Empresa',        field: 'empresa_asignada' },
  { key: 'grupo_pago',  label: 'Grupo de pago',  field: 'grupo_pago_aplicado' },
  { key: 'supervisor',  label: 'Supervisor',     field: 'nombre_supervisor' },
]

/**
 * Calcula, en un solo recorrido de `datos`, las opciones disponibles para
 * cada campo de filtro considerando los DEMÁS filtros activos (cascada).
 * Cada `filtros[key]` es ahora un array de valores seleccionados (multi):
 * una fila pasa el filtro de un campo si ese array está vacío/ausente, o si
 * incluye el valor de la fila para ese campo (unión dentro del campo,
 * intersección entre campos — lo natural de una cascada multi-select).
 * Reemplaza N pasadas O(n) independientes (una por campo) por una sola
 * pasada O(n). `campos` es la lista de descriptores { key, field } a calcular.
 */
function calcularOpcionesCascada(datos, filtros, campos) {
  const activos = campos.filter(c => filtros[c.key]?.length)
  const sets = {}
  for (const c of campos) sets[c.key] = new Set()

  for (const item of datos) {
    for (const campo of campos) {
      let ok = true
      for (const act of activos) {
        if (act.key === campo.key) continue
        if (!filtros[act.key].includes(item[act.field])) { ok = false; break }
      }
      if (!ok) continue
      const val = item[campo.field]
      if (val) sets[campo.key].add(val)
    }
  }

  const resultado = {}
  for (const c of campos) resultado[c.key] = [...sets[c.key]].sort()
  return resultado
}

export default function FiltrosBar({
  lineas = [],
  datos,
  campos,
  filtros,
  onChange,
  busqueda,
  onBusqueda,
  placeholderBusqueda = 'Buscar empleado, legajo, tarea...',
  mostrarAlertas = true,
  mostrarBusqueda = true,
}) {
  const [abierto, setAbierto] = useState(false)

  // El input de búsqueda vive acá (no en la página) para que cada tecla
  // re-renderice solo esta barra y no la tabla entera. `onBusqueda` recibe
  // el valor ya debounceado.
  const [textoBusqueda, setTextoBusqueda] = useState(busqueda || '')
  useEffect(() => {
    const t = setTimeout(() => {
      if (textoBusqueda !== busqueda) onBusqueda?.(textoBusqueda)
    }, 200)
    return () => clearTimeout(t)
  }, [textoBusqueda])

  // Retrocompatibilidad: si no se pasa `datos`/`campos`, se usa `lineas` y el
  // set de campos histórico (Revisión/Verificación no cambian de comportamiento).
  const datosEfectivos = datos ?? lineas
  const camposEfectivos = campos ?? CAMPOS_DEFAULT

  // Togglea un valor dentro del array de un campo: si ya está lo saca, si no
  // lo agrega. Array vacío se guarda como undefined para que `cantFiltros` y
  // la cascada lo traten uniformemente como "sin filtro".
  const toggle = (k, valor) => onChange(f => {
    const actual = f[k] || []
    const next = actual.includes(valor) ? actual.filter(v => v !== valor) : [...actual, valor]
    return { ...f, [k]: next.length ? next : undefined }
  })

  const quitar = (k, valor) => onChange(f => {
    const next = (f[k] || []).filter(v => v !== valor)
    return { ...f, [k]: next.length ? next : undefined }
  })

  // Setea de una todo el array de un campo (para "Seleccionar todos" / limpiar).
  const setValores = (k, arr) => onChange(f => ({ ...f, [k]: arr && arr.length ? arr : undefined }))

  const setAlerta = (v) => onChange(f => ({ ...f, alerta: f.alerta === v ? undefined : v }))

  const cantFiltros = camposEfectivos.filter(c => filtros[c.key]?.length).length + (filtros.alerta ? 1 : 0)

  const limpiar = () => {
    onChange({})
    setTextoBusqueda('')
    onBusqueda?.('')
  }

  // Opciones en cascada — se recalculan según los demás filtros activos.
  // Solo se computan mientras el panel está abierto: colapsado, no tiene
  // sentido pagar el recorrido de `datos` en cada cambio de filtro.
  const opciones = useMemo(() => {
    if (!abierto) {
      const vacio = {}
      for (const c of camposEfectivos) vacio[c.key] = []
      return vacio
    }
    return calcularOpcionesCascada(datosEfectivos, filtros, camposEfectivos)
  }, [datosEfectivos, filtros, abierto, camposEfectivos])

  return (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

      {/* Barra principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
        {/* La búsqueda se oculta cuando la pantalla ya tiene su propia barra
            (ej. Verificación), para no duplicarla. Ver mostrarBusqueda. */}
        {mostrarBusqueda && (
          <input
            className="input"
            style={{ width: 240 }}
            placeholder={placeholderBusqueda}
            value={textoBusqueda}
            onChange={e => setTextoBusqueda(e.target.value)}
          />
        )}

        <button
          className={`btn btn-sm ${abierto ? 'btn-primary' : ''}`}
          onClick={() => setAbierto(!abierto)}
        >
          ⚙ Filtros {cantFiltros > 0 && <span style={{ background: 'var(--accent)', color: 'var(--bg-base)', borderRadius: 3, padding: '0 5px', fontSize: 10, marginLeft: 2 }}>{cantFiltros}</span>}
        </button>

        {/* Chips de alertas — solo se muestran cuando mostrarAlertas=true (Revisión) */}
        {mostrarAlertas && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 4 }}>
            {ALERTAS.map(a => (
              <button
                key={a.value}
                onClick={() => setAlerta(a.value)}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  borderRadius: 3,
                  border: '1px solid',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  background: filtros.alerta === a.value
                    ? (a.value === 'es_duplicado' ? 'var(--danger-dim)' : 'var(--warn-dim)')
                    : 'var(--bg-elevated)',
                  borderColor: filtros.alerta === a.value
                    ? (a.value === 'es_duplicado' ? 'var(--danger)' : 'var(--warn)')
                    : 'var(--border-strong)',
                  color: filtros.alerta === a.value
                    ? (a.value === 'es_duplicado' ? 'var(--danger)' : 'var(--warn)')
                    : 'var(--text-muted)',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {cantFiltros > 0 || textoBusqueda || busqueda ? (
          <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={limpiar}>
            ✕ Limpiar
          </button>
        ) : null}
      </div>

      {/* Panel de filtros expandible */}
      {abierto && (
        <div style={{
          padding: '12px 12px 14px',
          borderTop: '1px solid var(--border)',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}>
          {camposEfectivos.map(c => (
            <FiltroMultiSelect
              key={c.key}
              label={c.label}
              opciones={opciones[c.key]}
              valores={filtros[c.key] || []}
              onToggle={v => toggle(c.key, v)}
              onQuitar={v => quitar(c.key, v)}
              onSetTodos={arr => setValores(c.key, arr)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Dropdown multi-select: un botón que muestra los valores elegidos como chips
// removibles (o "Todas" si no hay ninguno), y una lista con checkboxes que se
// abre debajo. Se cierra al hacer click afuera (ref + listener en document).
function FiltroMultiSelect({ label, opciones = [], valores = [], onToggle, onQuitar, onSetTodos }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!abierto) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  // Si algún valor actualmente seleccionado ya no está entre las opciones
  // disponibles (por la cascada), se mantiene visible igual para no perder
  // la selección abruptamente.
  const todasOpciones = useMemo(() => {
    const faltantes = valores.filter(v => !opciones.includes(v))
    return faltantes.length ? [...faltantes, ...opciones].sort() : opciones
  }, [opciones, valores])

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>

      <button
        type="button"
        className="input"
        onClick={() => setAbierto(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 4,
          minHeight: 30,
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {valores.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>— Todas —</span>
        ) : valores.length <= 2 ? (
          valores.map(v => (
            <span
              key={v}
              className="badge badge-info"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', overflow: 'hidden' }}
              onClick={e => { e.stopPropagation(); onQuitar(v) }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              <span style={{ cursor: 'pointer', fontWeight: 700 }}>✕</span>
            </span>
          ))
        ) : (
          <span className="badge badge-info">{valores.length} seleccionadas</span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10 }}>▾</span>
      </button>

      {abierto && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: 2,
            maxHeight: 220,
            overflowY: 'auto',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: 4,
          }}
        >
          {todasOpciones.length === 0 && (
            <div style={{ padding: '6px 8px', fontSize: 12, color: 'var(--text-muted)' }}>Sin opciones.</div>
          )}
          {todasOpciones.length > 0 && (
            <label
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                fontSize: 12, fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                borderBottom: '1px solid var(--border)', marginBottom: 2,
              }}
              onMouseDown={e => e.preventDefault()}
            >
              <input
                type="checkbox"
                checked={todasOpciones.every(o => valores.includes(o))}
                onChange={e => onSetTodos(e.target.checked ? todasOpciones : [])}
                style={{ width: 'var(--control-size)', height: 'var(--control-size)' }}
              />
              <span>Seleccionar todos</span>
            </label>
          )}
          {todasOpciones.map(o => (
            <label
              key={o}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                fontSize: 12,
                borderRadius: 4,
                cursor: 'pointer',
              }}
              onMouseDown={e => e.preventDefault()}
            >
              <input
                type="checkbox"
                checked={valores.includes(o)}
                onChange={() => onToggle(o)}
                style={{ width: 'var(--control-size)', height: 'var(--control-size)' }}
              />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
