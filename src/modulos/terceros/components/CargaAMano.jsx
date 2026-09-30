import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  borrarLineaFacturada, cargarLineasAMano, listarLineasEstacion,
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

const CAMPOS = [
  ['fecha', 'Fecha *', 'date', 130],
  ['vale', 'Vale', 'text', 90],
  ['patente', 'Patente', 'text', 100],
  ['chofer', 'Chofer', 'text', 170],
  ['litros', 'Litros', 'number', 90],
  ['importe', 'Importe', 'number', 120],
]

export default function CargaAMano({ estacion, quincena }) {
  const [fila, setFila] = useState(VACIA)
  const qc = useQueryClient()

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
            <input className="input" type={tipo} style={{ width: ancho }}
                   step={tipo === 'number' ? '0.01' : undefined}
                   value={fila[clave]}
                   onChange={e => set(clave, e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter' && listo) agregar.mutate() }} />
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
