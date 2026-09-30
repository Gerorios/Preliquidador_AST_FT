import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { emitirRecibos } from '../services/terceros'
import { comoEntero } from '../formato'
import { EMPRESAS, nombreQuincena } from '../recibos'
import styles from '../pages/Grilla.module.css'

// Emitir los recibos listos de una quincena de una vez.
//
// La empresa se elige por tercero y no una para todos, porque cada uno le
// factura a la que corresponda esa quincena. El selector de arriba es sólo un
// atajo para cargarla en todos y después cambiar las que difieren.

export default function EmitirLote({ quincena, terceros, onCerrar }) {
  const qc = useQueryClient()
  const [empresas, setEmpresas] = useState({})
  const [rechazados, setRechazados] = useState([])

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const todos = (empresa) => setEmpresas(Object.fromEntries(terceros.map(t => [t, empresa])))
  const elegidos = terceros.filter(t => empresas[t])

  const emitir = useMutation({
    mutationFn: () => emitirRecibos(quincena, elegidos.map(t => ({ tercero: t, empresa: empresas[t] }))),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] })
      if (r.emitidos.length) toast.success(`${comoEntero(r.emitidos.length)} recibo(s) emitidos`)
      // Uno que no se pudo no frena al resto: se muestra con el porqué.
      if (r.rechazados.length) setRechazados(r.rechazados)
      else onCerrar()
    },
    onError: err => toast.error(err.message),
  })

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true"
         aria-labelledby="titulo-lote" onMouseDown={onCerrar}>
      <div className={`${styles.dialogo} ${styles.dialogoAncho}`}
           onMouseDown={e => e.stopPropagation()}>
        <div id="titulo-lote" className={styles.dialogoTitulo}>
          Emitir recibos · {nombreQuincena(quincena)}
        </div>

        <div className={styles.editor}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Factura a, para todos</span>
            <select className="input" defaultValue="" onChange={e => todos(e.target.value)}>
              <option value="">elegir…</option>
              {EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.listaLote}>
          {terceros.map(t => (
            <div key={t} className={styles.renglonLote}>
              <span>{t}</span>
              <select className="input" value={empresas[t] ?? ''}
                      onChange={e => setEmpresas(x => ({ ...x, [t]: e.target.value }))}>
                <option value="">no emitir</option>
                {EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          ))}
        </div>

        {rechazados.length > 0 && (
          <div className={styles.historia}>
            {rechazados.map(r => (
              <div key={r.tercero} className={styles.aviso}>{r.tercero}: {r.motivo}</div>
            ))}
          </div>
        )}

        <div className={styles.dialogoBotones}>
          <button className="btn btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm"
                  disabled={!elegidos.length || emitir.isPending}
                  onClick={() => emitir.mutate()}>
            {emitir.isPending ? 'Emitiendo…' : `Emitir (${comoEntero(elegidos.length)})`}
          </button>
        </div>
      </div>
    </div>
  )
}
