import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { elegirEmpresa, listarRecibos } from '../services/terceros'
import { comoEntero, comoPesosEnteros } from '../formato'
import { EMPRESAS, ESTADOS_RECIBO, estadoDe, sinNadaQueHacer } from '../recibos'
import styles from './Recibos.module.css'

// Un renglón por tercero de la quincena: qué hay que hacer con cada recibo.
//
// Se arma como la Quincena: filtros arriba, tarjetas que son atajos al mismo
// filtro, y una sola tabla. El recibo en sí —lo que se imprime o se manda— es
// otra pantalla; ésta es la de trabajo, y se lee por estado: qué tiene líneas
// sin precio, qué falta emitir y qué falta pagar.

const FILTROS = [
  ['tercero', 'Tercero'],
  ['empresa', 'Factura a'],
  ['estado', 'Estado'],
]
const CLAVES = FILTROS.map(([c]) => c)

const COLUMNAS = [
  { clave: 'tercero', label: 'Tercero' },
  { clave: 'empresa', label: 'Factura a' },
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

  const qc = useQueryClient()
  // A quién le factura se elige desde la tabla y queda guardado: no hay que
  // abrir cada recibo, y el borrador ya lo muestra.
  const guardarEmpresa = useMutation({
    mutationFn: ({ tercero, empresa }) => elegirEmpresa(quincena, tercero, empresa),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] }),
    onError: err => toast.error(err.message),
  })

  const { data = [], isLoading } = useQuery({
    queryKey: ['terceros', 'recibos', quincena],
    queryFn: () => listarRecibos(quincena),
    enabled: !!quincena,
  })

  // Una orden repartida tiene varias empresas y varias facturas: en la tabla
  // van juntas, para filtrar, ordenar y exportar como cualquier columna.
  const filas = useMemo(() => data.filter(r => !sinNadaQueHacer(r)).map(r => ({
    ...r, estado: estadoDe(r),
    empresa: (r.facturas ?? []).map(f => f.empresa).join(' + '),
    factura_numero: (r.facturas ?? []).map(f => f.numero).filter(Boolean).join(' · '),
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
    bajarCsv(`ordenes-de-facturacion-${quincena}`, COLUMNAS.map(c => ({
      label: c.label,
      valor: f => (c.pesos ? comoNumeroCsv(f[c.clave])
        : c.clave === 'estado' ? ESTADOS_RECIBO[f.estado]?.label : f[c.clave]),
    })), visibles)
    toast.success(`${comoEntero(visibles.length)} órdenes exportadas`)
  }

  const imprimir = (terceros) => {
    const q = new URLSearchParams({ quincena })
    terceros.forEach(t => q.append('tercero', t))
    window.open(`/terceros/recibo?${q}`, '_blank')
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Órdenes de facturación</div>
        <SelectorQuincena />
        <div className={styles.acciones}>
          <button className="btn btn-sm" onClick={() => setSaldos(true)}>Saldos iniciales</button>
          <button className="btn btn-sm" disabled={!emitidos.length}
                  title="Un PDF por tercero, para mandar por WhatsApp"
                  onClick={() => imprimir(emitidos.map(f => f.tercero))}>
            PDF de emitidas ({comoEntero(emitidos.length)})
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
      {quincena && isLoading && <CargandoContenido texto="Armando las órdenes de facturación…" />}

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
            {Object.entries(ESTADOS_RECIBO).filter(([, e]) => !e.sinTarjeta).map(([clave, e]) => {
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
                            {f.llegadas > 0 && <span className={styles.marca}> · llegó tarde</span>}
                          </td>
                        )
                      }
                      // Emitido, la empresa ya se mandó así: se lee, no se cambia.
                      // Repartida entre varias, se cambia en el diálogo, que
                      // es donde están los importes.
                      if (c.clave === 'empresa' && !f.emitido && f.estado !== 'vacio'
                          && (f.facturas ?? []).length <= 1) {
                        return (
                          <td key={c.clave} onClick={e => e.stopPropagation()}>
                            <select className={`input ${styles.selectEmpresa}`}
                                    value={f.facturas?.[0]?.empresa ?? ''}
                                    disabled={guardarEmpresa.isPending}
                                    onChange={e => guardarEmpresa.mutate(
                                      { tercero: f.tercero, empresa: e.target.value })}
                                    aria-label={`Factura a, ${f.tercero}`}>
                              <option value="">elegir…</option>
                              {EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
                            </select>
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
                  : 'Ninguna orden coincide con esos filtros.'}
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
        <EmitirLote quincena={quincena} ordenes={listos} onCerrar={() => setLote(false)} />
      )}
      {saldos && <SaldosIniciales quincena={quincena} onCerrar={() => setSaldos(false)} />}
    </div>
  )
}
