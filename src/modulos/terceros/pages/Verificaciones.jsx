import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { obtenerAlertas, obtenerVerificaciones } from '../services/terceros'
import { comoEntero } from '../formato'
import styles from './Verificaciones.module.css'

// Esta pantalla no arregla nada: es la herramienta con la que se hace la
// limpieza. Por eso cada aviso dice DÓNDE SE CORRIGE y no dónde se detectó —
// lo que el liquidador necesita saber es a quién avisarle.
//
// Se recorre en tres pasos, y cada uno es una fila de chips o una tabla, igual
// que la Quincena y el Tarifario:
//
//   1. El **tipo de problema**: duplicados, vales repetidos. Es la pregunta con
//      la que uno llega: "¿hay algo cargado dos veces?".
//   2. El **sistema**, porque cada uno lo corrige alguien distinto y son tres
//      conversaciones con tres personas.
//   3. La tabla con las filas concretas para ir a buscar.
//
// Agrupar al revés —por sistema primero— obliga a recorrer los cinco para
// contestar una sola pregunta.

// Cómo se llama cada tipo. Lo que el backend agregue y no esté acá se muestra
// igual, con el título que él manda: sumar una verificación nueva no tiene que
// obligar a tocar esta pantalla.
const TIPOS = {
  duplicado: 'Duplicados',
  vale_repetido: 'Vales repetidos',
  carga_sin_vale: 'Cargas sin vale',
  viaje_en_cero: 'Viajes en cero',
}

const ORDEN = ['duplicado', 'vale_repetido', 'carga_sin_vale', 'viaje_en_cero']

const CLASE = { alta: styles.alta, media: styles.media, baja: styles.baja }

const SEVERIDADES = [
  { clave: 'alta', titulo: 'Hay plata mal imputada hoy',
    ayuda: 'Estas ya están afectando lo que se cobra o se descuenta. Van primero.' },
  { clave: 'media', titulo: 'Todavía no rompió, pero va a romper',
    ayuda: 'No hay plata mal imputada por ahora, pero el dato está mal y en algún momento se paga.' },
  { clave: 'baja', titulo: 'Conviene mirarlo',
    ayuda: 'Puede ser legítimo. Se avisa para que alguien decida, no para corregir a ciegas.' },
]

function Chip({ activo, onClick, children, cuenta, tono }) {
  return (
    <button className={`${styles.chip} ${activo ? styles.chipActivo : ''}`} onClick={onClick}>
      {children}
      {cuenta !== undefined && (
        <span className={`${styles.chipCuenta} ${tono ? CLASE[tono] : ''}`}>
          {comoEntero(cuenta)}
        </span>
      )}
    </button>
  )
}

