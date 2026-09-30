import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import FiltroMultiple from '../components/FiltroMultiple'
import NuevaTarifa from '../components/NuevaTarifa'
import SelectorQuincena from '../components/SelectorQuincena'
import Seguros from '../components/Seguros'
import SinPrecio from '../components/SinPrecio'
import useQuincenaStore from '../quincenaStore'
import { TARIFARIOS, tarifarioPorClave } from '../tarifarios'
import {
  listarTarifas, actualizarTarifa, confirmarTarifa, confirmarTarifasEnLote,
  eliminarTarifa, copiarTarifario, obtenerResumenTarifario, listarQuincenas,
  listarCombinaciones,
} from '../services/terceros'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import { comoPesos, comoEntero } from '../formato'
import styles from './Tarifario.module.css'

// Una sola pantalla para los cinco tarifarios: las columnas salen de
// tarifarios.js, así que agregar una dimensión es tocar un archivo y no cinco
// pantallas iguales.
//
// Los cinco trabajan igual, y eso no es cosmética: el liquidador entra a uno
// distinto cada día y no tiene por qué volver a aprender dónde está cada cosa.
// Arriba se carga, abajo se filtra, y el listado de lo que falta se abre desde
// una solapa en vez de vivir en un cuadro que estorba cuando no hace falta.
//
// Una fila resaltada es una tarifa heredada: vino copiada de otra quincena y
// nadie la confirmó. Paga igual — el resaltado existe para no arrastrar un
// precio viejo sin darse cuenta si hubo aumento.

function Fila({ tarifario, fila }) {
  const qc = useQueryClient()
  const [editando, setEditando] = useState(null)
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'liquidaciones'] })
  }

  const guardar = useMutation({
    mutationFn: (datos) => actualizarTarifa(tarifario.clave, fila.id, datos),
    onSuccess: () => { toast.success('Tarifa actualizada'); setEditando(null); invalidar() },
    onError: err => toast.error(err.message),
  })
  const confirmar = useMutation({
    mutationFn: () => confirmarTarifa(tarifario.clave, fila.id),
    onSuccess: () => { toast.success('Confirmada'); invalidar() },
    onError: err => toast.error(err.message),
  })
  const borrar = useMutation({
    mutationFn: () => eliminarTarifa(tarifario.clave, fila.id),
    onSuccess: () => { toast.success('Tarifa eliminada'); invalidar() },
    onError: err => toast.error(err.message),
  })

  return (
    <tr className={fila.heredada ? styles.heredada : undefined}>
      {tarifario.dimensiones.map(d => (
        <td key={d.clave}>
          {fila[d.clave] ?? <span className={styles.cualquiera}>cualquiera</span>}
        </td>
      ))}
      {tarifario.valores.map(v => (
        <td key={v.clave} style={{ textAlign: v.tipo === 'pesos' ? 'right' : 'left' }}>
          {v.tipo === 'pesos' && editando !== null ? (
            <input
              className="input" type="number" step="0.01" autoFocus
              style={{ width: 120, textAlign: 'right' }}
              value={editando}
              onChange={e => setEditando(e.target.value)}
              onBlur={() => guardar.mutate({ [v.clave]: editando })}
              onKeyDown={e => {
                if (e.key === 'Enter') guardar.mutate({ [v.clave]: editando })
                if (e.key === 'Escape') setEditando(null)
              }}
            />
          ) : v.tipo === 'pesos' ? (
            <span className={styles.precio}
                  onClick={() => setEditando(String(fila[v.clave] ?? ''))}
                  title="Clic para editar">
              {comoPesos(fila[v.clave])}
            </span>
          ) : (
            v.etiquetas?.[fila[v.clave]] ?? fila[v.clave] ?? '—'
          )}
        </td>
      ))}
      <td style={{ textAlign: 'center' }}>
        {fila.heredada && <span className="badge badge-warn">sin confirmar</span>}
      </td>
      <td className={styles.acciones}>
        {fila.heredada && (
          <button className="btn btn-sm" disabled={confirmar.isPending}
                  onClick={() => confirmar.mutate()}>
            Confirmar
          </button>
        )}
        <button className="btn btn-sm btn-danger" disabled={borrar.isPending}
                onClick={() => borrar.mutate()}>
          Borrar
        </button>
      </td>
    </tr>
  )
}

