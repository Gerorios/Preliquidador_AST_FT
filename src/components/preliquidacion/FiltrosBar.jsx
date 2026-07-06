import { useState, useMemo } from 'react'

const ALERTAS = [
  { value: 'incompleta', label: 'Incompleta' },
  { value: 'alerta_legajo', label: 'Legajo inválido' },
  { value: 'alerta_empresa', label: 'Empresa a verificar' },
  { value: 'es_duplicado', label: 'Duplicado' },
]

// Mapeo de filtro -> campo de la línea
const CAMPO = {
  cliente: 'nombre_cliente',
  finca: 'nombre_finca',
  tarea: 'nombre_tarea',
  empresa: 'empresa_asignada',
  grupo_pago: 'grupo_pago_aplicado',
  supervisor: 'nombre_supervisor',
}

/**
 * Calcula las opciones disponibles para un campo de filtro,
 * considerando los DEMÁS filtros activos (cascada).
 * Si el cliente=CITRUSVIL está seleccionado, las fincas/tareas/supervisores
 * que se muestran son solo los que tienen registros con ese cliente.
 */
function opcionesPara(campo, lineas, filtros) {
  let subset = lineas
  for (const [key, valor] of Object.entries(filtros)) {
    if (key === campo || !valor) continue
    const campoLinea = CAMPO[key]
    if (!campoLinea) continue
    subset = subset.filter(l => l[campoLinea] === valor)
  }
  const campoLinea = CAMPO[campo]
  return [...new Set(subset.map(l => l[campoLinea]).filter(Boolean))].sort()
}

export default function FiltrosBar({ lineas = [], filtros, onChange, busqueda, onBusqueda, mostrarAlertas = true }) {
  const [abierto, setAbierto] = useState(false)

  const set = (k, v) => onChange(f => ({ ...f, [k]: v || undefined }))
  const setAlerta = (v) => onChange(f => ({ ...f, alerta: f.alerta === v ? undefined : v }))

  const cantFiltros = Object.values(filtros).filter(Boolean).length

  const limpiar = () => {
    onChange({})
    onBusqueda('')
  }

  // Opciones en cascada — se recalculan según los demás filtros activos
  const opciones = useMemo(() => ({
    clientes: opcionesPara('cliente', lineas, filtros),
    fincas: opcionesPara('finca', lineas, filtros),
    tareas: opcionesPara('tarea', lineas, filtros),
    empresas: opcionesPara('empresa', lineas, filtros),
    grupos_pago: opcionesPara('grupo_pago', lineas, filtros),
    supervisores: opcionesPara('supervisor', lineas, filtros),
  }), [lineas, filtros])

  return (
    <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>

      {/* Barra principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Buscar empleado, legajo, tarea..."
          value={busqueda}
          onChange={e => onBusqueda(e.target.value)}
        />

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
          <FiltroSelect
            label="Cliente"
            opciones={opciones.clientes}
            valor={filtros.cliente}
            onChange={v => set('cliente', v)}
          />
          <FiltroSelect
            label="Finca"
            opciones={opciones.fincas}
            valor={filtros.finca}
            onChange={v => set('finca', v)}
          />
          <FiltroSelect
            label="Tarea"
            opciones={opciones.tareas}
            valor={filtros.tarea}
            onChange={v => set('tarea', v)}
          />
          <FiltroSelect
            label="Empresa"
            opciones={opciones.empresas}
            valor={filtros.empresa}
            onChange={v => set('empresa', v)}
          />
          <FiltroSelect
            label="Grupo de pago"
            opciones={opciones.grupos_pago}
            valor={filtros.grupo_pago}
            onChange={v => set('grupo_pago', v)}
          />
          <FiltroSelect
            label="Supervisor"
            opciones={opciones.supervisores}
            valor={filtros.supervisor}
            onChange={v => set('supervisor', v)}
          />
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