import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import CargandoOverlay from '../../../core/ui/CargandoOverlay'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { listarLiquidaciones, generarLiquidacion } from '../services/terceros'
import { CONJUNTOS } from '../conjuntos'
import { comoEntero } from '../formato'
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

export default function Inicio() {
  const qc = useQueryClient()
  const quincena = useQuincenaStore(s => s.quincena)
  const [detalle, setDetalle] = useState(null)

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

      <p className={styles.texto}>
        Generar trae lo que las cinco fuentes tienen de esa quincena y lo guarda. Tarda: son dos
        bases y un Google Sheet. Se puede volver a actualizar las veces que haga falta — no rehace
        la quincena, la reconcilia, y no pisa lo que hayas cargado a mano.
      </p>

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

      <div className={styles.content}>
        {isLoading && <CargandoContenido texto="Buscando las quincenas generadas…" />}

        {!isLoading && liquidaciones.length === 0 && (
          <div className={styles.vacio}>
            Todavía no se generó ninguna quincena. Elegí una arriba y generala.
          </div>
        )}

        {!isLoading && liquidaciones.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Quincena</th>
                {CONJUNTOS.map(c => (
                  <th key={c.clave} style={{ textAlign: 'right' }}>{c.titulo}</th>
                ))}
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Generada</th>
                <th>Actualizada</th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones.map(l => (
                <tr key={l.id} className={l.quincena === quincena ? styles.actual : undefined}>
                  <td>
                    <Link to={`${PREFIJO}/viajes`} className={styles.enlace}>
                      {comoFechaQuincena(l.quincena)}
                    </Link>
                  </td>
                  {CONJUNTOS.map(c => (
                    <td key={c.clave} style={{ textAlign: 'right' }}>
                      {comoEntero(l.filas[claveConteo(c.clave)] ?? 0)}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {comoEntero(l.total_filas)}
                  </td>
                  <td>{fechaHora(l.generada_en)}</td>
                  <td>{fechaHora(l.actualizada_en)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className={styles.nota}>
        Las pantallas de cada conjunto todavía leen los orígenes en vivo, así que pueden mostrar
        algo distinto de lo guardado acá. Se unifican en la etapa 8, cuando las reemplace una sola
        grilla que lee lo guardado y le aplica las tarifas.
      </p>
    </div>
  )
}
