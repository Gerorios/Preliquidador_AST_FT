import { Fragment, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  aprobarFactura, detalleRecibo, emitirRecibos, marcarRevision, reabrirRecibo,
  rechazarFactura, registrarFactura, registrarPago, repartirEmpresas,
} from '../services/terceros'
import AjustesRecibo from './AjustesRecibo'
import LlegadasRecibo from './LlegadasRecibo'
import RepartoEmpresas from './RepartoEmpresas'
import { comoFecha, comoPesos } from '../formato'
import { ESTADOS_RECIBO, estadoDe, nombreQuincena } from '../recibos'
import styles from '../pages/Grilla.module.css'

// Lo que se hace con un recibo, en el orden en que se hace: emitirlo,
// registrar la factura del tercero, aprobarla o rechazarla, y marcar el pago.
//
// Es el mismo diálogo que mover de quincena: los números del recibo arriba,
// para saber siempre de cuál se trata, y abajo sólo lo que corresponde a su
// estado. Un botón que no se puede usar no se muestra.

const EVENTOS = {
  EMITIDO: 'Emitida', REABIERTO: 'Reabierta', FACTURA: 'Factura registrada',
  APROBADA: 'Factura aprobada', RECHAZADA: 'Factura rechazada', PAGO: 'Pago',
  REVISION: 'Revisión', AJUSTE: 'Ajuste', DESCARTADA: 'Descartado lo que llegó tarde',
}

const hoy = () => new Date().toISOString().slice(0, 10)

const ESTADO_FACTURA = {
  RECIBIDA: 'por revisar', APROBADA: 'aprobada', RECHAZADA: 'rechazada',
}

// Lo que se sabe de la factura de una empresa, en un renglón.
function resumenFactura(f, repartida) {
  const partes = [f.empresa]
  if (repartida) partes.push(comoPesos(f.importe))
  if (f.numero) {
    partes.push(`N° ${f.numero}${f.fecha ? ` del ${comoFecha(f.fecha)}` : ''}`
      + ` por ${comoPesos(f.importe_factura)}`)
  }
  if (f.estado) partes.push(ESTADO_FACTURA[f.estado] ?? f.estado)
  return partes.join(' · ')
}

// La factura de una empresa: registrarla, y después aprobarla o rechazarla.
// Con la orden repartida hay una por empresa, y cada una sigue su camino.
function FacturaDeEmpresa({ f, pagada, ocupado, onRegistrar, onAprobar, onRechazar }) {
  // Se propone lo que se le factura a esa empresa: es lo que el tercero tiene
  // que haber facturado, y tipearlo de cero invita a copiar mal.
  const [form, setForm] = useState({ numero: '', fecha: hoy(), importe: String(f.importe ?? '') })
  const [rechazo, setRechazo] = useState('')

  if (!pagada && (!f.estado || f.estado === 'RECHAZADA')) {
    return (
      <div className={styles.editor}>
        <span className={styles.campoValor}>{f.empresa}</span>
        <label className={styles.campo}>
          <span className={styles.campoLabel}>Factura N° *</span>
          <input className="input" style={{ width: 150 }} value={form.numero}
                 onChange={e => setForm(x => ({ ...x, numero: e.target.value }))} />
        </label>
        <label className={styles.campo}>
          <span className={styles.campoLabel}>Fecha</span>
          <input className="input" type="date" value={form.fecha}
                 onChange={e => setForm(x => ({ ...x, fecha: e.target.value }))} />
        </label>
        <label className={styles.campo}>
          <span className={styles.campoLabel}>Importe *</span>
          <input className="input" type="number" step="0.01"
                 style={{ width: 140, textAlign: 'right' }} value={form.importe}
                 onChange={e => setForm(x => ({ ...x, importe: e.target.value }))} />
        </label>
        <button className="btn btn-primary btn-sm"
                disabled={!form.numero.trim() || !form.importe || ocupado}
                onClick={() => onRegistrar(form.numero.trim(), form.fecha || null, form.importe)}>
          Registrar factura
        </button>
      </div>
    )
  }
  if (f.estado === 'RECIBIDA') {
    return (
      <div className={styles.editor}>
        <span className={styles.campoValor}>{f.empresa}</span>
        <button className="btn btn-primary btn-sm" disabled={ocupado} onClick={onAprobar}>
          Aprobar factura
        </button>
        <label className={`${styles.campo} ${styles.campoAncho}`}>
          <span className={styles.campoLabel}>Motivo del rechazo</span>
          <input className="input" value={rechazo} onChange={e => setRechazo(e.target.value)} />
        </label>
        <button className="btn btn-sm" disabled={!rechazo.trim() || ocupado}
                onClick={() => onRechazar(rechazo.trim())}>
          Rechazar
        </button>
      </div>
    )
  }
  return null
}

