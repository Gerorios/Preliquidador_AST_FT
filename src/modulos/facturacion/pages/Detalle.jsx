import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ETIQUETAS } from '../unidades'
import { formatoPesos } from '../numeros'
import { medidaIlegible, textoMedida, textoUmbral } from '../vistaResumen'
import {
  bannerDeDetalle, puedeRevisar, validarComentario, textoPct, claveDeFila, filasQueSuperan,
  revisadaEnFila, unidadesPorTarea, textoDiferencia, textoDiferenciaPesos, signoDeDiferencia,
  textoComprobante, textoMesLargo,
} from '../detalle'
import PanelPartes from '../components/PanelPartes'
import PanelRevision from '../components/PanelRevision'
import styles from './Detalle.module.css'

// Detalle de un Cliente en un mes (plan E3, FA6; pantallas.md, mockup
// aprobado del Detalle y boceto F0): el Cruce tarea por tarea, de lo
// trabajado según el campo contra lo facturado, con la fila TOTAL en pesos.
// Arriba, el Cliente, el mes, el Estado del mes, los Comprobantes del mes y
// el aviso según el caso. Tocar una tarea abre a la derecha su comparación y
// sus partes del campo; "Marcar revisada" abre ahí mismo el comentario de la
// Revisión de diferencia. No se factura desde acá: se vuelve al Resumen, que
// conserva su período, sus filtros y su orden (estadoPantallas).

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

  // El panel de la derecha: una tarea (su clave) o la Revisión, nunca los dos.
  const [elegida, setElegida] = useState(null)
  const [revisando, setRevisando] = useState(false)
  // El comentario vive acá: cerrar el panel sin querer no lo pierde.
  const [comentario, setComentario] = useState('')
  const [errorComentario, setErrorComentario] = useState(null)

  const tituloRef = useRef(null)
  const botonRevisar = useRef(null)
  const botonDeshacer = useRef(null)
  const campoComentario = useRef(null)
  // Dónde vuelve el foco al cerrar el panel, y a dónde va después de guardar.
  const origen = useRef(null)
  const focoPendiente = useRef(null)

  const filas = useMemo(() => (data?.grupos ?? []).flatMap(g => g.tareas ?? []), [data])
  const tarea = useMemo(() => filas.find(t => claveDeFila(t) === elegida) ?? null, [filas, elegida])
  const superan = useMemo(() => filasQueSuperan(data), [data])
  const unidades = useMemo(() => unidadesPorTarea(data), [data])
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

  // ─── Panel de la derecha ──────────────────────────────────────────────────

  const elegir = (t, boton) => {
    const claveFila = claveDeFila(t)
    origen.current = boton
    setRevisando(false)
    setElegida(actual => (actual === claveFila ? null : claveFila))
  }

  const abrirRevision = () => {
    origen.current = botonRevisar.current
    focoPendiente.current = 'comentario'
    setElegida(null)
    setErrorComentario(null)
    setRevisando(true)
  }

  const cerrarPanel = useCallback(() => {
    setElegida(null)
    setRevisando(false)
    focoPendiente.current = 'origen'
  }, [])

  // Escape cierra el panel abierto, salvo mientras se guarda.
  const panelAbierto = Boolean(tarea) || revisando
  const guardando = revisar.isPending
  useEffect(() => {
    if (!panelAbierto) return undefined
    const alTeclear = e => { if (e.key === 'Escape' && !guardando) cerrarPanel() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [panelAbierto, guardando, cerrarPanel])

  // El foco, después de que la pantalla se dibuja: al comentario al abrir la
  // Revisión; a Deshacer al marcarla; a "Marcar revisada" al deshacer; y, al
  // cerrar el panel, a lo que lo abrió. Si eso ya no está, al título.
  useEffect(() => {
    const destino = focoPendiente.current
    if (!destino) return
    focoPendiente.current = null
    const elementos = {
      comentario: campoComentario.current,
      deshacer: botonDeshacer.current,
      revisar: botonRevisar.current,
      origen: origen.current?.isConnected ? origen.current : (revisable ? botonRevisar.current : null),
    }
    ;(elementos[destino] ?? tituloRef.current)?.focus()
  }, [revisando, elegida, data, revisable])

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
  } else if (filas.length === 0) {
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
      <div className={`${styles.cuerpo} ${panelAbierto ? styles.conPanel : ''}`}>
        <div className={styles.tabla}>
          <table>
            <caption className={styles.soloLector}>
              Lo trabajado según el campo contra lo facturado, por tarea. Tocá una tarea para ver sus partes.
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
            {data.grupos.map(g => (
              <tbody key={g.grupo}>
                <tr className={styles.grupo}>
                  <th scope="rowgroup" colSpan={7}>{g.grupo}</th>
                </tr>
                {(g.tareas ?? []).map(t => {
                  const claveFila = claveDeFila(t)
                  const elegidaAhora = claveFila === elegida && !revisando
                  const signo = signoDeDiferencia(t.diferencia)
                  const enUnidades = unidades.get(t.tarea_id) ?? 1
                  const revisada = revisadaEnFila(t, data.revision)
                  const clases = [
                    styles.fila, elegidaAhora && 'selected', t.supera && styles.supera,
                  ].filter(Boolean).join(' ')
                  return (
                    <tr
                      key={claveFila}
                      className={clases}
                      onClick={e => elegir(t, e.currentTarget.querySelector('button'))}
                    >
                      <td className={styles.tarea}>
                        <button
                          type="button"
                          className={styles.tareaBoton}
                          aria-pressed={elegidaAhora}
                          title={nombreDeTarea(t)}
                          onClick={e => { e.stopPropagation(); elegir(t, e.currentTarget) }}
                        >
                          {nombreDeTarea(t)}
                        </button>
                        {t.sin_unidad_sugerida && <span className={styles.sinUnidad}>Sin Unidad sugerida</span>}
                        {(t.en_varias_unidades || enUnidades > 1) && (
                          <span className={styles.marca}>en {enUnidades > 1 ? enUnidades : 'varias'} unidades</span>
                        )}
                      </td>
                      <td className={styles.unidad}>
                        {t.unidad ? (ETIQUETAS[t.unidad] ?? t.unidad) : <span className={styles.vacia}>—</span>}
                      </td>
                      <td className={styles.numero}><Medida valor={t.campo} /></td>
                      <td className={styles.numero}><Medida valor={t.facturado} /></td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>{textoDiferencia(t.diferencia)}</td>
                      <td className={`${styles.numero} ${signo ? styles[signo] : ''}`}>{textoPct(t.diferencia_pct)}</td>
                      <td className={styles.marcas}>
                        {t.supera && <span className="badge badge-warn">Supera</span>}
                        {revisada && <span className="badge badge-green">Revisada</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
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

        {tarea && !revisando && (
          <PanelPartes
            tarea={tarea}
            mesTexto={mesTexto}
            umbralTexto={umbralTexto}
            onCerrar={cerrarPanel}
          />
        )}

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
    </div>
  )
}
