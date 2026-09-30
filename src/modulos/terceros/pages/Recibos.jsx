import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import AccionesRecibo from '../components/AccionesRecibo'
import EmitirLote from '../components/EmitirLote'
import FiltroMultiple from '../components/FiltroMultiple'
import SaldosIniciales from '../components/SaldosIniciales'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { bajarCsv, comoNumeroCsv } from '../exportar'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import { listarRecibos } from '../services/terceros'
import { comoEntero, comoPesosEnteros } from '../formato'
import { ESTADOS_RECIBO, estadoDe } from '../recibos'
import styles from './Recibos.module.css'

// Un renglón por tercero de la quincena: qué hay que hacer con cada recibo.
//
// Se arma como la Quincena: filtros arriba, tarjetas que son atajos al mismo
// filtro, y una sola tabla. El recibo en sí —lo que se imprime o se manda— es
// otra pantalla; ésta es la de trabajo, y se lee por estado: qué falta emitir,
// qué factura hay que revisar, qué hay que pagar.

const FILTROS = [
  ['tercero', 'Tercero'],
  ['empresa', 'Empresa'],
  ['estado', 'Estado'],
]
const CLAVES = FILTROS.map(([c]) => c)

const COLUMNAS = [
  { clave: 'tercero', label: 'Tercero' },
  { clave: 'empresa', label: 'Empresa' },
  { clave: 'total_a_facturar', label: 'Total a facturar', pesos: true },
  { clave: 'seguros', label: 'Seguros', pesos: true },
  { clave: 'total_a_pagar', label: 'Total a pagar', pesos: true },
  { clave: 'saldo_anterior', label: 'Saldo anterior', pesos: true },
  { clave: 'total', label: 'Total', pesos: true },
  { clave: 'factura_numero', label: 'Factura' },
  { clave: 'estado', label: 'Estado' },
]

