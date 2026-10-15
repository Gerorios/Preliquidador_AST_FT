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
//
// Arranca con las que ya se eligieron en la tabla o en el recibo: elegirlas
// de nuevo acá sería hacer dos veces lo mismo. Una orden repartida entre
// varias empresas sale con su reparto: los importes se escriben en su diálogo,
// y acá sólo se elige si se emite o no.

const REPARTIDA = 'repartida'

const nombres = (o) => (o.facturas ?? []).map(f => f.empresa).join(' + ')

export default function EmitirLote({ quincena, ordenes, onCerrar }) {
  const qc = useQueryClient()
  const terceros = ordenes.map(o => o.tercero)
  const repartidas = new Set(
    ordenes.filter(o => (o.facturas ?? []).length > 1).map(o => o.tercero))
  const [empresas, setEmpresas] = useState(() => Object.fromEntries(ordenes.map(o => [
    o.tercero, repartidas.has(o.tercero) ? REPARTIDA : (o.facturas?.[0]?.empresa ?? ''),
  ])))
  const etiqueta = Object.fromEntries(ordenes.map(o => [o.tercero, nombres(o)]))
  const [rechazados, setRechazados] = useState([])
  // Los que se acaban de emitir. El diálogo queda abierto con ellos para sacar
  // el PDF de cada uno y mandarlo por WhatsApp (lo pidió el usuario,
  // 2026-10-05). Se abre con un clic y no solo: el navegador frena una ventana
  // que se abre sin que nadie la pida.
  const [emitidos, setEmitidos] = useState([])

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  // El atajo no pisa las repartidas: su reparto se armó a propósito.
  const todos = (empresa) => setEmpresas(e => Object.fromEntries(terceros.map(t => [
    t, repartidas.has(t) && e[t] === REPARTIDA ? REPARTIDA : empresa,
  ])))
  const elegidos = terceros.filter(t => empresas[t])

  const emitir = useMutation({
    mutationFn: () => emitirRecibos(quincena, elegidos.map(t => (
      empresas[t] === REPARTIDA ? { tercero: t } : { tercero: t, empresa: empresas[t] }))),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] })
      if (r.emitidos.length) toast.success(`${comoEntero(r.emitidos.length)} orden(es) emitidas`)
      // Uno que no se pudo no frena al resto: se muestra con el porqué.
      setRechazados(r.rechazados)
      setEmitidos(r.emitidos)
      if (!r.emitidos.length && !r.rechazados.length) onCerrar()
    },
    onError: err => toast.error(err.message),
  })

  const abrirPdfs = () => {
    const q = new URLSearchParams({ quincena })
    emitidos.forEach(t => q.append('tercero', t))
    window.open(`/terceros/recibo?${q}`, '_blank')
  }
  const terminado = emitidos.length > 0

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true"
         aria-labelledby="titulo-lote" onMouseDown={onCerrar}>
      <div className={`${styles.dialogo} ${styles.dialogoAncho}`}
           onMouseDown={e => e.stopPropagation()}>
        <div id="titulo-lote" className={styles.dialogoTitulo}>
          {terminado ? 'Emitidas' : 'Emitir órdenes de facturación'} · {nombreQuincena(quincena)}
        </div>

        {!terminado && (
        <>
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
                {repartidas.has(t)
                  ? <option value={REPARTIDA}>{etiqueta[t]}</option>
                  : EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          ))}
        </div>
        </>
        )}

        {terminado && (
          <div className={styles.listaLote}>
            {emitidos.map(t => (
              <div key={t} className={styles.renglonLote}>
                <span>{t}</span>
                <span>{empresas[t] === REPARTIDA ? etiqueta[t] : empresas[t]}</span>
              </div>
            ))}
          </div>
        )}

        {rechazados.length > 0 && (
          <div className={styles.historia}>
            {rechazados.map(r => (
              <div key={r.tercero} className={styles.aviso}>{r.tercero}: {r.motivo}</div>
            ))}
          </div>
        )}

        <div className={styles.dialogoBotones}>
          {terminado ? (
            <>
              <button className="btn btn-sm" onClick={onCerrar}>Cerrar</button>
              <button className="btn btn-primary btn-sm" onClick={abrirPdfs}
                      title="Un PDF por tercero, para mandar por WhatsApp">
                PDF de las emitidas ({comoEntero(emitidos.length)})
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sm" onClick={onCerrar}>Cancelar</button>
              <button className="btn btn-primary btn-sm"
                      disabled={!elegidos.length || emitir.isPending}
                      onClick={() => emitir.mutate()}>
                {emitir.isPending ? 'Emitiendo…' : `Emitir (${comoEntero(elegidos.length)})`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