export default function AccionesRecibo({ quincena, tercero, onImprimir, onCerrar }) {
  const qc = useQueryClient()
  // Para reabrir o poner en revisión: cada uno deja su motivo en la historia.
  const [motivo, setMotivo] = useState('')
  const [parcial, setParcial] = useState('')
  // Un ajuste escrito y sin guardar frena la emisión: emitir lo perdería.
  const [ajusteSinGuardar, setAjusteSinGuardar] = useState(false)

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const { data: r, isLoading } = useQuery({
    queryKey: ['terceros', 'recibos', 'detalle', quincena, tercero],
    queryFn: () => detalleRecibo(quincena, tercero),
  })

  const hacer = useMutation({
    mutationFn: (fn) => fn(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] })
      setMotivo('')
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
  const facturas = r.facturas ?? []
  const repartida = facturas.length > 1

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
          {facturas.map(f => (
            <Fragment key={f.empresa}>
              <span>Factura a</span>
              <b>
                {resumenFactura(f, repartida)}
                {f.coincide === false && (
                  <span className={styles.aviso}>
                    {' '}· difiere en {comoPesos(Number(f.importe_factura) - Number(f.importe))}
                  </span>
                )}
                {f.motivo && <span className={styles.aviso}> · {f.motivo}</span>}
              </b>
            </Fragment>
          ))}
          <span>Total a facturar</span><b>{comoPesos(r.total_a_facturar)}</b>
          <span>Seguros</span><b>{comoPesos(r.seguros)}</b>
          <span>Total a pagar</span><b>{comoPesos(r.total_a_pagar)}</b>
          <span>Saldo anterior</span><b>{comoPesos(r.saldo_anterior)}</b>
          <span>Total</span><b>{comoPesos(r.total)}</b>
          {r.pago && (
            <>
              <span>Pago</span>
              <b>{r.pago === 'TOTAL' ? 'Entero' : 'En parte'} · {comoPesos(r.pago_importe)}
                 {' '}· {comoFecha(r.pago_fecha)}</b>
            </>
          )}
          {r.en_revision && <><span>En revisión por</span><b>{r.motivo_revision}</b></>}
        </div>

        {/* Lo que llegó tarde a recibos ya emitidos va primero: es lo que hay
            que resolver antes de emitir éste. */}
        {!r.emitido && (
          <LlegadasRecibo quincena={quincena} tercero={tercero} items={r.llegadas_detalle} />
        )}
        <AjustesRecibo quincena={quincena} tercero={tercero}
                       ajustes={r.ajustes ?? []} emitido={r.emitido}
                       onBorrador={setAjusteSinGuardar} />

        {/* Sin emitir: se elige a quién le factura (queda guardado aunque falten
            precios) y, cuando está todo, se congela. */}
        {!r.emitido && estado === 'pendientes' && (
          <div className={styles.aviso}>
            Tiene {r.pendientes} línea(s) sin precio: se emite cuando estén resueltas.
          </div>
        )}
        {!r.emitido && (estado === 'para_emitir' || estado === 'pendientes') && (
          <RepartoEmpresas
            quincena={quincena} tercero={tercero} facturas={facturas}
            total={r.total_a_facturar} puedeEmitir={estado === 'para_emitir'} ocupado={ocupado}
            frenoEmitir={ajusteSinGuardar
              ? 'Hay un ajuste escrito sin guardar: agregalo o descartalo antes de emitir'
              : null}
            onEmitir={(reparto) => accion(async () => {
              await repartirEmpresas(quincena, tercero, reparto)
              return emitirRecibos(quincena, [{ tercero }])
            }, 'Emitida')} />
        )}

        {/* La factura de cada empresa: registrarla, y después aprobarla o
            rechazarla. */}
        {r.emitido && facturas.map(f => (
          <FacturaDeEmpresa
            key={f.empresa} f={f} pagada={Boolean(r.pago)} ocupado={ocupado}
            onRegistrar={(numero, fecha, importe) => accion(() => registrarFactura(
              quincena, tercero, f.empresa, numero, fecha, importe), 'Factura registrada')}
            onAprobar={() => accion(() => aprobarFactura(quincena, tercero, f.empresa),
                                    'Factura aprobada')}
            onRechazar={(motivoRechazo) => accion(() => rechazarFactura(
              quincena, tercero, f.empresa, motivoRechazo), 'Factura rechazada')} />
        ))}

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
                                              'Reabierta')}>
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
          <button className="btn btn-sm" onClick={onImprimir}>Ver orden</button>
          <button className="btn btn-sm" onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  )
}
