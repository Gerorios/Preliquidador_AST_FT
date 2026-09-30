import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarCuotas, listarQuincenas, moverDeQuincena, quitarCuotas, repartirEnCuotas,
} from '../services/terceros'
import { resumen } from '../columnasGrilla'
import { comoFecha, comoPesos } from '../formato'
import styles from '../pages/Grilla.module.css'

// En qué quincena se liquida una línea.
//
// Es un diálogo centrado y no una fila que se abre debajo: la tabla es más
// ancha que la pantalla, y abajo el formulario quedaba a la izquierda mientras
// el botón estaba a la derecha, sin ver de qué línea se trataba. Acá la línea
// se repite arriba, así se sabe siempre qué se está moviendo. Es el mismo
// armado que el diálogo de reglas de Preliquidación.
//
// Hay dos respuestas, y la segunda es sólo de los repuestos:
//   - **Entera**, en una quincena. Si es la suya, no pasa nada; si es otra, se
//     mueve y pide motivo, porque el recibo la va a mostrar como un ajuste.
//   - **En cuotas** quincenales iguales, desde una quincena. El motivo es
//     opcional: «cuota 2 de 5» ya se explica sola en el recibo.
//
// El precio no cambia en ninguno de los dos casos: se cobra con el de la
// quincena en que se generó la línea.

// Igual que el backend: hacia abajo al centavo, y la última se lleva el resto.
function repartir(total, cuotas) {
  const centavos = Math.round(Number(total) * 100)
  const base = Math.floor(centavos / cuotas)
  return { base: base / 100, ultima: (centavos - base * (cuotas - 1)) / 100 }
}

export default function EditorDestino({ fila, quincena, onCerrar }) {
  const qc = useQueryClient()
  const esRepuesto = fila.concepto === 'repuestos'
  // La quincena en la que se generó. Una fila movida dice de dónde viene; una
  // que no dice nada es de la que se está mirando.
  const origen = fila.viene_de ?? quincena

  const [modo, setModo] = useState(fila.cuota ? 'cuotas' : 'entera')
  const [destino, setDestino] = useState(quincena)
  const [desde, setDesde] = useState(quincena)
  const [cuotas, setCuotas] = useState('3')
  const [motivo, setMotivo] = useState(fila.motivo ?? '')

  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  const { data: opciones = [] } = useQuery({
    queryKey: ['terceros', 'quincenas', 'adelante'],
    queryFn: () => listarQuincenas(24, 12),
    staleTime: 60 * 60 * 1000,
  })

  // El plan que ya tiene, para arrancar desde ahí y no desde cero.
  const { data: plan = [] } = useQuery({
    queryKey: ['terceros', 'cuotas', fila.id],
    queryFn: () => listarCuotas(fila.id),
    enabled: esRepuesto,
  })
  useEffect(() => {
    if (plan.length) {
      setDesde(plan[0].quincena)
      setCuotas(String(plan.length))
      setMotivo(plan[0].motivo ?? '')
    }
  }, [plan])

  // En una fila de cuota el importe es el de la cuota; el total sale del plan.
  const total = plan.length
    ? plan.reduce((s, c) => s + Number(c.importe), 0)
    : Number(fila.importe ?? 0)

  const guardar = useMutation({
    mutationFn: async () => {
      if (modo === 'cuotas') {
        return repartirEnCuotas(fila.id, desde, Number(cuotas), motivo || null)
      }
      if (plan.length) await quitarCuotas(fila.id)
      if (destino !== quincena || plan.length) {
        return moverDeQuincena(fila.concepto, fila.id, destino, motivo || null)
      }
      return null
    },
    onSuccess: () => {
      toast.success(modo === 'cuotas' ? `Repartido en ${cuotas} cuotas` : 'Listo')
      qc.invalidateQueries({ queryKey: ['terceros'] })
      onCerrar()
    },
    onError: err => toast.error(err.message),
  })

  const vuelveASuQuincena = modo === 'entera' && destino === origen
  const pideMotivo = modo === 'entera' && !vuelveASuQuincena
  const n = Number(cuotas)
  const listo = modo === 'cuotas'
    ? n >= 2 && n <= 24 && total > 0
    : !pideMotivo || motivo.trim() !== ''
  const { base, ultima } = n >= 2 ? repartir(total, n) : { base: 0, ultima: 0 }

  const nombre = (q) => {
    const o = opciones.find(x => x.quincena === q)
    return o ? `${o.etiqueta} — ${o.nombre}` : q
  }
  const alGuardar = () => { if (listo && !guardar.isPending) guardar.mutate() }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true"
         aria-labelledby="titulo-destino" onMouseDown={onCerrar}>
      <div className={styles.dialogo} onMouseDown={e => e.stopPropagation()}>
        <div id="titulo-destino" className={styles.dialogoTitulo}>
          {fila.concepto_label} · {fila.tercero}
        </div>

        <div className={styles.dialogoDatos}>
          {fila.fecha && <><span>Fecha</span><b>{comoFecha(fila.fecha)}</b></>}
          <span>Detalle</span><b>{resumen(fila) || '—'}</b>
          <span>Importe</span>
          <b>{comoPesos(total)}{fila.cuota && <span className={styles.campoDe}> en total</span>}</b>
          <span>Se generó en</span><b>{nombre(origen)}</b>
        </div>

        {esRepuesto && (
          <div className={styles.modos}>
            <button className={`${styles.chip} ${modo === 'entera' ? styles.chipActivo : ''}`}
                    onClick={() => setModo('entera')}>
              Entero
            </button>
            <button className={`${styles.chip} ${modo === 'cuotas' ? styles.chipActivo : ''}`}
                    onClick={() => setModo('cuotas')}>
              En cuotas
            </button>
          </div>
        )}

        <div className={styles.editor}>
          {modo === 'entera' ? (
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Se liquida en</span>
              <select className="input" value={destino} autoFocus
                      onChange={e => setDestino(e.target.value)}>
                {opciones.map(o => (
                  <option key={o.quincena} value={o.quincena}>
                    {nombre(o.quincena)}{o.quincena === origen ? ' (la suya)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Desde</span>
                <select className="input" value={desde} onChange={e => setDesde(e.target.value)}>
                  {opciones.map(o => (
                    <option key={o.quincena} value={o.quincena}>{nombre(o.quincena)}</option>
                  ))}
                </select>
              </label>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Cuotas</span>
                <input className="input" type="number" min="2" max="24" step="1"
                       style={{ width: 70, textAlign: 'right' }}
                       value={cuotas} onChange={e => setCuotas(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && alGuardar()} />
              </label>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Cada una</span>
                <span className={styles.campoValor}>
                  {n >= 2 ? comoPesos(base) : '—'}
                  {n >= 2 && ultima !== base && (
                    <span className={styles.campoDe}> (la última {comoPesos(ultima)})</span>
                  )}
                </span>
              </label>
            </>
          )}
        </div>

        {(pideMotivo || modo === 'cuotas') && (
          <div className={styles.editor}>
            <label className={`${styles.campo} ${styles.campoAncho}`}>
              <span className={styles.campoLabel}>Motivo{pideMotivo ? ' *' : ''}</span>
              <input className="input" value={motivo}
                     onChange={e => setMotivo(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && alGuardar()} />
            </label>
          </div>
        )}

        <div className={styles.dialogoBotones}>
          <button className="btn btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary btn-sm" disabled={!listo || guardar.isPending}
                  onClick={alGuardar}>
            {guardar.isPending ? 'Guardando…'
              : vuelveASuQuincena && (fila.viene_de || plan.length) ? 'Volver a su quincena'
                : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
