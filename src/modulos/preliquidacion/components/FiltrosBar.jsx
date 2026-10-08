import { useState, useMemo, useRef, useEffect } from 'react'
import Icono from '../../../core/ui/iconos'
import { CAMPOS_LINEAS } from '../pages/filtrarLineas'
import { opcionesCascada } from '../pages/opcionesCascada'
import styles from './FiltrosBar.module.css'

const ALERTAS = [
  { value: 'incompleta', label: 'Incompleta', tono: 'warn' },
  { value: 'alerta_legajo', label: 'Legajo inválido', tono: 'warn' },
  { value: 'alerta_empresa', label: 'Empresa a verificar', tono: 'warn' },
  { value: 'es_duplicado', label: 'Duplicado', tono: 'danger' },
  { value: 'es_posible_duplicado', label: 'Posible duplicado', tono: 'warn' },
]

// Barra de filtros común a todas las pantallas de Preliquidación. Siempre en
// el mismo orden: quincena, búsqueda, filtros de la pantalla, alertas (si la
// pantalla las usa) y Limpiar. Debajo, lo que está filtrando en ese momento,
// cada cosa con su botón para sacarla.
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
  // Selector de quincena de la pantalla (va primero en la barra).
  quincena = null,
  // Condición que ya aplica la pantalla además de los campos (búsqueda,
  // alertas): las opciones de cada filtro salen sólo de lo que la cumple.
  prefiltro = null,
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
    // Sólo `textoBusqueda`, a propósito: con `busqueda` en las deps, un
    // cambio externo dispararía el efecto con el texto viejo y lo pisaría.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textoBusqueda])

  const datosEfectivos = datos ?? lineas
  const camposEfectivos = campos ?? CAMPOS_LINEAS

  const toggle = (k, valor) => onChange(f => {
    const actual = f[k] || []
    const next = actual.includes(valor) ? actual.filter(v => v !== valor) : [...actual, valor]
    return { ...f, [k]: next.length ? next : undefined }
  })

  const quitar = (k, valor) => onChange(f => {
    const next = (f[k] || []).filter(v => v !== valor)
    return { ...f, [k]: next.length ? next : undefined }
  })

  const setValores = (k, arr) => onChange(f => ({ ...f, [k]: arr && arr.length ? arr : undefined }))
  const setAlerta = (v) => onChange(f => ({ ...f, alerta: f.alerta === v ? undefined : v }))
  const sacar = (k) => onChange(f => ({ ...f, [k]: undefined }))

  const cantCampos = camposEfectivos.filter(c => filtros[c.key]?.length).length

  // Todo lo que está filtrando ahora, en una lista para mostrarlo como chips.
  const activos = [
    ...(busqueda ? [{ id: 'busqueda', texto: `Búsqueda: “${busqueda}”`, quitar: () => { setTextoBusqueda(''); onBusqueda?.('') } }] : []),
    ...(filtros.solo_alertas ? [{ id: 'solo_alertas', texto: 'Sólo líneas con alerta', quitar: () => sacar('solo_alertas') }] : []),
    ...(filtros.alerta ? [{ id: 'alerta', texto: `Alerta: ${ALERTAS.find(a => a.value === filtros.alerta)?.label ?? filtros.alerta}`, quitar: () => sacar('alerta') }] : []),
    ...camposEfectivos.flatMap(c => (filtros[c.key] || []).map(v => ({
      id: `${c.key}:${v}`, texto: `${c.label}: ${v}`, quitar: () => quitar(c.key, v),
    }))),
  ]

  const limpiar = () => {
    onChange({})
    setTextoBusqueda('')
    onBusqueda?.('')
  }

  // Opciones en cascada: sólo se calculan con el panel abierto, sobre lo que
  // ya pasa la búsqueda y las alertas de la pantalla.
  const opciones = useMemo(() => {
    if (!abierto) {
      const vacio = {}
      for (const c of camposEfectivos) vacio[c.key] = []
      return vacio
    }
    return opcionesCascada(datosEfectivos, filtros, camposEfectivos, prefiltro)
  }, [datosEfectivos, filtros, abierto, camposEfectivos, prefiltro])

  return (
    <div className={styles.barra}>
      <div className={styles.fila}>
        {quincena}

        {mostrarBusqueda && (
          <label className={styles.busqueda}>
            <Icono nombre="buscar" size={15} />
            <input
              placeholder={placeholderBusqueda}
              value={textoBusqueda}
              onChange={e => setTextoBusqueda(e.target.value)}
            />
          </label>
        )}

        {camposEfectivos.length > 0 && (
          <button
            type="button"
            className={`btn btn-sm ${abierto ? 'btn-primary' : ''}`}
            aria-expanded={abierto}
            onClick={() => setAbierto(!abierto)}
          >
            <Icono nombre="filtro" size={14} />
            Filtros
            {cantCampos > 0 && <span className={styles.contador}>{cantCampos}</span>}
          </button>
        )}

        {mostrarAlertas && (
          <div className={styles.alertas} role="group" aria-label="Alertas">
            {ALERTAS.map(a => (
              <button
                key={a.value}
                type="button"
                aria-pressed={filtros.alerta === a.value}
                className={`${styles.alerta} ${filtros.alerta === a.value ? styles[a.tono] : ''}`}
                onClick={() => setAlerta(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}

        {activos.length > 0 && (
          <button type="button" className={`btn btn-sm ${styles.limpiar}`} onClick={limpiar}>
            <Icono nombre="cerrar" size={14} />
            Limpiar
          </button>
        )}
      </div>

      {abierto && (
        <div className={styles.panel}>
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

      {activos.length > 0 && (
        <div className={styles.activos} aria-label="Filtros activos">
          <span className={styles.activosTitulo}>Filtrando por</span>
          {activos.map(a => (
            <span key={a.id} className={styles.chip}>
              {a.texto}
              <button type="button" aria-label={`Quitar ${a.texto}`} onClick={a.quitar}>
                <Icono nombre="cerrar" size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Dropdown multi-select: un botón que muestra los valores elegidos (o "Todas"
// si no hay ninguno), y una lista con checkboxes que se abre debajo. Se cierra
// al hacer click afuera.
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

  // Un valor elegido que la cascada ya no ofrece se sigue mostrando, para no
  // perder la selección de golpe.
  const todasOpciones = useMemo(() => {
    const faltantes = valores.filter(v => !opciones.includes(v))
    return faltantes.length ? [...faltantes, ...opciones].sort() : opciones
  }, [opciones, valores])

  return (
    <div className={styles.multi} ref={ref}>
      <div className={styles.multiLabel}>{label}</div>
      <button type="button" className={`input ${styles.multiBoton}`} onClick={() => setAbierto(o => !o)}>
        {valores.length === 0 ? (
          <span className={styles.todas}>Todas</span>
        ) : valores.length <= 2 ? (
          valores.map(v => (
            <span key={v} className="badge badge-info" onClick={e => { e.stopPropagation(); onQuitar(v) }}>
              <span className={styles.recorte}>{v}</span>
              <Icono nombre="cerrar" size={11} />
            </span>
          ))
        ) : (
          <span className="badge badge-info">{valores.length} seleccionadas</span>
        )}
        <span className={styles.flecha}><Icono nombre="abajo" size={14} /></span>
      </button>

      {abierto && (
        <div className={styles.lista}>
          {todasOpciones.length === 0 && <div className={styles.sinOpciones}>Sin opciones.</div>}
          {todasOpciones.length > 0 && (
            <label className={`${styles.opcion} ${styles.opcionTodos}`} onMouseDown={e => e.preventDefault()}>
              <input
                type="checkbox"
                checked={todasOpciones.every(o => valores.includes(o))}
                onChange={e => onSetTodos(e.target.checked ? todasOpciones : [])}
              />
              <span>Seleccionar todos</span>
            </label>
          )}
          {todasOpciones.map(o => (
            <label key={o} className={styles.opcion} onMouseDown={e => e.preventDefault()}>
              <input type="checkbox" checked={valores.includes(o)} onChange={() => onToggle(o)} />
              <span className={styles.recorte}>{o}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
