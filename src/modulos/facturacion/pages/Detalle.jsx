import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
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
  textoComprobante, textoMesLargo,
} from '../detalle'
import ModalPartes from '../components/ModalPartes'
import PanelRevision from '../components/PanelRevision'
import styles from './Detalle.module.css'

// Detalle de un Cliente en un mes (plan E3, FA6; spec de la E3a por grupo,
// decisiones 1, 3 y 4): el Cruce por (grupo de tareas, unidad), de lo
// trabajado según el campo contra lo facturado, con la fila TOTAL en pesos.
// Arriba, el Cliente, el mes, el Estado del mes, los Comprobantes del mes y
// el aviso según el caso. Las filas arrancan cerradas: el triángulo abre las
// tareas de la fila con su cantidad del campo, y el nombre de una tarea abre
// el modal con sus partes. "Marcar revisada" abre a la derecha el comentario
// de la Revisión de diferencia (su modal es del Ticket 3). No se factura desde
// acá: se vuelve al Resumen, que conserva su período, sus filtros y su orden
// (estadoPantallas).

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

// Los Comprobantes del mes: links al Comprobante sólo con Ver en
// `comprobantes`; si no, el texto. Uno que pide su PDF lo dice al lado.
function Comprobantes({ comprobantes, enlaces }) {
  if (!comprobantes.length) {
    return <p className={styles.comprobantes}>Sin Comprobantes en el mes.</p>
  }
  return (
    <p className={styles.comprobantes}>
      <span className={styles.comprobantesTitulo}>Comprobantes del mes:</span>
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
  const qc = useQueryClient()
  const { usuario } = useAuthStore()
  const editaResumen = puedeEditar(usuario, 'facturacion', 'resumen')
  const veComprobantes = puedeVer(usuario, 'facturacion', 'comprobantes')

  const clave = claveDetalle(clienteId, mes)
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: clave,
    queryFn: () => obtenerDetalle({ clienteId, mes }),
  })

  // Las filas abiertas, por su clave (grupo, unidad): todas arrancan cerradas.
  const [abiertas, setAbiertas] = useState(() => new Set())
  // La tarea del modal de partes, con su fila: { linea, tarea } o null.
  const [partesDe, setPartesDe] = useState(null)
  // El panel de la derecha: la Revisión.
  const [revisando, setRevisando] = useState(false)
  // El comentario vive acá: cerrar el panel sin querer no lo pierde.
  const [comentario, setComentario] = useState('')
  const [errorComentario, setErrorComentario] = useState(null)

  const tituloRef = useRef(null)
  const botonRevisar = useRef(null)
  const botonDeshacer = useRef(null)
  const campoComentario = useRef(null)
  // A dónde va el foco después de abrir o cerrar la Revisión, o de guardar.
  const focoPendiente = useRef(null)

  const lineas = data?.grupos ?? []
  const superan = useMemo(() => lineasQueSuperan(data), [data])
  const banner = bannerDeDetalle(data, editaResumen)
  const revisable = puedeRevisar(data, editaResumen)
  const umbralTexto = textoUmbral(data?.umbral_pct)
  const mesTexto = textoMesLargo(mes)
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
      setRevisando(false)
      qc.invalidateQueries({ queryKey: CLAVE_RESUMEN })
    }
  }

  const revisar = useMutation({
    mutationFn: dejarRevision,
    onSuccess: detalle => {
      alGuardar(detalle)
      setRevisando(false)
      setComentario('')
      setErrorComentario(null)
      focoPendiente.current = 'deshacer'
      toast.success('Marcada como revisada')
    },
    onError: e => {
      if (e.detail?.tipo === 'revision_invalida') {
        setErrorComentario(e.message)
        campoComentario.current?.focus()
      } else {
        alFallar(e, 'No se pudo marcar revisada.')
      }
    },
  })

  const deshacer = useMutation({
    mutationFn: deshacerRevision,
    onSuccess: detalle => {
      alGuardar(detalle)
      focoPendiente.current = 'revisar'
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
    revisar.mutate({ clienteId, mes, comentario: comentario.trim() })
  }

  // ─── Filas, modal de partes y panel de la Revisión ────────────────────────

  const alternar = claveLinea => setAbiertas(actuales => alternarAbierta(actuales, claveLinea))

  // El modal guarda el foco que había al abrir (el nombre de la tarea) y lo
  // devuelve al cerrar.
  const abrirPartes = (linea, tarea) => setPartesDe({ linea, tarea })
  const cerrarPartes = useCallback(() => setPartesDe(null), [])

  const abrirRevision = () => {
    focoPendiente.current = 'comentario'
    setErrorComentario(null)
    setRevisando(true)
  }

  const cerrarPanel = useCallback(() => {
    setRevisando(false)
    focoPendiente.current = 'revisar'
  }, [])

  // Escape cierra el panel de la Revisión, salvo mientras se guarda o con el
  // modal de partes abierto (Escape cierra el modal, no los dos).
  const guardando = revisar.isPending
  const modalAbierto = Boolean(partesDe)
  useEffect(() => {
    if (!revisando || modalAbierto) return undefined
    const alTeclear = e => { if (e.key === 'Escape' && !guardando) cerrarPanel() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [revisando, modalAbierto, guardando, cerrarPanel])

  // El foco, después de que la pantalla se dibuja: al comentario al abrir la
  // Revisión; a Deshacer al marcarla; a "Marcar revisada" al deshacer o al
  // cerrar el panel. Si eso ya no está, al título.
  useEffect(() => {
    const destino = focoPendiente.current
    if (!destino) return
    focoPendiente.current = null
    const elementos = {
      comentario: campoComentario.current,
      deshacer: botonDeshacer.current,
      revisar: botonRevisar.current,
    }
    ;(elementos[destino] ?? tituloRef.current)?.focus()
  }, [revisando, data, revisable])

  // ─── Contenido ────────────────────────────────────────────────────────────

  let contenido
  if (isPending) {
    contenido = <CargandoContenido texto="Leyendo lo trabajado en el campo…" />
  } else if (isError && !data) {
    const sinArreglo = error?.status === 404 || error?.status === 422
    contenido = sinArreglo ? (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>
          {error.status === 404 ? 'No se encontró este Cliente' : 'El mes no es válido'}
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
        <h2 className={styles.vacioTitulo}>Sin tareas en el mes</h2>
        <p className={styles.vacioTexto}>
          {cliente} no tuvo trabajo facturable en el campo ni Líneas facturadas en {mesTexto}.
        </p>
      </div>
    )
  } else {
    const total = data.total ?? {}
    const signoTotal = signoDeDiferencia(total.diferencia_pesos)
    contenido = (
      <div className={`${styles.cuerpo} ${revisando ? styles.conPanel : ''}`}>
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
                const signo = signoDeDiferencia(l.diferencia)
                const revisada = revisadaEnLinea(l, data.revision)
                const clases = [
                  styles.fila, abierta && styles.abierta, l.supera && styles.supera,
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
                      <td className={styles.numero}><Medida valor={l.facturado} /></td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>{textoDiferencia(l.diferencia)}</td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>{textoPct(l.diferencia_pct)}</td>
                      <td className={styles.marcas}>
                        {l.supera && <span className="badge badge-warn">Supera</span>}
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
                <td colSpan={2}>TOTAL DEL MES, EN PESOS</td>
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

        {revisando && revisable && (
          <PanelRevision
            superan={superan}
            subtitulo={`${cliente} · ${mesTexto}`}
            umbralTexto={umbralTexto}
            comentario={comentario}
            onComentario={texto => { setComentario(texto); setErrorComentario(null) }}
            error={errorComentario}
            guardando={guardando}
            campoRef={campoComentario}
            onConfirmar={confirmarRevision}
            onCancelar={cerrarPanel}
          />
        )}
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
          <h1 ref={tituloRef} tabIndex={-1} className={styles.titulo}>{cliente} · {mesTexto}</h1>
          {data && <Estados estados={data.estados} />}
          {revisable && !revisando && (
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
        {data && <Comprobantes comprobantes={data.comprobantes ?? []} enlaces={veComprobantes} />}
      </div>

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
              onClick={() => { if (!deshacer.isPending) deshacer.mutate({ clienteId, mes }) }}
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
          mesTexto={mesTexto}
          onCerrar={cerrarPartes}
        />
      )}
    </div>
  )
}
