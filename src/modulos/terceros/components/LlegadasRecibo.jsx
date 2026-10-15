import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { resumen } from '../columnasGrilla'
import { crearAjuste, descartarLlegada, moverDeQuincena } from '../services/terceros'
import { comoFecha, comoPesos } from '../formato'
import { AJUSTE_CONCEPTOS, nombreQuincena } from '../recibos'
import styles from './AjustesRecibo.module.css'

// Lo que cambió en un recibo ya emitido después de emitirlo, propuesto en el
// recibo abierto. El sistema propone y quien liquida decide (plan, 3.3):
//
//   - lo que **llegó después** se suma a este recibo, al precio de su quincena;
//   - lo que **ya no está** o **cambió el importe**, un ajuste por la diferencia;
//   - y cualquiera se puede descartar, con motivo.
//
// El ajuste y el descarte se completan ahí mismo, en el renglón: con el
// importe y el motivo ya escritos, para corregir antes de guardar.

const TIPOS = {
  llego: 'Llegó después',
  desaparecio: 'Ya no está',
  cambio: 'Cambió el importe',
}

const motivoDe = (i) => {
  const q = nombreQuincena(i.quincena_origen)
  if (i.tipo === 'llego') return `Llegó después de emitir la ${q}`
  if (i.tipo === 'desaparecio') return `Ya no está en el origen; se liquidó en la ${q}`
  return `Cambió el importe después de emitir la ${q}`
}

const signado = (v) => `${Number(v) < 0 ? '−' : ''}${comoPesos(Math.abs(Number(v)))}`

function Item({ item, quincena, tercero }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(null)   // 'ajuste' | 'descarte'
  const [importe, setImporte] = useState(String(item.diferencia))
  const [motivo, setMotivo] = useState('')

  const hecho = (texto) => {
    toast.success(texto)
    setAbierto(null)
    qc.invalidateQueries({ queryKey: ['terceros'] })
  }
  const accion = useMutation({
    mutationFn: (fn) => fn(),
    onError: err => toast.error(err.message),
  })
  const hacer = (fn, texto) => accion.mutate(fn, { onSuccess: () => hecho(texto) })

  const abrir = (que) => {
    setAbierto(a => (a === que ? null : que))
    setMotivo(que === 'ajuste' ? motivoDe(item) : '')
    setImporte(String(item.diferencia))
  }

  const concepto = AJUSTE_CONCEPTOS[item.concepto] ? item.concepto : 'otro'
  const l = item.linea

  return (
    <div className={styles.item}>
      <div className={styles.itemFila}>
        <span className={styles.tipo}>{TIPOS[item.tipo] ?? item.tipo}</span>
        <span className={styles.motivo}>
          {comoFecha(l.fecha)} · {item.concepto_label} · {resumen(l) || l.motivo || ''}
          {' '}· de la {nombreQuincena(item.quincena_origen)}
        </span>
        <span className={Number(item.diferencia) < 0 ? styles.resta : styles.suma}>
          {signado(item.diferencia)}
        </span>
      </div>
      <div className={styles.itemAcciones}>
        {item.propuesta === 'mover' ? (
          <button className="btn btn-primary btn-sm" disabled={accion.isPending}
                  onClick={() => hacer(() => moverDeQuincena(item.concepto, item.id, quincena,
                                                              motivoDe(item)),
                                       'Sumado a esta orden')}>
            Sumar a esta orden
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={() => abrir('ajuste')}>
            Cargar ajuste
          </button>
        )}
        <button className="btn btn-sm" onClick={() => abrir('descarte')}>Descartar</button>
      </div>

      {abierto && (
        <div className={styles.form}>
          {abierto === 'ajuste' && (
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Importe, con signo</span>
              <input className="input" type="number" step="0.01"
                     style={{ width: 130, textAlign: 'right' }} value={importe}
                     onChange={e => setImporte(e.target.value)} />
            </label>
          )}
          <label className={`${styles.campo} ${styles.campoAncho}`}>
            <span className={styles.campoLabel}>Motivo *</span>
            <input className="input" value={motivo} autoFocus
                   onChange={e => setMotivo(e.target.value)} />
          </label>
          {abierto === 'ajuste' ? (
            <button className="btn btn-primary btn-sm"
                    disabled={!motivo.trim() || !Number(importe) || accion.isPending}
                    onClick={() => hacer(() => crearAjuste(
                      quincena, tercero, concepto, Number(importe), motivo.trim(),
                      item.quincena_origen, item.clave), 'Ajuste cargado')}>
              Guardar ajuste
            </button>
          ) : (
            <button className="btn btn-sm" disabled={!motivo.trim() || accion.isPending}
                    onClick={() => hacer(() => descartarLlegada(
                      item.quincena_origen, tercero, item.clave, motivo.trim()), 'Descartado')}>
              Descartar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function LlegadasRecibo({ quincena, tercero, items }) {
  if (!items?.length) return null
  return (
    <div className={`${styles.seccion} ${styles.seccionAviso}`}>
      <div className={styles.titulo}>Llegó después de emitir</div>
      {items.map(i => (
        <Item key={`${i.quincena_origen}-${i.clave}`} item={i}
              quincena={quincena} tercero={tercero} />
      ))}
    </div>
  )
}
