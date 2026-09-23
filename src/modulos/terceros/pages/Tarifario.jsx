import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import SelectorQuincena from '../components/SelectorQuincena'
import Seguros from '../components/Seguros'
import useQuincenaStore from '../quincenaStore'
import { TARIFARIOS, tarifarioPorClave } from '../tarifarios'
import {
  listarTarifas, crearTarifa, actualizarTarifa, confirmarTarifa,
  eliminarTarifa, copiarTarifario, obtenerResumenTarifario, listarQuincenas,
} from '../services/terceros'
import { comoPesos, comoEntero } from '../formato'
import styles from './Tarifario.module.css'

// Una sola pantalla para los cinco tarifarios: las columnas salen de
// tarifarios.js, así que agregar una dimensión es tocar un archivo y no cinco
// pantallas iguales.
//
// Una fila resaltada es una tarifa heredada: vino copiada de otra quincena y
// nadie la confirmó. Paga igual — el resaltado existe para no arrastrar un
// precio viejo sin darse cuenta si hubo aumento.

function Nueva({ tarifario, quincena, onListo }) {
  const [datos, setDatos] = useState({})
  const qc = useQueryClient()

  // Tocar un precio recalcula esa parte de la quincena del lado del servidor,
  // así que lo que la grilla tenga en caché quedó viejo.
  const invalidarTodo = () => {
    qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
  }

  const crear = useMutation({
    mutationFn: () => crearTarifa(tarifario.clave, quincena, datos),
    onSuccess: () => {
      toast.success('Tarifa cargada')
      setDatos({})
      invalidarTodo()
      onListo?.()
    },
    onError: err => toast.error(err.message),
  })

  const set = (k, v) => setDatos(d => ({ ...d, [k]: v }))

  return (
    <tr className={styles.nueva}>
      {tarifario.dimensiones.map(d => (
        <td key={d.clave}>
          <input
            className="input"
            placeholder={d.obligatoria ? `${d.label} *` : `${d.label} (cualquiera)`}
            value={datos[d.clave] ?? ''}
            onChange={e => set(d.clave, e.target.value)}
          />
        </td>
      ))}
      {tarifario.valores.map(v => (
        <td key={v.clave}>
          {v.tipo === 'opciones' ? (
            <select className="input" value={datos[v.clave] ?? ''}
                    onChange={e => set(v.clave, e.target.value)}>
              <option value="">{v.requerida ? 'Elegir…' : '—'}</option>
              {v.opciones.map(o => (
                <option key={o} value={o}>{v.etiquetas?.[o] ?? o}</option>
              ))}
            </select>
          ) : (
            <input className="input" type="number" step="0.01" placeholder="0,00"
                   value={datos[v.clave] ?? ''}
                   onChange={e => set(v.clave, e.target.value)} />
          )}
        </td>
      ))}
      <td />
      <td>
        <button className="btn btn-primary btn-sm"
                disabled={crear.isPending}
                onClick={() => crear.mutate()}>
          Agregar
        </button>
      </td>
    </tr>
  )
}

function Fila({ tarifario, fila }) {
  const qc = useQueryClient()
  const [editando, setEditando] = useState(null)
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
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
  const tarifario = tarifarioPorClave(activo)

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

  const sinConfirmar = useMemo(
    () => Object.values(resumen).reduce((n, r) => n + (r.heredadas ?? 0), 0),
    [resumen]
  )

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
                    onClick={() => setActivo(t.clave)}>
              {t.titulo}
              <span className={styles.tabCuenta}>{comoEntero(r.cargadas)}</span>
              {r.heredadas > 0 && <span className={styles.tabPunto} title="Sin confirmar" />}
            </button>
          )
        })}
      </div>

      <p className={styles.ayuda}>{tarifario.ayuda}</p>

      <div className={styles.content}>
        {!quincena && <div className={styles.vacio}>Elegí una quincena para cargar sus tarifas.</div>}
        {quincena && isLoading && activo !== 'seguros' && <CargandoContenido />}
        {/* Los seguros no se tipean: se eligen del padrón del sistema de campo,
            porque son 382 bienes y personas y el nombre tiene que coincidir
            exacto o el seguro no se le imputa a nadie. */}
        {quincena && activo === 'seguros' && <Seguros quincena={quincena} />}
        {quincena && !isLoading && activo !== 'seguros' && (
          <table>
            <thead>
              <tr>
                {tarifario.dimensiones.map(d => <th key={d.clave}>{d.label}</th>)}
                {tarifario.valores.map(v => (
                  <th key={v.clave} style={{ textAlign: v.tipo === 'pesos' ? 'right' : 'left' }}>
                    {v.label}
                  </th>
                ))}
                <th style={{ textAlign: 'center' }}>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <Nueva tarifario={tarifario} quincena={quincena} />
              {filas.map(f => <Fila key={f.id} tarifario={tarifario} fila={f} />)}
            </tbody>
          </table>
        )}
        {quincena && !isLoading && activo !== 'seguros' && filas.length === 0 && (
          <div className={styles.vacio}>
            Esta quincena todavía no tiene tarifas de {tarifario.titulo.toLowerCase()}.
            Cargalas arriba, o copialas de otra quincena.
          </div>
        )}
      </div>

      <p className={styles.nota}>
        Las reglas van de la más general a la más específica. Entre dos que alcanzan al mismo
        hecho gana la que tiene más campos cargados; si empatan, el hecho queda ambiguo y lo
        resolvés vos. Un hecho sin tarifa no entra al recibo: se lista aparte, nunca paga cero
        en silencio.
      </p>
    </div>
  )
}