function Alerta({ alerta }) {
  return (
    <div className={`${styles.alerta} ${CLASE[alerta.severidad]}`}>
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
  const quincena = useQuincenaStore(s => s.quincena)
  const [tipo, setTipo] = useState(null)       // null = el primero que tenga algo
  const [fuente, setFuente] = useState(null)   // null = la primera del tipo
  const [anio, setAnio] = useState(new Date().getFullYear())

  const { data: fuentes = [], isLoading } = useQuery({
    queryKey: ['terceros', 'verificaciones', quincena],
    queryFn: () => obtenerVerificaciones(quincena),
    enabled: !!quincena,
  })

  const { data: cruce, isLoading: cargandoCruce, isError, error } = useQuery({
    queryKey: ['terceros', 'alertas', anio],
    queryFn: () => obtenerAlertas(anio),
    retry: false,
  })

  // Se da vuelta el agrupamiento que manda el backend: él responde por fuente
  // —que es como se corrige— y la pantalla pregunta por tipo, que es como uno
  // llega.
  const secciones = useMemo(() => {
    const porTipo = new Map()
    for (const f of fuentes) {
      for (const v of f.verificaciones) {
        if (!porTipo.has(v.tipo)) porTipo.set(v.tipo, [])
        porTipo.get(v.tipo).push({ fuente: f, v })
      }
    }
    const conocidos = ORDEN.filter(t => porTipo.has(t))
    const nuevos = [...porTipo.keys()].filter(t => !ORDEN.includes(t))
    return [...conocidos, ...nuevos].map(clave => ({
      clave,
      label: TIPOS[clave] ?? porTipo.get(clave)[0].v.titulo,
      entradas: porTipo.get(clave),
      total: porTipo.get(clave).reduce((n, x) => n + x.v.total, 0),
      severidad: porTipo.get(clave)[0].v.severidad,
    }))
  }, [fuentes])

  const activo = tipo ?? secciones[0]?.clave ?? 'cruce'
  const seccion = secciones.find(s => s.clave === activo)
  const entrada = seccion?.entradas.find(e => e.fuente.fuente === fuente)
    ?? seccion?.entradas[0]

  const alertas = cruce?.alertas ?? []
  const anios = [0, 1, 2].map(n => new Date().getFullYear() - n)

  const elegirTipo = (clave) => { setTipo(clave); setFuente(null) }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Verificaciones</div>
        <SelectorQuincena />
        {activo === 'cruce' && (
          <select className="input" style={{ width: 160 }} value={anio}
                  onChange={e => setAnio(Number(e.target.value))} aria-label="Año">
            {anios.map(a => <option key={a} value={a}>Movimiento de {a}</option>)}
          </select>
        )}
      </div>

      <div className={styles.panelFiltros}>
        <div className={styles.chips}>
          {secciones.map(s => (
            <Chip key={s.clave} activo={activo === s.clave} cuenta={s.total}
                  tono={s.severidad} onClick={() => elegirTipo(s.clave)}>
              {s.label}
            </Chip>
          ))}
          {/* Los cruces no dependen de una quincena: son del maestro. */}
          <Chip activo={activo === 'cruce'} cuenta={alertas.length || undefined}
                onClick={() => elegirTipo('cruce')}>
            Entre sistemas
          </Chip>
        </div>

        {/* Un chip por sistema, porque cada uno lo corrige alguien distinto. */}
        {seccion && seccion.entradas.length > 0 && (
          <div className={styles.filtros}>
            {seccion.entradas.map(e => (
              <Chip key={e.fuente.fuente} activo={entrada?.fuente.fuente === e.fuente.fuente}
                    cuenta={e.v.total} onClick={() => setFuente(e.fuente.fuente)}>
                {e.fuente.titulo}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {activo !== 'cruce' && entrada && (
        <div className={styles.aviso}>
          <strong>{entrada.v.impacto}</strong> {entrada.v.detalle}{' '}
          Se corrige en: <strong>{entrada.v.sistema}</strong>.
        </div>
      )}

      <div className={styles.content}>
        {activo !== 'cruce' && (
          <>
            {!quincena && <div className={styles.vacio}>Elegí una quincena para verificarla.</div>}
            {quincena && isLoading && <CargandoContenido texto="Revisando la quincena…" />}
            {quincena && !isLoading && fuentes.length === 0 && (
              <div className={styles.vacio}>
                Esta quincena no está generada. Generala desde Inicio y volvé.
              </div>
            )}
            {quincena && !isLoading && fuentes.length > 0 && secciones.length === 0 && (
              <div className={styles.vacio}>
                Las cinco fuentes están limpias en esta quincena.
              </div>
            )}
            {entrada && (
              <div className={styles.tabla}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 200 }}>Tercero</th>
                      <th>Qué mirar</th>
                      <th style={{ width: 70, textAlign: 'right' }}>Veces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entrada.v.casos.map((c, i) => (
                      <tr key={i}>
                        <td className={styles.casoTercero}>{c.tercero ?? '— sin dueño —'}</td>
                        <td>{c.datos.filter(Boolean).join('  ·  ')}</td>
                        <td style={{ textAlign: 'right' }}>
                          {c.veces > 1 ? `×${c.veces}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {entrada.v.total > entrada.v.casos.length && (
                  <div className={styles.nota}>
                    Se muestran {comoEntero(entrada.v.casos.length)} de{' '}
                    {comoEntero(entrada.v.total)}.
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activo === 'cruce' && (
          <>
            {cargandoCruce && <CargandoContenido texto="Comparando los tres sistemas…" />}
            {isError && (
              <div className={styles.error}>
                <div className={styles.errorTitulo}>No se pudieron comparar los sistemas</div>
                <div>{error.message}</div>
                <div className={styles.errorNota}>
                  Sin el maestro de la app del taller, la mitad de las alertas serían falsas,
                  así que no se muestra ninguna.
                </div>
              </div>
            )}
            {cruce && (
              <>
                <ResumenMaquinaria m={cruce.maquinaria_campo} />
                {alertas.length === 0 && (
                  <div className={styles.vacio}>
                    No hay alertas. Los tres sistemas se encuentran.
                  </div>
                )}
                {SEVERIDADES.map(s => {
                  const lista = alertas.filter(a => a.severidad === s.clave)
                  if (!lista.length) return null
                  return (
                    <section key={s.clave} className={styles.grupo}>
                      <div className={styles.grupoCabecera}>
                        <span className={`${styles.pastilla} ${CLASE[s.clave]}`}>
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
          </>
        )}
      </div>
    </div>
  )
}
