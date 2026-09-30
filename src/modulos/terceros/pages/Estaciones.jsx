import { useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargaAMano from '../components/CargaAMano'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import FiltroMultiple from '../components/FiltroMultiple'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { bajarCsv, comoNumeroCsv } from '../exportar'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import {
  listarEstaciones, obtenerCruceEstaciones, subirArchivoEstacion,
} from '../services/terceros'
import { comoEntero, comoFecha, comoNumero, comoPesosEnteros } from '../formato'
import styles from './Estaciones.module.css'

// El otro lado del combustible: lo que la estación facturó, contra lo que el
// sistema dice que se cargó.
//
// **Una carga que la estación cobró y nadie registró es plata que la empresa
// pagó y no le descontó a nadie.** Ése es el punto de toda la pantalla.
//
// Se arma como la Quincena, y por la misma razón: una sola tabla con todas las
// filas, y arriba los filtros, los chips y las tarjetas, que son tres atajos
// al mismo filtro. Partirlo en una tabla por problema obligaba a elegir cuál
// mirar antes de saber qué se está buscando.
//
// Nada se explica con un párrafo en la pantalla: lo que hay que mirar son las
// filas.

// Cómo quedó cada línea: seis estados, y cada fila está en uno solo. Las
// tarjetas de arriba son esos mismos seis, así que suman el total de la tabla.
//
// El backend distingue TRES formas de cruzar —por vale, por patente y litros,
// y con la patente tipeada mal— y acá se muestran como una sola. Para quien
// liquida, cruzó o no cruzó; el cómo es de la máquina.
const ESTADOS = {
  cruza: 'Cruza',
  litros_distintos: 'Litros distintos',
  sin_cargar: 'Sin cargar',
  sin_estacion: 'Sin facturar',
  sin_asignar: 'Sin asignar',
  fuera_del_archivo: 'Fuera del archivo',
}

// Las tres formas de cruzar que manda el backend, para juntarlas en una.
const CRUZA = new Set(['vale', 'patente_litros', 'patente_parecida'])

// Los tres que son un problema de alguien. Los otros tres no lo son: cruzó,
// no salió a un colectivo, o el archivo no trae ese día.
const ALERTA = new Set(['sin_cargar', 'sin_estacion', 'litros_distintos'])

// Las tarjetas, en el orden en que importan: primero lo que hay que ir a
// mirar, que es a qué se entra a esta pantalla.
const TARJETAS = [
  { estado: 'sin_cargar', label: 'Vales sin cargar en el sistema' },
  { estado: 'sin_estacion', label: 'Vales sin facturar' },
  { estado: 'litros_distintos', label: 'Litros distintos' },
  { estado: 'cruza', label: 'Cruzan' },
  { estado: 'sin_asignar', label: 'Vales sin asignar' },
  { estado: 'fuera_del_archivo', label: 'Fuera del archivo' },
]

const FILTROS = [
  ['estacion', 'Estación'],
  ['fecha', 'Fecha'],
  ['vale', 'Vale'],
  ['patente', 'Patente'],
  ['tercero', 'Tercero'],
  ['estado', 'Estado'],
]

const CLAVES = FILTROS.map(([c]) => c)

// Las columnas de la única tabla. El grupo dice de qué lado viene cada dato:
// «Vale» solo no dice de cuál de los dos, y la pregunta es exactamente ésa.
//
// El estado va último y no primero: primero se leen los dos lados, y el estado
// es la conclusión de haberlos comparado.
const COLUMNAS = [
  { clave: 'estacion', label: 'Estación' },
  { clave: 'patente', label: 'Patente' },
  { clave: 'e_fecha', label: 'Fecha', grupo: 'Estación', tipo: 'fecha' },
  { clave: 'e_vale', label: 'Vale', grupo: 'Estación' },
  { clave: 'e_litros', label: 'Litros', grupo: 'Estación', align: 'right', tipo: 'numero' },
  { clave: 'e_importe', label: 'Importe', grupo: 'Estación', align: 'right', tipo: 'pesos' },
  { clave: 's_fecha', label: 'Fecha', grupo: 'Sistema', tipo: 'fecha' },
  { clave: 's_vale', label: 'Vale', grupo: 'Sistema' },
  { clave: 's_litros', label: 'Litros', grupo: 'Sistema', align: 'right', tipo: 'numero' },
  { clave: 'tercero', label: 'Tercero', grupo: 'Sistema' },
  { clave: 'observacion', label: 'Comentario', grupo: 'Sistema' },
  { clave: 'estado', label: 'Estado', tipo: 'estado' },
]

// El primer piso del encabezado: de qué lado es cada bloque de columnas.
const GRUPOS = [
  { label: '', cuantas: 2 },
  { label: 'Estación', cuantas: 4 },
  { label: 'Sistema', cuantas: 5 },
  { label: '', cuantas: 1 },
]

function Estacion({ estacion, quincena, activa, onElegir }) {
  const entrada = useRef(null)
  const qc = useQueryClient()

  const subir = useMutation({
    mutationFn: (archivo) => subirArchivoEstacion(estacion.id, quincena, archivo),
    onSuccess: (d) => {
      toast.success(`${comoEntero(d.lineas)} línea(s) de ${d.estacion}`)
      if (d.reemplazadas > 0) {
        toast(`Se reemplazaron ${comoEntero(d.reemplazadas)} que ya estaban`)
      }
      qc.invalidateQueries({ queryKey: ['terceros', 'estaciones'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
    },
    onError: err => toast.error(err.message),
  })

  const elegir = (e) => {
    const archivo = e.target.files?.[0]
    if (archivo) subir.mutate(archivo)
    e.target.value = ''   // para poder subir el mismo archivo otra vez
  }

  // El chip dice si se leyó el archivo y cuántas líneas trajo. El detalle de
  // cada una aparece al tocarlo, que es cuando alguien lo está preguntando.
  return (
    <div className={`${styles.chip} ${activa ? styles.chipActivo : ''}`}
         title={estacion.origen_campo
           ? `En el sistema de campo: ${estacion.origen_campo}`
           : 'Falta definir con qué nombre se registran sus cargas'}>
      <button className={styles.chipCuerpo} onClick={onElegir}>
        {!estacion.origen_campo && <span className={styles.chipFalta}>!</span>}
        {estacion.nombre}
        <span className={styles.chipCuenta}>
          {estacion.lineas > 0 ? comoEntero(estacion.lineas) : '—'}
        </span>
      </button>

      {estacion.acepta_archivo ? (
        <>
          <input type="file" ref={entrada} onChange={elegir}
                 accept=".xlsx,.xls" style={{ display: 'none' }} />
          <button className={styles.chipSubir} disabled={subir.isPending}
                  onClick={() => entrada.current?.click()}
                  title={estacion.lineas > 0
                    ? 'Subir otro archivo: reemplaza las líneas que esta estación ya trajo'
                    : 'Subir el archivo de esta estación'}>
            {subir.isPending ? 'Leyendo…' : 'Subir'}
          </button>
        </>
      ) : (
        <span className={styles.chipNota} title="No manda archivo: sus cargas se tipean">
          a mano
        </span>
      )}
    </div>
  )
}

export default function Estaciones() {
  const quincena = useQuincenaStore(s => s.quincena)
  const [filtros, setFiltros] = useState({})
  const [orden, setOrden] = useState({ clave: 'fecha', asc: true })

  const { data: estaciones = [], isLoading } = useQuery({
    queryKey: ['terceros', 'estaciones', quincena],
    queryFn: () => listarEstaciones(quincena),
    enabled: !!quincena,
  })

  const { data: cruce, isLoading: cruzando } = useQuery({
    queryKey: ['terceros', 'estaciones', 'cruce', quincena],
    queryFn: () => obtenerCruceEstaciones(quincena),
    enabled: !!quincena,
  })

  const nombres = useMemo(
    () => Object.fromEntries(estaciones.map(e => [e.id, e.nombre])), [estaciones])

  // Los dos lados se aplanan en una fila sola. Lo que se filtra —estación,
  // fecha, vale, patente— sale del lado que lo tenga: una línea que la estación
  // no facturó no tiene lado de estación, pero su fecha y su patente existen
  // igual, y si no filtraría a nada.
  const filas = useMemo(() => (cruce?.filas ?? []).map((f, i) => ({
    id: i,
    estado: CRUZA.has(f.estado) ? 'cruza' : f.estado,
    estacion: nombres[f.estacion_id] ?? f.facturada?.estacion ?? '',
    patente: f.facturada?.patente ?? f.carga?.patente ?? '',
    fecha: f.facturada?.fecha ?? f.carga?.fecha ?? '',
    vale: f.facturada?.vale ?? f.carga?.vale ?? '',
    tercero: f.carga?.tercero ?? '',
    e_fecha: f.facturada?.fecha ?? '',
    e_vale: f.facturada?.vale ?? '',
    e_litros: f.facturada?.litros ?? null,
    e_importe: f.facturada?.importe ?? null,
    s_fecha: f.carga?.fecha ?? '',
    s_vale: f.carga?.vale ?? '',
    s_litros: f.carga?.litros ?? null,
    observacion: f.carga?.observacion ?? '',
  })), [cruce, nombres])

  const opciones = useMemo(
    () => opcionesCascada(filas, CLAVES, filtros), [filas, filtros])

  const visibles = useMemo(() => {
    const pasa = filas.filter(f => pasaFiltros(f, CLAVES, filtros))
    const col = COLUMNAS.find(c => c.clave === orden.clave)
    const numerica = col?.tipo === 'numero' || col?.tipo === 'pesos'
    return [...pasa].sort((a, b) => {
      const x = a[orden.clave], y = b[orden.clave]
      const n = numerica
        ? Number(x ?? 0) - Number(y ?? 0)
        : String(x ?? '').localeCompare(String(y ?? ''), 'es')
      return orden.asc ? n : -n
    })
  }, [filas, filtros, orden])

  // Las tarjetas y los chips son atajos al mismo filtro: tocar uno es elegir
  // ese valor y soltar lo que hubiera de esa clave. Se cuentan sobre TODAS las
  // filas y no sobre las visibles, para que el número no cambie al filtrar por
  // otra cosa: es el tamaño del problema, no el del recorte.
  const cuantas = (clave, valor) => filas.filter(f => f[clave] === valor).length
  const elegido = (clave, valor) => filtros[clave]?.size === 1 && filtros[clave].has(valor)
  const elegir = (clave, valor) => setFiltros(f => ({
    ...f,
    [clave]: elegido(clave, valor) ? new Set() : new Set([valor]),
  }))

  const etiqueta = (clave, v) =>
    clave === 'fecha' ? comoFecha(v) : clave === 'estado' ? (ESTADOS[v] ?? v) : v

  const valor = (fila, col) => {
    const v = fila[col.clave]
    if (col.tipo === 'estado') return ESTADOS[v] ?? v
    if (v === null || v === '') return ''
    if (col.tipo === 'numero') return comoNumero(v)
    if (col.tipo === 'pesos') return comoPesosEnteros(v)
    if (col.tipo === 'fecha') return comoFecha(v)
    return v
  }

  const ordenarPor = (clave) =>
    setOrden(o => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }))

  const exportar = () => {
    bajarCsv(`estaciones-${quincena}`, COLUMNAS.map(c => ({
      label: c.grupo ? `${c.grupo} ${c.label}` : c.label,
      valor: f => (c.tipo === 'numero' || c.tipo === 'pesos'
        ? comoNumeroCsv(f[c.clave])
        : valor(f, c)),
    })), visibles)
    toast.success(`${comoEntero(visibles.length)} líneas exportadas`)
  }

  const hayFiltro = Object.values(filtros).some(s => s?.size)
  // El formulario de lo que se tipea ocupa media pantalla y no es de todos los
  // días: aparece cuando se elige esa estación.
  const aMano = estaciones.find(
    e => !e.acepta_archivo && e.activa && elegido('estacion', e.nombre))

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Estaciones de servicio</div>
        <SelectorQuincena />
        <div className={styles.acciones}>
          <button className="btn btn-sm" disabled={!visibles.length} onClick={exportar}>
            Exportar
          </button>
        </div>
      </div>

      {!quincena && <div className={styles.vacio}>Elegí una quincena.</div>}
      {quincena && (isLoading || cruzando) && <CargandoContenido texto="Cruzando…" />}

      {quincena && !isLoading && !cruzando && (
        <>
          <div className={styles.panelFiltros}>
            <div className={styles.filtros}>
              {FILTROS.filter(([clave]) => opciones[clave]).map(([clave, label]) => (
                <FiltroMultiple
                  key={clave} label={label} valores={opciones[clave]}
                  seleccion={filtros[clave] ?? new Set()}
                  etiqueta={v => etiqueta(clave, v)}
                  onCambiar={sel => setFiltros(f => ({ ...f, [clave]: sel }))}
                />
              ))}
              {hayFiltro && (
                <button className={styles.limpiar} onClick={() => setFiltros({})}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className={styles.chips}>
            {estaciones.map(e => (
              <Estacion key={e.id} estacion={e} quincena={quincena}
                        activa={elegido('estacion', e.nombre)}
                        onElegir={() => elegir('estacion', e.nombre)} />
            ))}
          </div>

          <div className={styles.resumen}>
            {TARJETAS.map(t => {
              const n = cuantas('estado', t.estado)
              return (
                <button key={t.estado} disabled={!n}
                        onClick={() => elegir('estado', t.estado)}
                        className={[styles.dato,
                          ALERTA.has(t.estado) && n ? styles.datoAviso : '',
                          elegido('estado', t.estado) ? styles.datoActivo : ''].join(' ')}>
                  <span className={styles.datoLabel}>{t.label}</span>
                  <span className={styles.datoValor}>{comoEntero(n)}</span>
                </button>
              )
            })}
          </div>

          {aMano && <CargaAMano estacion={aMano} quincena={quincena} />}

          <div className={styles.tabla}>
            <table>
              <thead>
                <tr>
                  {GRUPOS.map((g, i) => (
                    <th key={i} colSpan={g.cuantas}
                        className={g.label ? styles.grupo : styles.grupoVacio}>
                      {g.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {COLUMNAS.map(c => (
                    <th key={c.clave} className={styles.th} onClick={() => ordenarPor(c.clave)}
                        style={{ textAlign: c.align ?? 'left' }}
                        title="Ordenar por esta columna">
                      {c.label}
                      {orden.clave === c.clave && (
                        <span className={styles.flecha}>{orden.asc ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(f => (
                  <tr key={f.id}>
                    {COLUMNAS.map(c => (
                      <td key={c.clave} style={{ textAlign: c.align ?? 'left' }}
                          className={c.tipo === 'estado'
                            ? (ALERTA.has(f.estado) ? styles.pendiente : styles.ok) : ''}>
                        {valor(f, c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {visibles.length === 0 && (
              <div className={styles.vacio}>
                {filas.length === 0
                  ? 'Todavía no se subió ningún archivo de esta quincena.'
                  : 'Ninguna línea coincide con esos filtros.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
