import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import useAuthStore from '../../../core/authStore'
import { puedeEditar, puedeVer } from '../../../core/permisos'
import {
  CLAVE_RESUMEN, claveDetalle, obtenerDetalle, dejarRevision, deshacerRevision,
} from '../services/resumen'
import { ESTADOS } from '../estados'
import { formatoPesos } from '../numeros'
import { medidaIlegible, textoMedida, textoUmbral, textoUnidad } from '../vistaResumen'
import {
  bannerDeDetalle, puedeRevisar, validarComentario, textoPct, claveDeLinea, lineasQueSuperan,
  revisadaEnLinea, alternarAbierta, textoDiferencia, textoDiferenciaPesos, signoDeDiferencia,
  textoComprobante, textoMesLargo, periodoARevisar, esMesEntero, textoPeriodo, textoNoRevisable,
  esNoRevisable, avisoEnCurso,
} from '../detalle'
import ModalPartes from '../components/ModalPartes'
import ModalRevision from '../components/ModalRevision'
import styles from './Detalle.module.css'

// Detalle de un Cliente en un mes (plan E3, FA6; spec de la E3a por grupo,
// decisiones 1, 3 y 4): el Cruce por (grupo de tareas, unidad), de lo
// trabajado según el campo contra lo facturado, con la fila TOTAL en pesos.
// Arriba, el Cliente, el mes, el Estado del mes, los Comprobantes del mes y
// el aviso según el caso. Las filas arrancan cerradas: el triángulo abre las
// tareas de la fila con su cantidad del campo, y el nombre de una tarea abre
// el modal con sus partes. "Marcar revisada" abre el modal de la Revisión de
// diferencia (spec, decisión 5). No se factura desde acá: se vuelve al
// Resumen, que conserva su período, sus filtros y su orden (estadoPantallas).
//
// El período es el filtro del Resumen, que llega como `?desde=&hasta=`
// (Ticket 4): el backend lo recorta al mes y lo devuelve en el Detalle; sin
// ellos, el mes entero. La Revisión cubre ese período exacto. Un grupo con
// alguna Línea que cae en parte afuera dice "fuera del filtro" y no se
// compara, como en el Resumen.

const RESUMEN = '/facturacion/resumen'

// En el Detalle el cero se muestra ("0"): una tarea trabajada y no facturada
// tiene que decir de dónde sale su diferencia. La raya, sólo para lo vacío o
// ilegible.
function Medida({ valor }) {
  return medidaIlegible(valor)
    ? <span className={styles.vacia}>—</span>
    : textoMedida(valor, { conCero: true })
}

const tareas_ = n => `${n} ${n === 1 ? 'tarea' : 'tareas'}`

// Las tareas de una fila, cuando está abierta: el nombre abre el modal de los
// partes; al lado, "Sin Unidad sugerida" (decisión 1) y "en varias unidades"
// si la tarea también está en otra fila. Sólo llevan la cantidad del campo:
// las tareas no avisan ni se comparan, lo hace la fila.
function FilasDeTareas({ linea, idFila, onAbrirPartes }) {
  return (linea.tareas ?? []).map(t => (
    <tr key={t.tarea_id} id={`${idFila}-${t.tarea_id}`} className={styles.filaTarea}>
      <td className={styles.tarea}>
        <button
          type="button"
          className={styles.tareaBoton}
          aria-haspopup="dialog"
          onClick={() => onAbrirPartes(linea, t)}
        >
          {nombreDeTarea(t)}
        </button>
        {t.sin_unidad_sugerida && <span className={styles.sinUnidad}>Sin Unidad sugerida</span>}
        {t.en_varias_unidades && <span className={styles.marca}>en varias unidades</span>}
      </td>
      <td />
      <td className={styles.numero}><Medida valor={t.campo} /></td>
      <td colSpan={4} />
    </tr>
  ))
}

const nombreDeTarea = t => t.tarea_nombre || `Tarea ${t.tarea_id}`

// Los Estados del mes, del más urgente al menos, como texto: en el Detalle no
// llevan a ningún lado (Con diferencia es esta misma pantalla, y no se
// factura desde acá).
function Estados({ estados }) {
  const claves = (estados ?? [])
    .filter(clave => Object.hasOwn(ESTADOS, clave))
    .sort((a, b) => ESTADOS[a].orden - ESTADOS[b].orden)
  return claves.map(clave => (
    <span key={clave} className={`badge ${ESTADOS[clave].badge}`}>{ESTADOS[clave].etiqueta}</span>
  ))
}

