import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  aprobarFactura, detalleRecibo, emitirRecibos, marcarRevision, reabrirRecibo,
  rechazarFactura, registrarFactura, registrarPago,
} from '../services/terceros'
import { comoFecha, comoPesos } from '../formato'
import { EMPRESAS, ESTADOS_RECIBO, estadoDe, nombreQuincena } from '../recibos'
import styles from '../pages/Grilla.module.css'

// Lo que se hace con un recibo, en el orden en que se hace: emitirlo,
// registrar la factura del tercero, aprobarla o rechazarla, y marcar el pago.
//
// Es el mismo diálogo que mover de quincena: los números del recibo arriba,
// para saber siempre de cuál se trata, y abajo sólo lo que corresponde a su
// estado. Un botón que no se puede usar no se muestra.

const EVENTOS = {
  EMITIDO: 'Emitido', REABIERTO: 'Reabierto', FACTURA: 'Factura registrada',
  APROBADA: 'Factura aprobada', RECHAZADA: 'Factura rechazada', PAGO: 'Pago',
  REVISION: 'Revisión',
}

const hoy = () => new Date().toISOString().slice(0, 10)

export default function AccionesRecibo({ quincena, tercero, onImprimir, onCerrar }) {
  const qc = useQueryClient()
  const [empresa, setEmpresa] = useState('')
  const [factura, setFactura] = useState({ numero: '', fecha: hoy(), importe: '' })
  // Uno para rechazar la factura y otro para reabrir o poner en revisión: son
  // decisiones distintas y cada una deja su motivo en la historia.
  const [rechazo, setRechazo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [parcial, setParcial] = useState('')

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const { data: r, isLoading } = useQuery({
    queryKey: ['terceros', 'recibos', 'detalle', quincena, tercero],
    queryFn: () => detalleRecibo(quincena, tercero),
  })

  // La factura se propone por el Total a facturar: es lo que el tercero tiene
  // que haber facturado, y tipearlo de cero invita a copiar mal.
  useEffect(() => {
    if (r && !factura.importe) {
      setFactura(f => ({ ...f, importe: String(r.total_a_facturar) }))
    }
    if (r?.empresa && !empresa) setEmpresa(r.empresa)
  }, [r])   // eslint-disable-line react-hooks/exhaustive-deps

  const hacer = useMutation({
    mutationFn: (fn) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] })
      setMotivo('')
      setRechazo('')
    },
    onError: err => toast.error(err.message),
  })
  const accion = (fn, aviso) => hacer.mutate(async () => {
    const res = await fn()
    if (res?.rechazados?.length) throw new Error(res.rechazados[0].motivo)
    toast.success(aviso)
    return res
  })

  if (isLoading || !r) {
    return (
      <div className={styles.overlay} onMouseDown={onCerrar}>
        <div className={styles.dialogo}>Cargando…</div>
      </div>
    )
  }

  const estado = estadoDe(r)
  const ocupado = hacer.isPending
  const diferencia = r.factura_importe != null
    ? Number(r.factura_importe) - Number(r.total_a_facturar) : 0

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true"
         aria-labelledby="titulo-recibo" onMouseDown={onCerrar}>
      <div className={`${styles.dialogo} ${styles.dialogoAncho}`}
           onMouseDown={e => e.stopPropagation()}>
        <div id="titulo-recibo" className={styles.dialogoTitulo}>
          {tercero} · {nombreQuincena(quincena)}
        </div>

        <div className={styles.dialogoDatos}>
          <span>Estado</span>
          <b>{ESTADOS_RECIBO[estado]?.label}{r.en_revision ? ' · en revisión' : ''}</b>
          {r.empresa && <><span>Factura a</span><b>{r.empresa}</b></>}
          <span>Total a facturar</span><b>{comoPesos(r.total_a_facturar)}</b>
          <span>Seguros</span><b>{comoPesos(r.seguros)}</b>
          <span>Total a pagar</span><b>{comoPesos(r.total_a_pagar)}</b>
          <span>Saldo anterior</span><b>{comoPesos(r.saldo_anterior)}</b>
          <span>Total</span><b>{comoPesos(r.total)}</b>
          {r.factura_numero && (
            <>
              <span>Factura</span>
              <b>
                {r.factura_numero} · {comoPesos(r.factura_importe)}
                {r.factura_coincide === false && (
                  <span className={styles.aviso}> · difiere en {comoPesos(diferencia)}</span>
                )}
              </b>
            </>
          )}
          {r.factura_motivo && <><span>Rechazada por</span><b>{r.factura_motivo}</b></>}
          {r.pago && (
            <>
              <span>Pago</span>
              <b>{r.pago === 'TOTAL' ? 'Entero' : 'En parte'} · {comoPesos(r.pago_importe)}
                 {' '}· {comoFecha(r.pago_fecha)}</b>
            </>
          )}
          {r.en_revision && <><span>En revisión por</span><b>{r.motivo_revision}</b></>}
        </div>

        {/* Sin emitir: se elige a quién le factura y se congela. */}
        {!r.emitido && estado === 'pendientes' && (
          <div className={styles.aviso}>
            Tiene {r.pendientes} línea(s) sin precio: se emite cuando estén resueltas.
          </div>
        )}
        {!r.emitido && estado === 'para_emitir' && (
          <div className={styles.editor}>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Factura a *</span>
              <select className="input" value={empresa} onChange={e => setEmpresa(e.target.value)}>
                <option value="">elegir…</option>
                {EMPRESAS.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </label>
            <button className="btn btn-primary btn-sm" disabled={!empresa || ocupado}
                    onClick={() => accion(() => emitirRecibos(quincena, [{ tercero, empresa }]),
                                          'Emitido')}>
              Emitir
            </button>
          </div>
        )}

        {/* La factura: registrarla, y después aprobarla o rechazarla. */}
        {r.emitido && !r.pago && (!r.factura_estado || r.factura_estado === 'RECHAZADA') && (
          <div className={styles.editor}>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Factura N° *</span>
              <input className="input" style={{ width: 150 }} value={factura.numero}
                     onChange={e => setFactura(f => ({ ...f, numero: e.target.value }))} />
            </label>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Fecha</span>
              <input className="input" type="date" value={factura.fecha}
                     onChange={e => setFactura(f => ({ ...f, fecha: e.target.value }))} />
            </label>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Importe *</span>
              <input className="input" type="number" step="0.01"
                     style={{ width: 140, textAlign: 'right' }} value={factura.importe}
                     onChange={e => setFactura(f => ({ ...f, importe: e.target.value }))} />
            </label>
            <button className="btn btn-primary btn-sm"
                    disabled={!factura.numero.trim() || !factura.importe || ocupado}
                    onClick={() => accion(() => registrarFactura(
                      quincena, tercero, factura.numero.trim(), factura.fecha || null,
                      factura.importe), 'Factura registrada')}>
              Registrar factura
            </button>
          </div>
        )}
        {r.emitido && r.factura_estado === 'RECIBIDA' && (
          <div className={styles.editor}>
            <button className="btn btn-primary btn-sm" disabled={ocupado}
                    onClick={() => accion(() => aprobarFactura(quincena, tercero),
                                          'Factura aprobada')}>
              Aprobar factura
            </button>
            <label className={`${styles.campo} ${styles.campoAncho}`}>
              <span className={styles.campoLabel}>Motivo del rechazo</span>
              <input className="input" value={rechazo} onChange={e => setRechazo(e.target.value)} />
            </label>
            <button className="btn btn-sm" disabled={!rechazo.trim() || ocupado}
                    onClick={() => accion(() => rechazarFactura(quincena, tercero, rechazo.trim()),
                                          'Factura rechazada')}>
              Rechazar
            </button>
          </div>
        )}

        {/* El pago: entero asume todo lo que se le debía; en parte pide el importe. */}
        {r.emitido && !r.pago && (
          <div className={styles.editor}>
            <button className="btn btn-sm" disabled={ocupado}
                    onClick={() => accion(() => registrarPago(quincena, tercero, 'TOTAL', null, hoy()),
                                          'Pago registrado')}>
              Pagado entero
            </button>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Pagado en parte</span>
              <input className="input" type="number" step="0.01" placeholder="importe"
                     style={{ width: 140, textAlign: 'right' }} value={parcial}
                     onChange={e => setParcial(e.target.value)} />
            </label>
            <button className="btn btn-sm" disabled={!Number(parcial) || ocupado}
                    onClick={() => accion(() => registrarPago(quincena, tercero, 'PARCIAL', parcial, hoy()),
                                          'Pago registrado')}>
              Registrar
            </button>
          </div>
        )}

        {/* Revisión y reabrir llevan motivo: quedan en la historia. */}
        {r.emitido && (
          <div className={styles.editor}>
            {!r.en_revision && !r.pago && (
              <label className={`${styles.campo} ${styles.campoAncho}`}>
                <span className={styles.campoLabel}>Motivo (reabrir o poner en revisión)</span>
                <input className="input" value={motivo} onChange={e => setMotivo(e.target.value)} />
              </label>
            )}
            {r.pago && (
              <button className="btn btn-sm" disabled={ocupado}
                      onClick={() => accion(() => registrarPago(quincena, tercero, null),
                                            'Pago sacado')}>
                Sacar el pago
              </button>
            )}
            {r.en_revision ? (
              <button className="btn btn-sm" disabled={ocupado}
                      onClick={() => accion(() => marcarRevision(quincena, tercero, false, null),
                                            'Salió de revisión')}>
                Sacar de revisión
              </button>
            ) : !r.pago && (
              <>
                <button className="btn btn-sm" disabled={!motivo.trim() || ocupado}
                        onClick={() => accion(() => marcarRevision(quincena, tercero, true, motivo.trim()),
                                              'En revisión')}>
                  Poner en revisión
                </button>
                <button className="btn btn-sm" disabled={!motivo.trim() || ocupado}
                        onClick={() => accion(() => reabrirRecibo(quincena, tercero, motivo.trim()),
                                              'Reabierto')}>
                  Reabrir
                </button>
              </>
            )}
          </div>
        )}

        {r.eventos?.length > 0 && (
          <div className={styles.historia}>
            {r.eventos.map((e, i) => (
              <div key={i}>
                <span className={styles.campoDe}>{comoFecha(e.creado_en?.slice(0, 10))}</span>
                {' '}{EVENTOS[e.tipo] ?? e.tipo}{e.motivo ? `: ${e.motivo}` : ''}
              </div>
            ))}
          </div>
        )}

        <div className={styles.dialogoBotones}>
          <button className="btn btn-sm" onClick={onImprimir}>Ver recibo</button>
          <button className="btn btn-sm" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
