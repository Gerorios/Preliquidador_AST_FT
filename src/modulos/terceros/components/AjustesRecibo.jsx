import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  borrarAjuste, crearAjuste, editarAjuste, listarQuincenas,
} from '../services/terceros'
import { comoPesos } from '../formato'
import { AJUSTE_CONCEPTOS, nombreQuincena } from '../recibos'
import styles from './AjustesRecibo.module.css'

// Los ajustes a mano de un recibo abierto: una corrección con signo, de un
// concepto y con su motivo, que entra al Total a facturar.
//
// El signo se elige con dos chips y el importe se escribe sin signo: un «−»
// tipeado de más o de menos da vuelta lo que se le paga al tercero, y en una
// lista de importes no se ve.
//
// Con el recibo emitido sólo se muestran: lo emitido es una foto, y los
// ajustes nuevos van en el recibo abierto.

const VACIO = { concepto: '', aFavor: true, importe: '', motivo: '', quincena_origen: '' }

// `onBorrador` avisa si hay un ajuste escrito y sin guardar: quien emite tiene
// que saberlo, porque emitir con uno a medio cargar lo pierde sin aviso.
export default function AjustesRecibo({ quincena, tercero, ajustes, emitido, onBorrador }) {
  const qc = useQueryClient()
  const [form, setForm] = useState(VACIO)
  const [editando, setEditando] = useState(null)

  const { data: opciones = [] } = useQuery({
    queryKey: ['terceros', 'quincenas'],
    queryFn: () => listarQuincenas(24),
    staleTime: 60 * 60 * 1000,
  })
  const anteriores = opciones.filter(o => o.quincena < quincena)

  // Lo que falta para poder guardar, dicho en el botón: un botón apagado que
  // no dice por qué parece que no anda.
  const faltan = [
    !form.concepto && 'el concepto',
    !(Number(form.importe) > 0) && 'el importe',
    !form.motivo.trim() && 'el motivo',
  ].filter(Boolean)
  const listo = faltan.length === 0
  const importe = () => (form.aFavor ? 1 : -1) * Number(form.importe)

  const escrito = Boolean(form.concepto || form.importe || form.motivo.trim())
  useEffect(() => { onBorrador?.(escrito) }, [escrito, onBorrador])

  // Un «−» tipeado en el importe no se pierde: pasa a «descuenta».
  const cambiarImporte = (valor) => {
    const negativo = valor.trim().startsWith('-')
    setForm(f => ({ ...f, importe: valor.replace('-', ''),
                    aFavor: negativo ? false : f.aFavor }))
  }

  const hecho = (texto) => {
    toast.success(texto)
    setForm(VACIO)
    setEditando(null)
    qc.invalidateQueries({ queryKey: ['terceros'] })
  }

  const guardar = useMutation({
    mutationFn: () => {
      const origen = form.quincena_origen || null
      return editando
        ? editarAjuste(editando, form.concepto, importe(), form.motivo.trim(), origen)
        : crearAjuste(quincena, tercero, form.concepto, importe(), form.motivo.trim(), origen)
    },
    onSuccess: () => hecho(editando ? 'Ajuste corregido' : 'Ajuste cargado'),
    onError: err => toast.error(err.message),
  })

  const borrar = useMutation({
    mutationFn: (id) => borrarAjuste(id),
    onSuccess: () => hecho('Ajuste borrado'),
    onError: err => toast.error(err.message),
  })

  // Tocar uno lo trae al formulario para corregirlo.
  const corregir = (a) => {
    setEditando(a.id)
    setForm({
      concepto: a.concepto, aFavor: Number(a.importe) >= 0,
      importe: String(Math.abs(Number(a.importe))), motivo: a.motivo,
      quincena_origen: a.quincena_origen ?? '',
    })
  }

  if (emitido && !ajustes.length) return null

  return (
    <div className={styles.seccion}>
      <div className={styles.titulo}>Ajustes</div>

      {ajustes.map(a => (
        <div key={a.id} className={`${styles.renglon} ${editando === a.id ? styles.renglonActivo : ''}`}>
          <button className={styles.renglonCuerpo} disabled={emitido}
                  onClick={() => corregir(a)} title={emitido ? undefined : 'Corregir'}>
            <span className={styles.concepto}>{AJUSTE_CONCEPTOS[a.concepto] ?? a.concepto}</span>
            <span className={styles.motivo}>
              {a.motivo}
              {a.quincena_origen && ` · de la ${nombreQuincena(a.quincena_origen)}`}
            </span>
            <span className={Number(a.importe) < 0 ? styles.resta : styles.suma}>
              {Number(a.importe) < 0 ? '−' : ''}{comoPesos(Math.abs(Number(a.importe)))}
            </span>
          </button>
          {!emitido && (
            <button className={styles.quitar} disabled={borrar.isPending}
                    onClick={() => borrar.mutate(a.id)} title="Borrar el ajuste">
              Borrar
            </button>
          )}
        </div>
      ))}

      {!emitido && (
        <div className={styles.form}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Concepto *</span>
            <select className="input" value={form.concepto}
                    onChange={e => setForm(f => ({ ...f, concepto: e.target.value }))}>
              <option value="">elegir…</option>
              {Object.entries(AJUSTE_CONCEPTOS).map(([clave, label]) => (
                <option key={clave} value={clave}>{label}</option>
              ))}
            </select>
          </label>
          <div className={styles.campo}>
            <span className={styles.campoLabel}>Se le…</span>
            <div className={styles.chips}>
              <button className={`${styles.chip} ${form.aFavor ? styles.chipActivo : ''}`}
                      onClick={() => setForm(f => ({ ...f, aFavor: true }))}>
                paga
              </button>
              <button className={`${styles.chip} ${!form.aFavor ? styles.chipActivo : ''}`}
                      onClick={() => setForm(f => ({ ...f, aFavor: false }))}>
                descuenta
              </button>
            </div>
          </div>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Importe *</span>
            <input className="input" type="number" step="0.01"
                   style={{ width: 130, textAlign: 'right' }} value={form.importe}
                   onChange={e => cambiarImporte(e.target.value)} />
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>De la quincena</span>
            <select className="input" value={form.quincena_origen}
                    onChange={e => setForm(f => ({ ...f, quincena_origen: e.target.value }))}>
              <option value="">—</option>
              {anteriores.map(o => (
                <option key={o.quincena} value={o.quincena}>{o.etiqueta} — {o.nombre}</option>
              ))}
            </select>
          </label>
          <label className={`${styles.campo} ${styles.campoAncho}`}>
            <span className={styles.campoLabel}>Motivo *</span>
            <input className="input" value={form.motivo}
                   onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                   onKeyDown={e => { if (e.key === 'Enter' && listo) guardar.mutate() }} />
          </label>
          <button className="btn btn-primary btn-sm" disabled={!listo || guardar.isPending}
                  title={listo ? undefined : `Falta ${faltan.join(', ')}`}
                  onClick={() => guardar.mutate()}>
            {editando ? 'Guardar cambios' : 'Agregar ajuste'}
          </button>
          {escrito && (
            <button className="btn btn-sm" onClick={() => { setEditando(null); setForm(VACIO) }}>
              Descartar
            </button>
          )}

        </div>
      )}
    </div>
  )
}