// Los Comprobantes del período: links al Comprobante sólo con Ver en
// `comprobantes`; si no, el texto. Uno que pide su PDF lo dice al lado. Con
// una parte del mes, son los que tienen alguna Línea en ese período.
function Comprobantes({ comprobantes, enlaces, parcial }) {
  if (!comprobantes.length) {
    return <p className={styles.comprobantes}>Sin Comprobantes {parcial ? 'en el período' : 'en el mes'}.</p>
  }
  return (
    <p className={styles.comprobantes}>
      <span className={styles.comprobantesTitulo}>Comprobantes {parcial ? 'del período' : 'del mes'}:</span>
      {comprobantes.map(c => {
        const sinPdf = !c.es_historico && c.cantidad_adjuntos === 0
        return (
          <span key={c.id} className={styles.comprobante}>
            {enlaces
              ? <Link to={`/facturacion/comprobantes/${c.id}`} className={`mono ${styles.linkComprobante}`}>{textoComprobante(c)}</Link>
              : <span className="mono">{textoComprobante(c)}</span>}
            {sinPdf && <span className={styles.sinPdf}>sin PDF</span>}
          </span>
        )
      })}
    </p>
  )
}

export default function Detalle() {
  const { clienteId, mes } = useParams()
  // El filtro del Resumen; sin los dos, el mes entero.
  const [params] = useSearchParams()
  const desde = params.get('desde') || undefined
  const hasta = params.get('hasta') || undefined
  const qc = useQueryClient()
  const { usuario } = useAuthStore()
  const editaResumen = puedeEditar(usuario, 'facturacion', 'resumen')
  const veComprobantes = puedeVer(usuario, 'facturacion', 'comprobantes')

  const clave = claveDetalle(clienteId, mes, desde, hasta)
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: clave,
    queryFn: () => obtenerDetalle({ clienteId, mes, desde, hasta }),
  })

  // Las filas abiertas, por su clave (grupo, unidad): todas arrancan cerradas.
  const [abiertas, setAbiertas] = useState(() => new Set())
  // La tarea del modal de partes, con su fila: { linea, tarea } o null.
  const [partesDe, setPartesDe] = useState(null)
  // El modal de la Revisión.
  const [revisando, setRevisando] = useState(false)
  // El comentario vive acá: cerrar el modal sin querer no lo pierde.
  const [comentario, setComentario] = useState('')
  const [errorComentario, setErrorComentario] = useState(null)
  // El aviso del 409 dentro del modal: ya no hay nada que revisar.
  const [conflicto, setConflicto] = useState(null)

  const tituloRef = useRef(null)
  const botonRevisar = useRef(null)
  const botonDeshacer = useRef(null)
  const campoComentario = useRef(null)
  // A dónde va el foco después de cerrar la Revisión, de marcarla o de
  // deshacerla: { destino, antes }. Con `antes` (el Detalle de antes de
  // guardar), espera a que llegue el Detalle nuevo, que es el que trae el
  // botón de destino.
  const focoPendiente = useRef(null)

  const lineas = data?.grupos ?? []
  const superan = useMemo(() => lineasQueSuperan(data), [data])
  const banner = bannerDeDetalle(data, editaResumen)
  // Si el período no terminó, una línea aparte arriba del aviso del caso: se
  // controla igual, pero el campo puede sumar partes (plan del 2026-10-17).
  const enCurso = avisoEnCurso(data)
  const revisable = puedeRevisar(data, editaResumen)
  const umbralTexto = textoUmbral(data?.umbral_pct)
  const mesTexto = textoMesLargo(mes)
  // El período del Detalle y de la Revisión: el que devuelve el backend (el
  // filtro recortado al mes); mientras carga, el de la dirección.
  const periodo = periodoARevisar(data ?? { mes, desde, hasta })
  const parcial = Boolean(periodo) && !esMesEntero(periodo)
  // "octubre 2026" o, con una parte del mes, "del 1 al 15 de octubre 2026".
  const periodoTexto = parcial ? `${textoPeriodo(periodo)} ${periodo.desde.slice(0, 4)}` : mesTexto
  // Mientras carga, el título dice "Detalle" y el mes; el Cliente llega con el Detalle.
  const cliente = data ? (data.cliente_nombre ?? `Cliente ${clienteId}`) : 'Detalle'

  // ─── Revisión de diferencia ───────────────────────────────────────────────

  // Las dos escrituras devuelven el Detalle ya actualizado: queda en su clave
  // sin volver a leer el campo. El Resumen se marca viejo y se vuelve a pedir
  // al entrar, porque cambia el Estado del mes.
  const alGuardar = detalle => {
    qc.invalidateQueries({ queryKey: CLAVE_RESUMEN, refetchType: 'none' })
    qc.setQueryData(clave, detalle)
  }

  // Un 409 o un 404 dicen que el mes cambió mientras tanto (otra persona lo
  // revisó, deshizo o corrigió): el aviso lo explica y el Detalle se vuelve a
  // pedir.
  const alFallar = (e, texto) => {
    toast.error(`${texto} ${e.message}`)
    if (e.status === 409 || e.status === 404) {
      cerrarRevision()
      qc.invalidateQueries({ queryKey: CLAVE_RESUMEN })
    }
  }

  const revisar = useMutation({
    mutationFn: dejarRevision,
    onSuccess: detalle => {
      focoPendiente.current = { destino: 'deshacer', antes: data }
      alGuardar(detalle)
      setRevisando(false)
      setComentario('')
      setErrorComentario(null)
      toast.success('Marcada como revisada')
    },
    onError: e => {
      if (e.detail?.tipo === 'revision_invalida') {
        setErrorComentario(e.message)
        campoComentario.current?.focus()
      } else if (esNoRevisable(e)) {
        // Ya no hay grupos que superen: el modal lo dice y queda abierto
        // hasta "Cerrar", mientras el Detalle se vuelve a pedir.
        setConflicto(textoNoRevisable(periodo))
        qc.invalidateQueries({ queryKey: CLAVE_RESUMEN })
      } else if (e.status === 404) {
        alFallar(e, 'No se pudo marcar revisada.')
      } else {
        // Un error que no dice nada del mes: el modal queda abierto, con lo
        // escrito, para volver a intentar.
        toast.error(`No se pudo marcar revisada. ${e.message}`)
      }
    },
  })

  const deshacer = useMutation({
    mutationFn: deshacerRevision,
    onSuccess: detalle => {
      focoPendiente.current = { destino: 'revisar', antes: data }
      alGuardar(detalle)
      toast.success('Revisión deshecha')
    },
    onError: e => alFallar(e, 'No se pudo deshacer la Revisión.'),
  })

  const confirmarRevision = () => {
    const problema = validarComentario(comentario)
    setErrorComentario(problema)
    if (problema) {
      campoComentario.current?.focus()
      return
    }
    revisar.mutate({ clienteId, mes, desde, hasta, comentario: comentario.trim() })
  }

  // ─── Filas, modal de partes y modal de la Revisión ────────────────────────

  const alternar = claveLinea => setAbiertas(actuales => alternarAbierta(actuales, claveLinea))

  // El modal guarda el foco que había al abrir (el nombre de la tarea) y lo
  // devuelve al cerrar.
  const abrirPartes = (linea, tarea) => setPartesDe({ linea, tarea })
  const cerrarPartes = useCallback(() => setPartesDe(null), [])

  // El modal pone el foco en el comentario al abrir.
  const abrirRevision = () => {
    setErrorComentario(null)
    setConflicto(null)
    setRevisando(true)
  }

  // Mientras guarda, el modal no se cierra (lo controla ModalRevision).
  function cerrarRevision() {
    setRevisando(false)
    setConflicto(null)
    focoPendiente.current = { destino: 'revisar' }
  }

  const guardando = revisar.isPending

  // El foco, después de que la pantalla se dibuja: a Deshacer al marcarla; a
  // "Marcar revisada" al deshacerla o al cerrar el modal. Si eso ya no está
  // (después de un 409, el mes ya no se revisa), al título.
  useEffect(() => {
    const pendiente = focoPendiente.current
    if (!pendiente) return
    if (pendiente.antes !== undefined && pendiente.antes === data) return
    focoPendiente.current = null
    const elementos = { deshacer: botonDeshacer.current, revisar: botonRevisar.current }
    ;(elementos[pendiente.destino] ?? tituloRef.current)?.focus()
  }, [revisando, data, revisable])

  // Si "Marcar revisada" desaparece con el foco encima (el Detalle volvió a
  // llegar y el mes ya no se revisa), el foco no queda en la nada: va al
  // título.
  const eraRevisable = useRef(revisable)
  useEffect(() => {
    if (eraRevisable.current && !revisable && !revisando && document.activeElement === document.body) {
      tituloRef.current?.focus()
    }
    eraRevisable.current = revisable
  }, [revisable, revisando])

  // ─── Contenido ────────────────────────────────────────────────────────────

  let contenido
  if (isPending) {
    contenido = <CargandoContenido texto="Leyendo lo trabajado en el campo…" />
  } else if (isError && !data) {
    const sinArreglo = error?.status === 404 || error?.status === 422
    contenido = sinArreglo ? (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>
          {error.status === 404 ? 'No se encontró este Cliente' : error.detail?.tipo === 'mes_invalido' ? 'El mes no es válido' : 'El período no es válido'}
        </h2>
        <p className={styles.vacioTexto}>
          {error.message} Volvé al <Link to={RESUMEN} className={styles.enlace}>Resumen</Link> y
          elegí la fila desde ahí.
        </p>
      </div>
    ) : (
      <div className={styles.error} role="alert">
        <Icono nombre="alerta" size={16} enTexto className={styles.errorIcono} />
        <div className={styles.errorTexto}>
          <strong>No se pudo armar el Detalle.</strong>
          <span>{error?.message}</span>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Reintentando…' : 'Reintentar'}
        </button>
      </div>
    )
  } else if (lineas.length === 0) {
    contenido = (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>Sin tareas {parcial ? 'en el período' : 'en el mes'}</h2>
        <p className={styles.vacioTexto}>
          {cliente} no tuvo trabajo facturable en el campo ni Líneas facturadas en {periodoTexto}.
        </p>
      </div>
    )
  } else {
    const total = data.total ?? {}
    const signoTotal = signoDeDiferencia(total.diferencia_pesos)
    contenido = (
      <div className={styles.cuerpo}>
        <div className={styles.tabla}>
          <table>
            <caption className={styles.soloLector}>
              Lo trabajado según el campo contra lo facturado, por grupo de tareas y unidad. Abrí una fila
              para ver sus tareas y tocá una tarea para ver sus partes.
            </caption>
            <thead>
              <tr>
                <th scope="col">Grupo · tarea</th>
                <th scope="col">Unidad</th>
                <th scope="col" className={styles.numero}>Campo</th>
                <th scope="col" className={styles.numero}>Facturado</th>
                <th scope="col" className={styles.numero}>Diferencia</th>
                <th scope="col" className={styles.numero}>Dif. %</th>
                <th scope="col"><span className={styles.soloLector}>Marcas</span></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map((l, i) => {
                const claveLinea = claveDeLinea(l)
                const abierta = abiertas.has(claveLinea)
                const idFila = `fact-detalle-${i}`
                // Un grupo con alguna Línea en parte afuera del filtro no se
                // compara (decisión 7): sin Dif., sin % y sin "Supera".
                const fuera = Boolean(l.fuera_del_filtro)
                const signo = fuera ? null : signoDeDiferencia(l.diferencia)
                const revisada = !fuera && revisadaEnLinea(l, data.revision)
                const clases = [
                  styles.fila, abierta && styles.abierta, !fuera && l.supera && styles.supera,
                ].filter(Boolean).join(' ')
                return (
                  <Fragment key={claveLinea}>
                    <tr className={clases} onClick={() => alternar(claveLinea)}>
                      <td className={styles.grupo}>
                        <button
                          type="button"
                          className={styles.triangulo}
                          aria-expanded={abierta}
                          aria-controls={abierta ? (l.tareas ?? []).map(t => `${idFila}-${t.tarea_id}`).join(' ') : undefined}
                          onClick={e => { e.stopPropagation(); alternar(claveLinea) }}
                        >
                          <Icono nombre="derecha" size={14} className={styles.flecha} />
                          <span>{l.grupo}</span>
                          <span className={styles.soloLector}>, {textoUnidad(l.unidad)}</span>
                        </button>
                      </td>
                      <td className={styles.unidad}>{textoUnidad(l.unidad)}</td>
                      <td className={styles.numero}><Medida valor={l.campo} /></td>
                      <td className={styles.numero}>
                        {fuera ? <span className={styles.fuera}>fuera del filtro</span> : <Medida valor={l.facturado} />}
                      </td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>
                        {fuera ? <span className={styles.vacia}>—</span> : textoDiferencia(l.diferencia)}
                      </td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>
                        {fuera ? <span className={styles.vacia}>—</span> : textoPct(l.diferencia_pct)}
                      </td>
                      <td className={styles.marcas}>
                        {!fuera && l.supera && <span className="badge badge-warn">Supera</span>}
                        {revisada && <span className="badge badge-green">Revisada</span>}
                      </td>
                    </tr>
                    {abierta && <FilasDeTareas linea={l} idFila={idFila} onAbrirPartes={abrirPartes} />}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>{parcial ? 'TOTAL DEL PERÍODO, EN PESOS' : 'TOTAL DEL MES, EN PESOS'}</td>
                <td className={styles.numero}>{formatoPesos(total.campo_pesos)}</td>
                <td className={styles.numero}>{formatoPesos(total.facturado_pesos)}</td>
                <td className={`${styles.numero} ${signoTotal ? styles[signoTotal] : ''}`}>
                  {textoDiferenciaPesos(total.diferencia_pesos)}
                </td>
                <td className={`${styles.numero} ${signoTotal ? styles[signoTotal] : ''}`}>
                  {textoPct(total.diferencia_pct)}
                </td>
                <td className={styles.sinPrecio}>
                  {total.tareas_sin_precio > 0 && (
                    <span title="No suman en pesos: no tienen precio en el mes ni un Precio sugerido.">
                      {tareas_(total.tareas_sin_precio)} sin precio
                    </span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.cabecera}>
        <div className={styles.topbar}>
          <Link to={RESUMEN} className={styles.volver}>
            <Icono nombre="atras" size={14} enTexto /> Resumen
          </Link>
          <h1 ref={tituloRef} tabIndex={-1} className={styles.titulo}>{cliente} · {periodoTexto}</h1>
          {data && <Estados estados={data.estados} />}
          {revisable && (
            <button
              ref={botonRevisar}
              type="button"
              className={`btn btn-sm btn-primary ${styles.revisar}`}
              onClick={abrirRevision}
            >
              Marcar revisada
            </button>
          )}
        </div>
        {data && <Comprobantes comprobantes={data.comprobantes ?? []} enlaces={veComprobantes} parcial={parcial} />}
      </div>

      {enCurso && (
        <div className={`${styles.aviso} ${styles.info}`} role="note">
          <p className={styles.avisoTexto}><strong>{enCurso.titulo}</strong> {enCurso.texto}</p>
        </div>
      )}

      {banner && (
        <div
          className={`${styles.aviso} ${styles[banner.tipo]}`}
          role={banner.tipo === 'ok' ? 'status' : 'note'}
        >
          {banner.tipo === 'warn' && <Icono nombre="alerta" size={16} enTexto className={styles.avisoIcono} />}
          <p className={styles.avisoTexto}><strong>{banner.titulo}</strong> {banner.texto}</p>
          {banner.deshacer && (
            <button
              ref={botonDeshacer}
              type="button"
              className="btn btn-sm"
              // Sin deshabilitarlo mientras guarda, para que no pierda el foco:
              // el overlay del núcleo ya tapa la pantalla.
              onClick={() => { if (!deshacer.isPending) deshacer.mutate({ clienteId, mes, desde, hasta }) }}
              aria-busy={deshacer.isPending}
            >
              {deshacer.isPending ? 'Deshaciendo…' : 'Deshacer'}
            </button>
          )}
        </div>
      )}

      {contenido}

      {partesDe && (
        <ModalPartes
          tarea={partesDe.tarea}
          linea={partesDe.linea}
          mesTexto={periodoTexto}
          onCerrar={cerrarPartes}
        />
      )}

      {/* Queda abierto aunque el Detalle nuevo ya no se pueda revisar: así se
          lee el aviso del 409 hasta "Cerrar". */}
      {revisando && data && (
        <ModalRevision
          superan={superan}
          subtitulo={`${cliente} · ${periodoTexto}`}
          umbralTexto={umbralTexto}
          periodo={periodo}
          comentario={comentario}
          onComentario={texto => { setComentario(texto); setErrorComentario(null) }}
          error={errorComentario}
          guardando={guardando}
          conflicto={conflicto}
          campoRef={campoComentario}
          onConfirmar={confirmarRevision}
          onCerrar={cerrarRevision}
        />
      )}
    </div>
  )
}
