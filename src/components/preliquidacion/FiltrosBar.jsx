import { useState, useMemo } from 'react'

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
 * Si el cliente=CITRUSVIL está seleccionado, las fincas/tareas/supervisores
 * que se muestran son solo los que tienen registros con ese cliente.
 * Reemplaza N pasadas O(n) independientes (una por campo) por una sola
 * pasada O(n). `campos` es la lista de descriptores { key, field } a calcular.
 */
function calcularOpcionesCascada(datos, filtros, campos) {
  const activos = campos.filter(c => filtros[c.key])
  const sets = {}
  for (const c of campos) sets[c.key] = new Set()

  for (const item of datos) {
    for (const campo of campos) {
      let ok = true
      for (const act of activos) {
        if (act.key === campo.key) continue
        if (item[act.field] !== filtros[act.key]) { ok = false; break }
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

  // Retrocompatibilidad: si no se pasa `datos`/`campos`, se usa `lineas` y el
  // set de campos histórico (Revisión/Verificación no cambian de comportamiento).
  const datosEfectivos = datos ?? lineas
  const camposEfectivos = campos ?? CAMPOS_DEFAULT

  const set = (k, v) => onChange(f => ({ ...f, [k]: v || undefined }))
  const setAlerta = (v) => onChange(f => ({ ...f, alerta: f.alerta === v ? undefined : v }))

  const cantFiltros = Object.values(filtros).filter(Boolean).length

  const limpiar = () => {
    onChange({})
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
            value={busqueda}
            onChange={e => onBusqueda(e.target.value)}
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

        {cantFiltros > 0 || busqueda ? (
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
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 10,
        }}>
          {camposEfectivos.map(c => (
            <FiltroSelect
              key={c.key}
              label={c.label}
              opciones={opciones[c.key]}
              valor={filtros[c.key]}
              onChange={v => set(c.key, v)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FiltroSelect({ label, opciones = [], valor, onChange }) {
  // Si el valor actualmente seleccionado ya no está disponible (por la cascada),
  // se mantiene visible como opción para no perder la selección abruptamente.
  const todasOpciones = valor && !opciones.includes(valor)
    ? [valor, ...opciones]
    : opciones

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <select
        className="input"
        value={valor || ''}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%' }}
      >
        <option value="">— Todas —</option>
        {todasOpciones.map(o => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  )
}
