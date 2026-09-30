import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  borrarLineaFacturada, cargarLineasAMano, listarBienes, listarLineasEstacion,
} from '../services/terceros'
import { comoEntero, comoFecha, comoNumero } from '../formato'
import styles from '../pages/Estaciones.module.css'

// Los remitos de la estación que no manda archivo: llegan por foto y se tipean.
//
// Se suma, no se reemplaza. Van llegando de a poco, y borrar lo anterior en
// cada carga sería perder lo que alguien acaba de escribir.
//
// La fecha es obligatoria porque es lo que decide en qué quincena entra. Las
// otras no: un remito puede venir sin el nombre del chofer y lo mismo hay que
// poder cargarlo.

const VACIA = { fecha: '', vale: '', litros: '', importe: '', patente: '', chofer: '' }

// Patente y chofer se eligen del padrón del sistema de campo, no se tipean: la
// patente es lo que cruza el remito con la carga de combustible, y una tipeada
// con un espacio de más ya no cruza con nada.
const CAMPOS = [
  ['fecha', 'Fecha *', 'date', 130],
  ['vale', 'Vale', 'text', 90],
  ['patente', 'Patente', 'padron', 210],
  ['chofer', 'Chofer', 'padron', 210],
  ['litros', 'Litros', 'number', 90],
  ['importe', 'Importe', 'number', 120],
]

const porNombre = (a, b) => a.localeCompare(b, 'es')

