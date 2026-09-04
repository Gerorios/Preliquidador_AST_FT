import { useMemo, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import styles from './PanelPorConcepto.module.css'
import { agruparPorConcepto, etiquetaAlcance } from './agruparPorConcepto'
import { UNIDADES, TIPOS, CATEGORIAS } from './conceptosConstantes'

const fmt = (p) => `$${Number(p).toLocaleString('es-AR')}`

// ─── CeldaPrecio: precio editable en el lugar (mismo comportamiento que la
// tabla plana). Muestra "ant. $X" solo si difiere y el badge heredado.
function CeldaPrecio({ regla, onGuardarPrecio, guardando }) {
  const [editando, setEditando] = useState(false)
  const [precio, setPrecio] = useState(regla.precio ?? '')

  useEffect(() => { if (!editando) setPrecio(regla.precio ?? '') }, [regla.precio, editando])

  const confirmar = () => {
    const valor = precio !== '' ? parseFloat(precio) : null
    if (valor == null || Number.isNaN(valor)) { toast.error('Ingresá un precio válido'); return }
    onGuardarPrecio(regla.id, valor)
    setEditando(false)
  }

  if (editando) {
    return (
      <span className={styles.edit}>
        <input className="input input-mono" type="number" style={{ width: 84 }} autoFocus
          value={precio} onChange={e => setPrecio(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') confirmar(); if (e.key === 'Escape') setEditando(false) }} />
        <button className="btn btn-primary btn-sm" onClick={confirmar} disabled={guardando}>✓</button>
        <button className="btn btn-sm" onClick={() => setEditando(false)}>✕</button>
      </span>
    )
  }

  const tiene = regla.precio != null && regla.precio !== ''
  const difiere = tiene && regla.precio_anterior != null && Number(regla.precio_anterior) !== Number(regla.precio)
  return (
    <span>
      {tiene
        ? <span className={styles.precio} onClick={() => setEditando(true)} title="Clic para editar">{fmt(regla.precio)}</span>
        : <span className={styles.sinPrecio} onClick={() => setEditando(true)} title="Clic para cargar el precio">sin precio</span>}
      {difiere && <span className={styles.ant}>ant. {fmt(regla.precio_anterior)}</span>}
      {regla.heredado && <span className={styles.heredado} title="Copiado de otra quincena, sin confirmar">heredado</span>}
    </span>
  )
}

// ─── Celda: una regla, varias por categoría (apiladas) o "falta".
function Celda({ fila, codigo, onGuardarPrecio, guardando, onAbrirAlta }) {
  const reglas = fila.celdas[codigo]
  if (!reglas) {
    if (!fila.controlada) return <span className={styles.na}>—</span>
    return (
      <button type="button" className={styles.falta} onClick={onAbrirAlta}
        title={`Crear ${codigo} para ${etiquetaAlcance(fila).titulo}`}>
        falta
      </button>
    )
  }
  if (reglas.length === 1 && reglas[0].categoria == null) {
    return <CeldaPrecio regla={reglas[0]} onGuardarPrecio={onGuardarPrecio} guardando={guardando} />
  }
  return (
    <span className={styles.cat}>
      {reglas.map(r => (
        <FragmentoCategoria key={r.id} regla={r} onGuardarPrecio={onGuardarPrecio} guardando={guardando} />
      ))}
    </span>
  )
}

function FragmentoCategoria({ regla, onGuardarPrecio, guardando }) {
  return (
    <>
      <span className={styles.catK}>{regla.categoria != null ? `cat ${regla.categoria}` : 'sin cat.'}</span>
      <CeldaPrecio regla={regla} onGuardarPrecio={onGuardarPrecio} guardando={guardando} />
    </>
  )
}

// ─── FormAltaCodigo: alta precargada (tarea, alcance, código). Pide unidad,
// precio, tipo y categoría opcional. Pasa por la compuerta de solapamiento
// como cualquier alta porque usa la misma mutation.
function FormAltaCodigo({ tarea, fila, codigo, codigos, quincena, onCrearRegla, onCerrar }) {
  const [form, setForm] = useState({ unidad_base: 'fijo', precio: '', tipo: 'REMUNERATIVO', categoria: '' })
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const { titulo } = etiquetaAlcance(fila)

  const guardar = () => {
    const precio = form.precio !== '' ? parseFloat(form.precio) : null
    if (precio == null || Number.isNaN(precio)) { toast.error('Ingresá un precio válido'); return }
    const datos = {
      quincena,
      tarea_nombre: tarea,
      cliente_nombre: fila.cliente_nombre,
      finca_nombre: fila.finca_nombre,
      supervisor_nombre: fila.supervisor_nombre,
      codigo,
      unidad_base: form.unidad_base,
      precio,
      tipo: form.tipo,
      categoria: form.categoria !== '' ? parseInt(form.categoria) : null,
      // Nace igual que el resto del alcance: reemplaza si el alcance reemplaza.
      reemplaza_comun: fila.tipo === 'comun' ? false : fila.reemplaza_comun,
    }
    onCrearRegla(datos, onCerrar)
  }

  return (
    <tr className={styles.altaRow}>
      <td colSpan={codigos.length + 2}>
        <div className={styles.altaForm}>
          <span className={styles.altaTitulo}>Crear <b>{codigo}</b> para {titulo}:</span>
          <select className="input" value={form.unidad_base} onChange={set('unidad_base')} style={{ width: 200 }}>
            {UNIDADES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
          <input className="input input-mono" type="number" placeholder="$ precio" style={{ width: 110 }} autoFocus
            value={form.precio} onChange={set('precio')}
            onKeyDown={e => { if (e.key === 'Enter') guardar(); if (e.key === 'Escape') onCerrar() }} />
          <select className="input" value={form.tipo} onChange={set('tipo')} style={{ width: 160 }}>
            {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select className="input" value={form.categoria} onChange={set('categoria')} style={{ width: 120 }}>
            <option value="">Sin categoría</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>Cat. {c}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={guardar}>Guardar</button>
          <button className="btn btn-sm" onClick={onCerrar}>Cancelar</button>
        </div>
      </td>
    </tr>
  )
}

const TEXTO_ESTADO = (fila) => {
  if (fila.estado === 'informativo') return <span className={styles.info}>solo informativo — no se controla</span>
  if (fila.estado === 'falta') return <span className={styles.bad}>✗ falta {fila.faltan.join(', ')}</span>
  if (fila.estado === 'sin_precio') return <span className={styles.wa}>⚠ {fila.sinPrecio.join(', ')} sin precio</span>
  if (fila.estado === 'sin_codigo') return <span className={styles.wa}>⚠ {fila.sinCodigo} {fila.sinCodigo === 1 ? 'regla' : 'reglas'} sin código</span>
  return <span className={styles.ok}>✓ completo</span>
}

export default function PanelPorConcepto({ reglas, quincena, filtroCodigo, filtros, onGuardarPrecio, guardando, onCrearRegla }) {
  const [soloIncompletos, setSoloIncompletos] = useState(false)
  const [altaAbierta, setAltaAbierta] = useState(null) // { tarea, clave, codigo }
  const [abiertas, setAbiertas] = useState(() => new Set()) // tareas expandidas por el usuario

  const { bloques, resumen } = useMemo(
    () => agruparPorConcepto(reglas, { filtroCodigo, filtros, soloIncompletos }),
    [reglas, filtroCodigo, filtros, soloIncompletos]
  )

  // Si cambian los datos/filtros y el alta abierta ya no corresponde, se cierra.
  useEffect(() => { setAltaAbierta(null) }, [quincena, filtroCodigo, filtros, soloIncompletos])

  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`

  const toggleTarea = (tarea) => setAbiertas(prev => {
    const next = new Set(prev)
    if (next.has(tarea)) next.delete(tarea); else next.add(tarea)
    return next
  })
  const abrirTodas = () => setAbiertas(new Set(bloques.map(b => b.tarea)))
  const cerrarTodas = () => setAbiertas(new Set())

  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={soloIncompletos} onChange={e => setSoloIncompletos(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }} />
          Solo incompletos
        </label>
        <button type="button" className="btn btn-sm" onClick={abrirTodas}>Abrir todas</button>
        <button type="button" className="btn btn-sm" onClick={cerrarTodas}>Cerrar todas</button>
        {resumen.incompletos + resumen.sinPrecio > 0
          ? <span className={styles.resumen}>{plural(resumen.tareas, 'tarea', 'tareas')} · <b>{plural(resumen.incompletos, 'alcance incompleto', 'alcances incompletos')}</b> · {plural(resumen.sinPrecio, 'sin precio', 'sin precio')}</span>
          : <span className={styles.resumenOk}>{plural(resumen.tareas, 'tarea', 'tareas')} · todo completo</span>}
      </div>

      {bloques.length === 0 && (
        <div className={styles.empty}>
          {reglas.length === 0 ? 'No hay conceptos cargados para esta quincena.' : 'Ningún concepto coincide con los filtros aplicados.'}
        </div>
      )}

      {bloques.map(b => {
        const abierta = abiertas.has(b.tarea) || bloques.length === 1
        return (
          <div key={b.tarea} className={styles.card}>
            <div className={styles.cardHead} onClick={() => toggleTarea(b.tarea)}>
              <span className={styles.cardTitle}>{b.tareaLabel}</span>
              <div className={styles.cardBadges}>
                <span className="badge badge-muted mono">
                  {b.codigos.map((c, i) => <span key={c}>{i > 0 && ' · '}{c}</span>)}
                </span>
                <span className="badge badge-muted">{plural(b.filas.length, 'alcance', 'alcances')}</span>
                {b.incompletos > 0
                  ? <span className="badge badge-danger">{plural(b.incompletos, 'incompleto', 'incompletos')}</span>
                  : b.sinPrecio > 0
                    ? <span className="badge badge-warn">{plural(b.sinPrecio, 'sin precio', 'sin precio')}</span>
                    : b.sinCodigo > 0
                      ? <span className="badge badge-warn">{plural(b.sinCodigo, 'sin código', 'sin código')}</span>
                      : b.controladas === 0
                        ? <span className="badge badge-muted" title="Solo alcances informativos: no hay nada que controlar">sin control</span>
                        : <span className="badge badge-green">completo</span>}
              </div>
              <span className={styles.cardChevron}>{abierta ? '▲' : '▼'}</span>
            </div>

            {abierta && (
              <div className={styles.cardBody}>
                <div className="table-wrap">
                  <table className={styles.tabla}>
                    <thead>
                      <tr>
                        <th>Alcance</th>
                        {b.codigos.map(c => <th key={c} className={styles.cod}>{c}</th>)}
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.filas.map(fila => {
                        const { titulo, subtitulo } = etiquetaAlcance(fila)
                        const claseFila = fila.estado === 'falta' ? styles.filaFalta : (fila.estado === 'sin_precio' || fila.estado === 'sin_codigo') ? styles.filaSinPrecio : undefined
                        const altaAca = altaAbierta && altaAbierta.tarea === b.tarea && altaAbierta.clave === fila.clave
                        return (
                          <FilaConAlta key={fila.clave}
                            fila={fila} titulo={titulo} subtitulo={subtitulo} claseFila={claseFila}
                            codigos={b.codigos} tarea={b.tareaLabel} quincena={quincena}
                            onGuardarPrecio={onGuardarPrecio} guardando={guardando}
                            altaCodigo={altaAca ? altaAbierta.codigo : null}
                            onAbrirAlta={(codigo) => setAltaAbierta({ tarea: b.tarea, clave: fila.clave, codigo })}
                            onCerrarAlta={() => setAltaAbierta(null)}
                            onCrearRegla={onCrearRegla}
                          />
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Fila de alcance + (opcional) fila de alta desplegada debajo.
function FilaConAlta({ fila, titulo, subtitulo, claseFila, codigos, tarea, quincena, onGuardarPrecio, guardando, altaCodigo, onAbrirAlta, onCerrarAlta, onCrearRegla }) {
  return (
    <>
      <tr className={claseFila}>
        <td className={styles.alcance}>{titulo}<span className={styles.alcanceSub}>{subtitulo}</span></td>
        {codigos.map(c => (
          <td key={c} className={styles.cel}>
            <Celda fila={fila} codigo={c} onGuardarPrecio={onGuardarPrecio} guardando={guardando}
              onAbrirAlta={() => onAbrirAlta(c)} />
          </td>
        ))}
        <td className={styles.estado}>{TEXTO_ESTADO(fila)}</td>
      </tr>
      {altaCodigo != null && (
        <FormAltaCodigo tarea={tarea} fila={fila} codigo={altaCodigo} codigos={codigos} quincena={quincena}
          onCrearRegla={onCrearRegla} onCerrar={onCerrarAlta} />
      )}
    </>
  )
}