function Copiar({ quincena }) {
  const qc = useQueryClient()
  const [desde, setDesde] = useState('')
  const { data: quincenas = [] } = useQuery({
    queryKey: ['terceros', 'quincenas'],
    queryFn: () => listarQuincenas(24),
    staleTime: 60 * 60 * 1000,
  })

  const copiar = useMutation({
    mutationFn: () => copiarTarifario(desde, quincena),
    onSuccess: (d) => {
      const copiadas = Object.values(d).reduce((n, c) => n + c.copiadas, 0)
      const estaban = Object.values(d).reduce((n, c) => n + c.ya_estaban, 0)
      toast.success(
        copiadas === 0
          ? 'No había nada nuevo para copiar'
          : `Se copiaron ${comoEntero(copiadas)} tarifa(s)` +
            (estaban ? `, y ${comoEntero(estaban)} ya estaban` : '')
      )
      qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'liquidaciones'] })
    },
    onError: err => toast.error(err.message),
  })

  return (
    <div className={styles.copiar}>
      <span className={styles.copiarTexto}>Copiar tarifas de</span>
      <select className="input" style={{ width: 200 }} value={desde}
              onChange={e => setDesde(e.target.value)}>
        <option value="">Elegir quincena…</option>
        {quincenas.filter(q => q.quincena !== quincena).map(q => (
          <option key={q.quincena} value={q.quincena}>{q.etiqueta} — {q.nombre}</option>
        ))}
      </select>
      <button className="btn btn-sm" disabled={!desde || copiar.isPending}
              onClick={() => copiar.mutate()}>
        Copiar
      </button>
    </div>
  )
}