export default function Recibos() {
  const quincena = useQuincenaStore(s => s.quincena)
  const [filtros, setFiltros] = useState({})
  const [orden, setOrden] = useState({ clave: 'tercero', asc: true })
  const [abierto, setAbierto] = useState(null)       // el tercero del diálogo
  const [lote, setLote] = useState(false)
  const [saldos, setSaldos] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['terceros', 'recibos', quincena],
    queryFn: () => listarRecibos(quincena),
    enabled: !!quincena,
  })

  const filas = useMemo(() => data.map(r => ({
    ...r, estado: estadoDe(r), empresa: r.empresa ?? '',
  })), [data])

  const opciones = useMemo(() => opcionesCascada(filas, CLAVES, filtros), [filas, filtros])
  const visibles = useMemo(() => {
    const pasa = filas.filter(f => pasaFiltros(f, CLAVES, filtros))
    const col = COLUMNAS.find(c => c.clave === orden.clave)
    return [...pasa].sort((a, b) => {
      const n = col?.pesos
        ? Number(a[orden.clave] ?? 0) - Number(b[orden.clave] ?? 0)
        : String(a[orden.clave] ?? '').localeCompare(String(b[orden.clave] ?? ''), 'es')
      return orden.asc ? n : -n
    })
  }, [filas, filtros, orden])

  // Las tarjetas son atajos al filtro de estado, y cuentan sobre todos: es el
  // tamaño del trabajo que queda, no el del recorte.
  const cuantas = (e) => filas.filter(f => f.estado === e).length
  const elegido = (clave, v) => filtros[clave]?.size === 1 && filtros[clave].has(v)
  const elegir = (clave, v) => setFiltros(f => ({
    ...f, [clave]: elegido(clave, v) ? new Set() : new Set([v]),
  }))
  const hayFiltro = Object.values(filtros).some(s => s?.size)
  const etiqueta = (clave, v) => (clave === 'estado' ? ESTADOS_RECIBO[v]?.label ?? v : v)

  const listos = filas.filter(f => f.estado === 'para_emitir')
  const emitidos = filas.filter(f => f.emitido)

  const ordenarPor = (clave) =>
    setOrden(o => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }))

  const exportar = () => {
    bajarCsv(`recibos-${quincena}`, COLUMNAS.map(c => ({
      label: c.label,
      valor: f => (c.pesos ? comoNumeroCsv(f[c.clave])
        : c.clave === 'estado' ? ESTADOS_RECIBO[f.estado]?.label : f[c.clave]),
    })), visibles)
    toast.success(`${comoEntero(visibles.length)} recibos exportados`)
  }

  const imprimir = (terceros) => {
    const q = new URLSearchParams({ quincena })
    terceros.forEach(t => q.append('tercero', t))
    window.open(`/terceros/recibo?${q}`, '_blank')
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Recibos</div>
        <SelectorQuincena />
        <div className={styles.acciones}>
          <button className="btn btn-sm" onClick={() => setSaldos(true)}>Saldos iniciales</button>
          <button className="btn btn-sm" disabled={!emitidos.length}
                  onClick={() => imprimir(emitidos.map(f => f.tercero))}>
            Imprimir emitidos ({comoEntero(emitidos.length)})
          </button>
          <button className="btn btn-sm" disabled={!visibles.length} onClick={exportar}>
            Exportar
          </button>
          <button className="btn btn-primary btn-sm" disabled={!listos.length}
                  onClick={() => setLote(true)}>
            Emitir ({comoEntero(listos.length)})
          </button>
        </div>
      </div>

      {!quincena && <div className={styles.vacio}>Elegí una quincena.</div>}
      {quincena && isLoading && <CargandoContenido texto="Armando los recibos…" />}

      {quincena && !isLoading && (
        <>
          <div className={styles.panelFiltros}>
            <div className={styles.filtros}>
              {FILTROS.filter(([c]) => opciones[c]).map(([clave, label]) => (
                <FiltroMultiple key={clave} label={label} valores={opciones[clave]}
                                seleccion={filtros[clave] ?? new Set()}
                                etiqueta={v => etiqueta(clave, v)}
                                onCambiar={sel => setFiltros(f => ({ ...f, [clave]: sel }))} />
              ))}
              {hayFiltro && (
                <button className={styles.limpiar} onClick={() => setFiltros({})}>
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>

          <div className={styles.resumen}>
            {Object.entries(ESTADOS_RECIBO).map(([clave, e]) => {
              const n = cuantas(clave)
              return (
                <button key={clave} disabled={!n} onClick={() => elegir('estado', clave)}
                        className={[styles.dato, e.alerta && n ? styles.datoAviso : '',
                          elegido('estado', clave) ? styles.datoActivo : ''].join(' ')}>
                  <span className={styles.datoLabel}>{e.label}</span>
                  <span className={styles.datoValor}>{comoEntero(n)}</span>
                </button>
              )
            })}
          </div>

          <div className={styles.tabla}>
            <table>
              <thead>
                <tr>
                  {COLUMNAS.map(c => (
                    <th key={c.clave} className={styles.th} onClick={() => ordenarPor(c.clave)}
                        style={{ textAlign: c.pesos ? 'right' : 'left' }}
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
                  <tr key={f.tercero} className={styles.fila} onClick={() => setAbierto(f.tercero)}>
                    {COLUMNAS.map(c => {
                      if (c.clave === 'estado') {
                        const e = ESTADOS_RECIBO[f.estado]
                        return (
                          <td key={c.clave}>
                            <span className={e?.alerta ? styles.pendiente : styles.ok}>
                              {e?.label}
                            </span>
                            {f.en_revision && <span className={styles.marca}> · en revisión</span>}
                          </td>
                        )
                      }
                      const v = f[c.clave]
                      // Lo emitido que hoy daría otro número: un hecho llegó
                      // tarde o se corrigió en el origen. No cambia el recibo.
                      const cambio = c.clave === 'total_a_pagar' && Number(f.cambio_desde_emision)
                      return (
                        <td key={c.clave} style={{ textAlign: c.pesos ? 'right' : 'left' }}>
                          {c.pesos ? comoPesosEnteros(v) : v}
                          {cambio ? (
                            <span className={styles.cambio}
                                  title="Hoy daría otro número: algo llegó tarde o se corrigió después de emitirlo">
                              {' '}Δ {comoPesosEnteros(f.cambio_desde_emision)}
                            </span>
                          ) : null}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibles.length === 0 && (
              <div className={styles.vacio}>
                {filas.length === 0
                  ? 'Esta quincena no tiene nada que liquidar todavía.'
                  : 'Ningún recibo coincide con esos filtros.'}
              </div>
            )}
          </div>
        </>
      )}

      {abierto && (
        <AccionesRecibo quincena={quincena} tercero={abierto}
                        onImprimir={() => imprimir([abierto])}
                        onCerrar={() => setAbierto(null)} />
      )}
      {lote && (
        <EmitirLote quincena={quincena} terceros={listos.map(f => f.tercero)}
                    onCerrar={() => setLote(false)} />
      )}
      {saldos && <SaldosIniciales quincena={quincena} onCerrar={() => setSaldos(false)} />}
    </div>
  )
}