export default function CargaAMano({ estacion, quincena }) {
  const [fila, setFila] = useState(VACIA)
  const qc = useQueryClient()

  const { data: padron = [], isError: sinPadron } = useQuery({
    queryKey: ['terceros', 'bienes'],
    queryFn: listarBienes,
    staleTime: 60 * 60 * 1000,   // es un padrón, no cambia dentro de una sesión
  })

  // Una patente por opción, con su dueño al lado para reconocerla. Si figura en
  // dos fichas, se ofrece una sola vez con los dos dueños: elegirla es lo mismo.
  const patentes = useMemo(() => {
    const duenos = new Map()
    for (const b of padron) {
      if (!b.patente || b.origen === 'chofer') continue
      if (!duenos.has(b.patente)) duenos.set(b.patente, new Set())
      if (b.tercero) duenos.get(b.patente).add(b.tercero)
    }
    return [...duenos.entries()]
      .map(([patente, ts]) => ({ patente, duenos: [...ts].sort(porNombre) }))
      .sort((a, b) => porNombre(a.patente, b.patente))
  }, [padron])

  // Los choferes del dueño de la patente elegida van primero: casi siempre
  // maneja uno de los suyos, pero no siempre, así que los demás siguen a mano.
  const choferes = useMemo(() => {
    const duenos = new Set(patentes.find(p => p.patente === fila.patente)?.duenos ?? [])
    const suyos = new Set(), otros = new Set()
    for (const b of padron) {
      if (b.origen !== 'chofer' || !b.nombre) continue
      ;(duenos.has(b.tercero) ? suyos : otros).add(b.nombre)
    }
    for (const n of suyos) otros.delete(n)
    return { suyos: [...suyos].sort(porNombre), otros: [...otros].sort(porNombre),
             dueno: [...duenos].join(' / ') }
  }, [padron, patentes, fila.patente])

  const { data: lineas = [] } = useQuery({
    queryKey: ['terceros', 'estaciones', 'lineas', estacion.id, quincena],
    queryFn: () => listarLineasEstacion(estacion.id, quincena),
    enabled: !!quincena,
  })

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['terceros', 'estaciones'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
  }

  const agregar = useMutation({
    mutationFn: () => cargarLineasAMano(estacion.id, [{
      ...fila,
      litros: fila.litros === '' ? null : fila.litros,
      importe: fila.importe === '' ? null : fila.importe,
    }]),
    onSuccess: () => { toast.success('Remito cargado'); setFila(VACIA); invalidar() },
    onError: err => toast.error(err.message),
  })

  const borrar = useMutation({
    mutationFn: (id) => borrarLineaFacturada(id),
    onSuccess: () => { toast.success('Línea borrada'); invalidar() },
    onError: err => toast.error(err.message),
  })

  const set = (k, v) => setFila(f => ({ ...f, [k]: v }))
  const listo = !!fila.fecha

  return (
    <div className={styles.aMano}>
      <div className={styles.aManoTitulo}>
        Remitos de {estacion.nombre}
        <span className={styles.aManoAyuda}>
          Llegan por foto y se tipean. Se suman: cargá de a uno a medida que llegan.
        </span>
      </div>

      <div className={styles.aManoForm}>
        {CAMPOS.map(([clave, label, tipo, ancho]) => (
          <label key={clave} className={styles.campo}>
            <span className={styles.campoLabel}>{label}</span>
            {/* Sin padrón (el sistema de campo no respondió) se tipea: frenar la
                carga del remito por eso sería peor que un dato a corregir. */}
            {tipo === 'padron' && !sinPadron ? (
              <select className="input" style={{ width: ancho }}
                      value={fila[clave]}
                      onChange={e => set(clave, e.target.value)}>
                <option value="">— sin dato —</option>
                {clave === 'patente' && patentes.map(p => (
                  <option key={p.patente} value={p.patente}>
                    {p.patente}{p.duenos.length ? ` · ${p.duenos.join(' / ')}` : ''}
                  </option>
                ))}
                {clave === 'chofer' && choferes.suyos.length > 0 && (
                  <optgroup label={`Choferes de ${choferes.dueno}`}>
                    {choferes.suyos.map(n => <option key={n} value={n}>{n}</option>)}
                  </optgroup>
                )}
                {clave === 'chofer' && (choferes.suyos.length > 0 ? (
                  <optgroup label="Otros choferes">
                    {choferes.otros.map(n => <option key={n} value={n}>{n}</option>)}
                  </optgroup>
                ) : choferes.otros.map(n => <option key={n} value={n}>{n}</option>))}
              </select>
            ) : (
              <input className="input" type={tipo === 'padron' ? 'text' : tipo}
                     style={{ width: ancho }}
                     step={tipo === 'number' ? '0.01' : undefined}
                     value={fila[clave]}
                     onChange={e => set(clave, e.target.value)}
                     onKeyDown={e => { if (e.key === 'Enter' && listo) agregar.mutate() }} />
            )}
          </label>
        ))}
        <button className="btn btn-primary btn-sm"
                disabled={!listo || agregar.isPending}
                onClick={() => agregar.mutate()}>
          {agregar.isPending ? 'Cargando…' : 'Agregar'}
        </button>
      </div>

      {lineas.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Fecha</th><th>Vale</th><th>Patente</th><th>Chofer</th>
              <th style={{ textAlign: 'right' }}>Litros</th>
              <th style={{ textAlign: 'right' }}>Importe</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lineas.map(l => (
              <tr key={l.id}>
                <td>{comoFecha(l.fecha)}</td>
                <td>{l.vale ?? <span className={styles.gris}>sin vale</span>}</td>
                <td>{l.patente}</td>
                <td>{l.chofer}</td>
                <td style={{ textAlign: 'right' }}>{comoNumero(l.litros)}</td>
                <td style={{ textAlign: 'right' }}>{comoNumero(l.importe)}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-sm btn-danger"
                          disabled={borrar.isPending}
                          onClick={() => borrar.mutate(l.id)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {lineas.length === 0 && (
        <div className={styles.aManoVacio}>
          Todavía no se cargó ningún remito de esta quincena.
        </div>
      )}

      {lineas.length > 0 && (
        <div className={styles.aManoPie}>
          {comoEntero(lineas.length)} remito(s) cargados
        </div>
      )}
    </div>
  )
}
