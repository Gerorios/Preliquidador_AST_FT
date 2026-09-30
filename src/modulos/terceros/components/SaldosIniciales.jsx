import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  cargarSaldoInicial, listarQuincenas, listarRecibos, listarSaldosIniciales,
} from '../services/terceros'
import { comoPesos } from '../formato'
import { nombreQuincena } from '../recibos'
import styles from '../pages/Grilla.module.css'

// Con qué saldo arranca cada tercero en el módulo. Se carga una vez: el que
// tiene en el Excel a la quincena de corte. Después el módulo lo arrastra.
//
// El tercero se elige de la lista y no se tipea: tiene que coincidir exacto con
// el nombre del sistema de campo, o el saldo no se le suma a nadie.
//
// Positivo, la empresa le debe; negativo, el tercero le debe.

export default function SaldosIniciales({ quincena, onCerrar }) {
  const qc = useQueryClient()
  const [fila, setFila] = useState({ tercero: '', quincena, importe: '', motivo: '' })

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const { data: saldos = [] } = useQuery({
    queryKey: ['terceros', 'saldos-iniciales'],
    queryFn: listarSaldosIniciales,
  })
  const { data: recibos = [] } = useQuery({
    queryKey: ['terceros', 'recibos', quincena],
    queryFn: () => listarRecibos(quincena),
  })
  const { data: quincenas = [] } = useQuery({
    queryKey: ['terceros', 'quincenas', 'adelante'],
    queryFn: () => listarQuincenas(24, 12),
    staleTime: 60 * 60 * 1000,
  })

  const terceros = useMemo(() => [...new Set([
    ...recibos.map(r => r.tercero), ...saldos.map(s => s.tercero),
  ])].sort((a, b) => a.localeCompare(b, 'es')), [recibos, saldos])

  const guardar = useMutation({
    mutationFn: () => cargarSaldoInicial(fila.tercero, fila.quincena, fila.importe,
                                         fila.motivo || null),
    onSuccess: () => {
      toast.success('Saldo inicial guardado')
      qc.invalidateQueries({ queryKey: ['terceros', 'saldos-iniciales'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] })
      setFila({ tercero: '', quincena, importe: '', motivo: '' })
    },
    onError: err => toast.error(err.message),
  })

  // Tocar uno de la lista lo trae al formulario para corregirlo.
  const editar = (s) => setFila({ tercero: s.tercero, quincena: s.quincena,
                                  importe: String(s.importe), motivo: s.motivo ?? '' })

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true"
         aria-labelledby="titulo-saldos" onMouseDown={onCerrar}>
      <div className={`${styles.dialogo} ${styles.dialogoAncho}`}
           onMouseDown={e => e.stopPropagation()}>
        <div id="titulo-saldos" className={styles.dialogoTitulo}>Saldos iniciales</div>

        <div className={styles.editor}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Tercero *</span>
            <select className="input" value={fila.tercero}
                    onChange={e => setFila(f => ({ ...f, tercero: e.target.value }))}>
              <option value="">elegir…</option>
              {terceros.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Desde *</span>
            <select className="input" value={fila.quincena}
                    onChange={e => setFila(f => ({ ...f, quincena: e.target.value }))}>
              {quincenas.map(q => (
                <option key={q.quincena} value={q.quincena}>{q.etiqueta} — {q.nombre}</option>
              ))}
            </select>
          </label>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Saldo *</span>
            <input className="input" type="number" step="0.01"
                   style={{ width: 140, textAlign: 'right' }} value={fila.importe}
                   onChange={e => setFila(f => ({ ...f, importe: e.target.value }))} />
          </label>
          <label className={`${styles.campo} ${styles.campoAncho}`}>
            <span className={styles.campoLabel}>Motivo</span>
            <input className="input" value={fila.motivo}
                   onChange={e => setFila(f => ({ ...f, motivo: e.target.value }))} />
          </label>
          <button className="btn btn-primary btn-sm"
                  disabled={!fila.tercero || fila.importe === '' || guardar.isPending}
                  onClick={() => guardar.mutate()}>
            Guardar
          </button>
        </div>

        {saldos.length > 0 && (
          <div className={styles.listaLote}>
            {saldos.map(s => (
              <div key={s.tercero} className={`${styles.renglonLote} ${styles.renglonEditable}`}
                   onClick={() => editar(s)} title="Tocar para corregirlo">
                <span>{s.tercero}</span>
                <span className={styles.campoDe}>desde {nombreQuincena(s.quincena)}</span>
                <b>{comoPesos(s.importe)}</b>
              </div>
            ))}
          </div>
        )}

        <div className={styles.dialogoBotones}>
          <button className="btn btn-sm" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
