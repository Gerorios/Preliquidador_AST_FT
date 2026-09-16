import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { CONJUNTOS, claveQuery, conjuntoPorClave } from '../conjuntos'
import { comoEntero, comoHoras } from '../formato'
import { PREFIJO } from '../rutas'
import styles from './Inicio.module.css'

// Cada tarjeta es su propio pedido: el navegador los hace en paralelo, cada una
// aparece cuando llega la suya, y la que falla no voltea a las demás. Usan la
// misma clave de caché que la pantalla del conjunto, así abrirla es instantáneo.
function Tarjeta({ conjunto, quincena }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: claveQuery(conjunto.clave, quincena),
    queryFn: () => conjunto.traer(quincena),
    enabled: !!quincena,
    retry: false,
  })

  const filas = data ? conjunto.filas(data) : []
  const total = filas.reduce((suma, f) => suma + Number(f[conjunto.campo] ?? 0), 0)

  return (
    <Link to={`${PREFIJO}/${conjunto.clave}`} className={styles.tarjeta}>
      <div className={styles.tarjetaTitulo}>{conjunto.titulo}</div>
      {isLoading && <div className={styles.tarjetaCargando}>Leyendo el origen…</div>}
      {isError && <div className={styles.tarjetaError}>{error.message}</div>}
      {!isLoading && !isError && (
        <>
          <div className={styles.tarjetaTotal}>{conjunto.formato(total)}</div>
          <div className={styles.tarjetaUnidad}>{conjunto.unidad}</div>
          <div className={styles.tarjetaFilas}>{comoEntero(filas.length)} filas</div>
        </>
      )}
    </Link>
  )
}

// Lee de la misma consulta que la tarjeta de reparación: /horas-reparacion
// devuelve el listado y el recuento juntos, de una sola lectura del Sheet.
function TableroHoras({ quincena }) {
  const conjunto = conjuntoPorClave('horas-reparacion')
  const { data } = useQuery({
    queryKey: claveQuery('horas-reparacion', quincena),
    queryFn: () => conjunto.traer(quincena),
    enabled: !!quincena,
    retry: false,
  })

  if (!data?.estados) return null
  const e = data.estados

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitulo}>Horas de reparación de la quincena</div>
      <p className={styles.panelTexto}>
        Solo se cobran las aprobadas. Lo que siga pendiente cuando se emita el recibo no se
        cobra en esta quincena: conviene reclamarlo al taller antes de liquidar.
      </p>
      <div className={styles.estados}>
        <div className={styles.estado}>
          <span className={styles.estadoNumero}>{comoEntero(e.aprobadas)}</span>
          <span className={styles.estadoLabel}>aprobadas</span>
          <span className={styles.estadoDetalle}>{comoHoras(e.horas_aprobadas)} hs</span>
        </div>
        <div className={`${styles.estado} ${e.pendientes > 0 ? styles.estadoAviso : ''}`}>
          <span className={styles.estadoNumero}>{comoEntero(e.pendientes)}</span>
          <span className={styles.estadoLabel}>pendientes</span>
          <span className={styles.estadoDetalle}>{comoHoras(e.horas_pendientes)} hs</span>
        </div>
        <div className={styles.estado}>
          <span className={styles.estadoNumero}>{comoEntero(e.rechazadas)}</span>
          <span className={styles.estadoLabel}>rechazadas</span>
          <span className={styles.estadoDetalle}>no se cobran</span>
        </div>
      </div>
    </div>
  )
}

export default function Inicio() {
  const quincena = useQuincenaStore(s => s.quincena)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.titulo}>Liquidación Terceros</h1>
        <SelectorQuincena />
      </div>

      <p className={styles.texto}>
        Lo que llegó de los sistemas de origen en la quincena elegida. Por ahora el módulo
        solo muestra: las tarifas, el neto y el recibo llegan en las etapas siguientes.
      </p>

      {!quincena ? (
        <div className={styles.vacio}>Elegí una quincena para ver el resumen.</div>
      ) : (
        <>
          <div className={styles.grilla}>
            {CONJUNTOS.map(c => (
              <Tarjeta key={c.clave} conjunto={c} quincena={quincena} />
            ))}
          </div>
          <TableroHoras quincena={quincena} />
        </>
      )}
    </div>
  )
}
