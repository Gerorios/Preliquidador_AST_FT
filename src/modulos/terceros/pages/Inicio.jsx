import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import CargandoOverlay from '../../../core/ui/CargandoOverlay'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { listarLiquidaciones, generarLiquidacion } from '../services/terceros'
import { CONJUNTOS } from '../conjuntos'
import { comoEntero, comoPesosEnteros } from '../formato'
import { PREFIJO } from '../rutas'
import styles from './Inicio.module.css'

// El Inicio del módulo es el tablero de quincenas, como el de Preliquidación:
// se ve lo que ya se generó y se genera lo que falta.
//
// Generar va a las cinco fuentes y guarda. No congela nada — se puede apretar
// otra vez mientras el recibo no esté emitido, y en vez de rehacer la quincena
// la reconcilia: suma lo que apareció, saca lo que ya no está, y deja donde
// está lo que se cargó a mano.

const fechaHora = (iso) => {
  if (!iso) return '—'
  const [f, h] = String(iso).split('T')
  const [a, m, d] = f.split('-')
  return `${d}/${m}/${a} ${(h || '').slice(0, 5)}`
}

const comoFechaQuincena = (iso) => {
  if (!iso) return ''
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${Number(d) <= 15 ? '1ra' : '2da'} de ${m}/${a}`
}

// El backend agrupa por nombre con guión bajo; las claves del front usan guión.
const claveConteo = (clave) => clave.replace('-', '_')

// Los rubros de la portada, en el orden del recibo: primero lo que se le paga
// al tercero, después lo que se le descuenta. Es plata y no cantidad de filas:
// "756 viajes" no dice si la quincena fue cara o barata, y es lo único que uno
// quiere saber mirando una lista de quincenas.
const RUBROS = [
  { clave: 'viajes', titulo: 'Viajes', signo: 1 },
  { clave: 'servicio', titulo: 'Horas de servicio', signo: 1 },
  { clave: 'combustible', titulo: 'Combustible', signo: -1 },
  { clave: 'repuestos', titulo: 'Repuestos', signo: -1 },
  { clave: 'reparacion', titulo: 'Horas de reparación', signo: -1 },
  { clave: 'seguros', titulo: 'Seguros', signo: -1 },
]

export default function Inicio() {
  const qc = useQueryClient()
  const navegar = useNavigate()
  const quincena = useQuincenaStore(s => s.quincena)
  const setQuincena = useQuincenaStore(s => s.setQuincena)
  const [detalle, setDetalle] = useState(null)

  // Hacer clic en una quincena la abre: la deja elegida en todo el módulo y
  // lleva a la grilla. Es lo que uno espera de una fila que representa una
  // quincena, y ahorra el paso de volver a elegirla en el selector de allá.
  const abrir = (q) => {
    setQuincena(q)
    navegar(`${PREFIJO}/quincena`)
  }

  const { data: liquidaciones = [], isLoading } = useQuery({
    queryKey: ['terceros', 'liquidaciones'],
    queryFn: listarLiquidaciones,
  })

  const generar = useMutation({
    mutationFn: () => generarLiquidacion(quincena),
    onSuccess: (d) => {
      setDetalle(d)
      const movidas = Object.values(d.detalle)
        .reduce((n, c) => n + c.insertadas + c.borradas, 0)
      toast.success(
        d.nueva
          ? `Quincena generada: ${comoEntero(d.total_filas)} filas`
          : movidas === 0
            ? 'Actualizada: no cambió nada en los orígenes'
            : `Actualizada: ${comoEntero(movidas)} fila(s) cambiaron`
      )
      // Lo guardado cambió, así que lo que haya en caché del módulo ya no
      // necesariamente coincide.
      qc.invalidateQueries({ queryKey: ['terceros'] })
    },
    onError: err => toast.error(err.message),
  })

  const yaGenerada = liquidaciones.find(l => l.quincena === quincena)

  return (
    <div className={styles.page}>
      {generar.isPending && (
        <CargandoOverlay texto="Leyendo las cinco fuentes y guardando…" />
      )}

      <div className={styles.topbar}>
        <h1 className={styles.titulo}>Liquidación Terceros</h1>
        <SelectorQuincena />
        <button
          className="btn btn-primary"
          disabled={!quincena || generar.isPending}
          onClick={() => generar.mutate()}
        >
          {yaGenerada ? 'Actualizar quincena' : 'Generar quincena'}
        </button>
      </div>

      {detalle && (
        <div className={styles.panel}>
          <div className={styles.panelTitulo}>
            {detalle.nueva ? 'Se generó' : 'Se actualizó'} la quincena {comoFechaQuincena(detalle.quincena)}
          </div>
          <div className={styles.detalle}>
            {CONJUNTOS.map(c => {
              const d = detalle.detalle[claveConteo(c.clave)]
              if (!d) return null
              return (
                <div key={c.clave} className={styles.detalleFila}>
                  <span className={styles.detalleNombre}>{c.titulo}</span>
                  <span className={styles.detalleDato}>{comoEntero(d.origen)} en el origen</span>
                  {d.insertadas > 0 && (
                    <span className={styles.detalleAlta}>+{comoEntero(d.insertadas)}</span>
                  )}
                  {d.borradas > 0 && (
                    <span className={styles.detalleBaja}>−{comoEntero(d.borradas)}</span>
                  )}
                  {d.insertadas === 0 && d.borradas === 0 && (
                    <span className={styles.detalleIgual}>sin cambios</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isLoading && <CargandoContenido texto="Buscando las quincenas generadas…" />}

      {!isLoading && liquidaciones.length === 0 && (
        <div className={styles.vacio}>
          Todavía no se generó ninguna quincena. Elegí una arriba y generala.
        </div>
      )}

      {!isLoading && liquidaciones.length > 0 && (
        <div className={styles.lista}>
          {liquidaciones.map(l => {
            const esActual = l.quincena === quincena
            return (
              <button key={l.id} type="button"
                      className={`${styles.tarjeta} ${esActual ? styles.actual : ''}`}
                      onClick={() => abrir(l.quincena)}
                      title={`Abrir esta quincena. Generada ${fechaHora(l.generada_en)}`}>
                <div className={styles.quincena}>
                  <span className={styles.nombre}>{comoFechaQuincena(l.quincena)}</span>
                  <span className={styles.fechas}>Actualizada {fechaHora(l.actualizada_en)}</span>
                </div>
                {RUBROS.map(r => {
                  const valor = l.importes?.[r.clave]
                  const clases = [styles.rubro,
                    !Number(valor) ? styles.cero : r.signo < 0 ? styles.resta : '']
                  return (
                    <div key={r.clave} className={clases.join(' ')}>
                      <span className={styles.rubroTitulo}>{r.titulo}</span>
                      <span className={styles.rubroValor}>{comoPesosEnteros(valor)}</span>
                    </div>
                  )
                })}
                <div className={styles.total}>
                  <span className={styles.totalLabel}>Total</span>
                  <span className={styles.totalValor}>{comoPesosEnteros(l.importes?.total)}</span>
                </div>
                <span className={styles.flecha} aria-hidden="true">→</span>
              </button>
            )
          })}
        </div>
      )}

    </div>
  )
}
