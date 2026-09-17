import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import { obtenerAlertas } from '../services/terceros'
import { comoEntero } from '../formato'
import styles from './Verificaciones.module.css'

// Esta pantalla no arregla nada: es la herramienta con la que se hace la
// limpieza de los sistemas de origen. Por eso cada aviso se presenta por DÓNDE
// SE CORRIGE y no por dónde se detectó — lo que el liquidador necesita saber es
// a quién avisarle.
//
// Hoy contiene una sola familia de verificaciones, las Alertas de cruce entre
// sistemas. La etapa 9 suma los duplicados dentro de cada fuente y las reagrupa
// por origen, que es como el usuario las pidió.

const SEVERIDADES = [
  {
    clave: 'alta',
    titulo: 'Hay plata mal imputada hoy',
    ayuda: 'Estas ya están afectando lo que se cobra o se descuenta. Van primero.',
  },
  {
    clave: 'media',
    titulo: 'Todavía no rompió, pero va a romper',
    ayuda: 'No hay plata mal imputada por ahora, pero el dato está mal y en algún momento se paga.',
  },
  {
    clave: 'baja',
    titulo: 'Conviene mirarlo',
    ayuda: 'Puede ser legítimo. Se avisa para que alguien decida, no para corregir a ciegas.',
  },
]

const CLASE_SEVERIDAD = { alta: styles.alta, media: styles.media, baja: styles.baja }

function Alerta({ alerta }) {
  return (
    <div className={`${styles.alerta} ${CLASE_SEVERIDAD[alerta.severidad]}`}>
      <div className={styles.alertaCabecera}>
        <div className={styles.alertaTitulo}>{alerta.titulo}</div>
        <div className={styles.alertaSistema}>Se corrige en: {alerta.sistema}</div>
      </div>
      {alerta.impacto && <div className={styles.alertaImpacto}>{alerta.impacto}</div>}
      <div className={styles.alertaDetalle}>{alerta.detalle}</div>
      {alerta.referencias?.length > 0 && (
        <div className={styles.alertaRefs}>
          {alerta.referencias.map(r => <span key={r} className={styles.ref}>{r}</span>)}
        </div>
      )}
    </div>
  )
}

function ResumenMaquinaria({ m }) {
  // Va como una sola medición y no como una alerta por máquina porque la causa
  // es una sola y no se arregla fila por fila: al sistema de campo le falta el
  // dueño como campo propio.
  const sinCruce = m.sin_patente + m.con_patente_sin_par
  return (
    <div className={styles.panel}>
      <div className={styles.panelTitulo}>Maquinaria de terceros del sistema de campo</div>
      <p className={styles.panelTexto}>
        Hoy el único puente posible con los otros dos sistemas es la patente, y la mayoría
        de la maquinaria no tiene. <strong>{comoEntero(sinCruce)} de {comoEntero(m.total)}</strong>{' '}
        no se puede cruzar con nada. Esto no son {comoEntero(sinCruce)} tareas sueltas: es una
        sola, y es que el sistema de campo traiga el dueño como un campo propio en vez de
        embebido en el nombre.
      </p>
      <div className={styles.cifras}>
        <div className={styles.cifra}>
          <span className={styles.cifraNumero}>{comoEntero(m.cruzan)}</span>
          <span className={styles.cifraLabel}>cruzan por patente</span>
        </div>
        <div className={styles.cifra}>
          <span className={styles.cifraNumero}>{comoEntero(m.sin_patente)}</span>
          <span className={styles.cifraLabel}>sin patente en ningún lado</span>
        </div>
        <div className={styles.cifra}>
          <span className={styles.cifraNumero}>{comoEntero(m.con_patente_sin_par)}</span>
          <span className={styles.cifraLabel}>con patente, sin par</span>
        </div>
      </div>
    </div>
  )
}

export default function Verificaciones() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [sistema, setSistema] = useState('')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['terceros', 'alertas', anio],
    queryFn: () => obtenerAlertas(anio),
    retry: false,
  })

  const sistemas = useMemo(
    () => [...new Set((data?.alertas ?? []).map(a => a.sistema))].sort(),
    [data]
  )
  const visibles = useMemo(
    () => (data?.alertas ?? []).filter(a => !sistema || a.sistema === sistema),
    [data, sistema]
  )

  const anios = [0, 1, 2].map(n => new Date().getFullYear() - n)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Verificaciones</div>
        <select className="input" style={{ width: 150 }} value={anio}
                onChange={e => setAnio(Number(e.target.value))} aria-label="Año">
          {anios.map(a => <option key={a} value={a}>Movimiento de {a}</option>)}
        </select>
        <select className="input" style={{ width: 230 }} value={sistema}
                onChange={e => setSistema(e.target.value)} aria-label="Sistema donde se corrige">
          <option value="">Todos los sistemas</option>
          {sistemas.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className={styles.count}>
          {visibles.length === (data?.alertas?.length ?? 0)
            ? `${visibles.length} alertas`
            : `${visibles.length} de ${data.alertas.length} alertas`}
        </div>
      </div>

      <p className={styles.texto}>
        Lo que hay que mirar antes de liquidar. Por ahora son los cruces entre sistemas: lo que
        uno dice y otro no encuentra. Nada se resuelve solo ni se adivina por parecido — cada
        aviso dice en qué sistema hay que corregirlo. No lleva quincena porque un problema de
        cruce es del maestro, no de un período.
      </p>

      <div className={styles.content}>
        {isLoading && <CargandoContenido texto="Comparando los tres sistemas…" />}
        {isError && (
          <div className={styles.error}>
            <div className={styles.errorTitulo}>No se pudieron comparar los sistemas</div>
            <div>{error.message}</div>
            <div className={styles.errorNota}>
              Sin el maestro de la app del taller, la mitad de las alertas serían falsas, así que
              no se muestra ninguna.
            </div>
          </div>
        )}
        {data && (
          <>
            <ResumenMaquinaria m={data.maquinaria_campo} />
            {visibles.length === 0 && (
              <div className={styles.vacio}>
                No hay alertas con este filtro. Los tres sistemas se encuentran.
              </div>
            )}
            {SEVERIDADES.map(s => {
              const lista = visibles.filter(a => a.severidad === s.clave)
              if (!lista.length) return null
              return (
                <section key={s.clave} className={styles.grupo}>
                  <div className={styles.grupoCabecera}>
                    <span className={`${styles.pastilla} ${CLASE_SEVERIDAD[s.clave]}`}>
                      {lista.length}
                    </span>
                    <div>
                      <div className={styles.grupoTitulo}>{s.titulo}</div>
                      <div className={styles.grupoAyuda}>{s.ayuda}</div>
                    </div>
                  </div>
                  {lista.map((a, i) => <Alerta key={`${a.tipo}-${i}`} alerta={a} />)}
                </section>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