export default function Tarifario() {
  const quincena = useQuincenaStore(s => s.quincena)
  const [activo, setActivo] = useState(TARIFARIOS[0].clave)
  const [modo, setModo] = useState('cargadas')
  const [filtros, setFiltros] = useState({})
  const qc = useQueryClient()
  const tarifario = tarifarioPorClave(activo)
  const propio = tarifario.propia   // Seguros se dibuja aparte: sale de un padrón

  const { data: resumen = {} } = useQuery({
    queryKey: ['terceros', 'tarifario', 'resumen', quincena],
    queryFn: () => obtenerResumenTarifario(quincena),
    enabled: !!quincena,
  })

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ['terceros', 'tarifario', activo, quincena],
    queryFn: () => listarTarifas(activo, quincena),
    enabled: !!quincena,
  })

  const { data: combinaciones = [] } = useQuery({
    queryKey: ['terceros', 'tarifario', 'combinaciones', activo, quincena],
    queryFn: () => listarCombinaciones(activo, quincena),
    enabled: !!quincena && !propio,
  })

  // Se cuentan líneas y no combinaciones: es lo que queda afuera del recibo.
  const sinPrecio = useMemo(
    () => combinaciones.reduce((n, c) => n + (c.sin_precio > 0 ? c.sin_precio : 0), 0),
    [combinaciones])

  const sinConfirmar = useMemo(
    () => Object.values(resumen).reduce((n, r) => n + (r.heredadas ?? 0), 0),
    [resumen]
  )

  const claves = useMemo(
    () => tarifario.dimensiones.map(d => d.clave), [tarifario])

  const opciones = useMemo(
    () => opcionesCascada(filas, claves, filtros), [filas, claves, filtros])

  const visibles = useMemo(
    () => filas.filter(f => pasaFiltros(f, claves, filtros)), [filas, claves, filtros])

  // Confirmar es decir "este precio lo miré", sin tocarlo. Copiar una quincena
  // trae doscientas reglas heredadas, y confirmarlas de a una es el trabajo que
  // copiar vino a evitar. Va sobre lo filtrado, como todo lo demás.
  const heredadas = visibles.filter(f => f.heredada)

  const confirmar = useMutation({
    mutationFn: () => confirmarTarifasEnLote(activo, heredadas.map(f => f.id)),
    onSuccess: (d) => {
      toast.success(`${comoEntero(d.cargadas)} regla(s) confirmadas`)
      qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    },
    onError: err => toast.error(err.message),
  })

  const elegirTarifario = (clave) => {
    setActivo(clave)
    setFiltros({})
    setModo('cargadas')
  }

  const hayFiltro = Object.values(filtros).some(s => s?.size)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Tarifario</div>
        <SelectorQuincena />
        {quincena && <Copiar quincena={quincena} />}
        {sinConfirmar > 0 && (
          <div className={styles.aviso}>
            {comoEntero(sinConfirmar)} tarifa(s) sin confirmar
          </div>
        )}
      </div>

      <div className={styles.tabs}>
        {TARIFARIOS.map(t => {
          const r = resumen[t.clave] ?? { cargadas: 0, heredadas: 0 }
          return (
            <button key={t.clave}
                    className={`${styles.tab} ${activo === t.clave ? styles.tabActivo : ''}`}
                    onClick={() => elegirTarifario(t.clave)}>
              {t.titulo}
              <span className={styles.tabCuenta}>{comoEntero(r.cargadas)}</span>
              {r.heredadas > 0 && <span className={styles.tabPunto} title="Sin confirmar" />}
            </button>
          )
        })}

        {/* Un solo botón, al costado: abre lo que falta pactar y, apretado de
            nuevo, vuelve a las cargadas. Dos solapas para lo mismo obligaban a
            leer cuál estaba puesta. */}
        {quincena && !propio && (
          <button
            className={`${styles.botonSin} ${modo === 'sin' ? styles.botonSinActivo : ''} ${
              sinPrecio === 0 ? styles.botonSinCero : ''}`}
            onClick={() => setModo(m => (m === 'sin' ? 'cargadas' : 'sin'))}
            title={modo === 'sin' ? 'Volver a las tarifas cargadas' : 'Ver lo que falta pactar'}
          >
            {sinPrecio === 0 ? 'Todo tiene precio' : 'Sin precio'}
            {sinPrecio > 0 && (
              <span className={styles.botonSinCuenta}>{comoEntero(sinPrecio)} líneas</span>
            )}
            {modo === 'sin' && <span aria-hidden="true">✕</span>}
          </button>
        )}
      </div>

      <div className={styles.content}>
        {!quincena && <div className={styles.vacio}>Elegí una quincena para cargar sus tarifas.</div>}
        {quincena && propio && <Seguros quincena={quincena} />}

        {quincena && !propio && (
          <>
            {modo === 'sin' && (
              <SinPrecio tipo={activo} tarifario={tarifario} quincena={quincena}
                         combinaciones={combinaciones}
                         onVolver={() => setModo('cargadas')} />
            )}

            {modo === 'cargadas' && (
              <>
                <NuevaTarifa tipo={activo} tarifario={tarifario} quincena={quincena}
                             combinaciones={combinaciones} />

                {isLoading && <CargandoContenido />}

                {!isLoading && filas.length === 0 && (
                  <div className={styles.vacio}>
                    Esta quincena todavía no tiene tarifas de {tarifario.titulo.toLowerCase()}.
                    Cargalas arriba, copialas de otra quincena, o mirá qué falta en «Sin precio».
                  </div>
                )}

                {!isLoading && filas.length > 0 && (
                  <div className={styles.tabla}>
                    <div className={styles.barraFiltros}>
                      <span className={styles.barraTitulo}>Filtrar esta tabla</span>
                      {tarifario.dimensiones.filter(d => opciones[d.clave]).map(d => (
                        <FiltroMultiple
                          key={d.clave} label={d.label} valores={opciones[d.clave]}
                          seleccion={filtros[d.clave] ?? new Set()}
                          onCambiar={sel => setFiltros(f => ({ ...f, [d.clave]: sel }))}
                        />
                      ))}
                      {hayFiltro && (
                        <button className={styles.limpiar} onClick={() => setFiltros({})}>
                          Limpiar filtros
                        </button>
                      )}
                      {heredadas.length > 0 && (
                        <button className="btn btn-sm" disabled={confirmar.isPending}
                                onClick={() => confirmar.mutate()}
                                title="Les saca la marca de heredadas sin tocarles el precio">
                          {confirmar.isPending
                            ? 'Confirmando…'
                            : `Confirmar (${comoEntero(heredadas.length)})`}
                        </button>
                      )}
                      <span className={styles.cuentaFiltro}>
                        {visibles.length === filas.length
                          ? `${comoEntero(filas.length)} reglas`
                          : `${comoEntero(visibles.length)} de ${comoEntero(filas.length)} reglas`}
                      </span>
                    </div>

                  <table>
                    <thead>
                      <tr>
                        {tarifario.dimensiones.map(d => <th key={d.clave}>{d.label}</th>)}
                        {tarifario.valores.map(v => (
                          <th key={v.clave}
                              style={{ textAlign: v.tipo === 'pesos' ? 'right' : 'left' }}>
                            {v.label}
                          </th>
                        ))}
                        {/* No es el estado de la grilla: acá dice si la regla
                            está confirmada o vino copiada de otra quincena. Se
                            llamaban las dos "Estado" y no tienen que ver. */}
                        <th style={{ textAlign: 'center' }}>Confirmada</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map(f => <Fila key={f.id} tarifario={tarifario} fila={f} />)}
                    </tbody>
                  </table>
                  {visibles.length === 0 && (
                    <div className={styles.vacio}>Ninguna tarifa coincide con esos filtros.</div>
                  )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

    </div>
  )
}
