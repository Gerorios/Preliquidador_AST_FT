import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import Icono from '../../../core/ui/iconos'
import {
  CLAVE_COMPROBANTES, claveComprobante, subirAdjunto, verAdjunto, quitarAdjunto,
} from '../services/comprobantes'
import { EXTENSIONES, MAXIMO_POR_COMPROBANTE, mensajeDeAdjunto, validarArchivo } from '../adjuntos'
import styles from './Adjuntos.module.css'

// Los Adjuntos de un Comprobante (plan E2, FB2): el PDF o la imagen de lo que
// se emitió, hasta 5. Quien puede Editar sube y quita, también en un histórico
// (que no se edita, pero sus adjuntos sí); quien sólo Ve, mira la lista y abre
// cada archivo.
//
// La lista sale del detalle del Comprobante (la query de la página). Subir o
// quitar actualiza sólo `adjuntos` y `cantidad_adjuntos` de ese detalle en la
// caché, sin volver a pedirlo: el backend no cambia el `actualizado_en`, así
// que el formulario no se vuelve a montar (su key) ni pierde lo que se está
// editando, que vive en su propio estado y sólo se arma al montarse.

const TIPOS = { 'application/pdf': 'PDF', 'image/png': 'PNG', 'image/jpeg': 'JPG' }
// La pestaña nueva sólo muestra estos tipos, los que el backend detecta por
// contenido. Cualquier otro se descarga: la URL del Blob es de este sitio, y un
// HTML abierto ahí podría leer la sesión.
const TIPOS_QUE_SE_ABREN = Object.keys(TIPOS)
// La URL del archivo se libera a los 5 minutos: alcanza para que la pestaña lo
// cargue y para usar "Descargar" del visor de PDF, sin guardar en memoria cada
// archivo abierto hasta cerrar el sistema.
const LIBERAR_URL_EN = 5 * 60_000

function tamanoLegible(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  const formato = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 })
  if (bytes < 1024 * 1024) return `${formato.format(bytes / 1024)} KB`
  return `${formato.format(bytes / (1024 * 1024))} MB`
}

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
})

// `subido_en` llega en UTC y sin zona (como todas las fechas de alta del
// backend): se lee como UTC y se muestra en la hora de la PC.
function fechaHora(texto) {
  if (!texto) return ''
  const conZona = /(Z|[+-]\d{2}:?\d{2})$/i.test(texto) ? texto : `${texto}Z`
  const fecha = new Date(conZona)
  return Number.isNaN(fecha.getTime()) ? texto : FORMATO_FECHA_HORA.format(fecha)
}

function descargar(url, nombre) {
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre || 'adjunto'
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
}

export default function Adjuntos({ comprobante, editable }) {
  const qc = useQueryClient()
  const id = comprobante?.id
  const adjuntos = comprobante?.adjuntos ?? []
  const cantidad = adjuntos.length
  const lleno = cantidad >= MAXIMO_POR_COMPROBANTE

  const entrada = useRef(null)
  const botonSubir = useRef(null)
  const [error, setError] = useState(null)
  const [confirmandoQuitar, setConfirmandoQuitar] = useState(null)
  const [abriendo, setAbriendo] = useState(null)

  // Sólo la lista de adjuntos del detalle, y su cantidad: el resto del
  // Comprobante queda como está (ver arriba). El listado se invalida por su
  // columna de adjuntos y la Alerta "Sin adjunto".
  const cambiarLista = (cambio) => {
    let cantidadNueva = null
    qc.setQueryData(claveComprobante(id), (previo) => {
      if (!previo) return previo
      const lista = cambio(previo.adjuntos ?? [])
      cantidadNueva = lista.length
      return { ...previo, adjuntos: lista, cantidad_adjuntos: lista.length }
    })
    qc.invalidateQueries({ queryKey: CLAVE_COMPROBANTES })
    return cantidadNueva
  }

  // Después de subir o quitar, el foco vuelve a "Subir archivo" (que estuvo
  // deshabilitado mientras tanto), o al título si se llegó al máximo. Lo hace
  // el efecto de abajo, recién en el render que ya muestra la lista nueva:
  // antes, "Subir archivo" puede seguir deshabilitado por la lista vieja.
  const focoPendiente = useRef(null)
  const devolverFoco = (cantidadEsperada) => {
    focoPendiente.current = cantidadEsperada
  }

  const mutSubir = useMutation({
    mutationFn: (archivo) => subirAdjunto(id, archivo),
    onSuccess: (nuevo) => {
      devolverFoco(cambiarLista(lista => [...lista, nuevo]))
      toast.success('Adjunto subido')
    },
    onError: (e) => {
      setError(mensajeDeAdjunto(e))
      devolverFoco(cantidad)
    },
  })

  const mutQuitar = useMutation({
    mutationFn: (adjunto) => quitarAdjunto(id, adjunto.id),
    onSuccess: (_, adjunto) => {
      setConfirmandoQuitar(null)
      devolverFoco(cambiarLista(lista => lista.filter(a => a.id !== adjunto.id)))
      toast.success('Adjunto quitado')
    },
    onError: (e) => {
      setConfirmandoQuitar(null)
      setError(mensajeDeAdjunto(e))
    },
  })

  const ocupado = mutSubir.isPending || mutQuitar.isPending
  useEffect(() => {
    if (focoPendiente.current == null || ocupado || cantidad !== focoPendiente.current) return
    focoPendiente.current = null
    const boton = botonSubir.current
    if (boton && !boton.disabled) boton.focus()
    else document.getElementById('titulo-adjuntos')?.focus()
  })

  const elegirArchivo = () => {
    setError(null)
    setConfirmandoQuitar(null)
    entrada.current?.click()
  }

  const alElegir = (e) => {
    const archivo = e.target.files?.[0]
    // Se vacía para que elegir el mismo archivo otra vez vuelva a avisar.
    e.target.value = ''
    if (!archivo) return
    const problema = validarArchivo(archivo, cantidad)
    if (problema) {
      setError(problema)
      return
    }
    mutSubir.mutate(archivo)
  }

  const ver = async (adjunto) => {
    setError(null)
    // La pestaña se abre acá, en el mismo clic: un window.open después del
    // await lo frena el bloqueador de ventanas emergentes, porque ya no viene
    // de un clic. Se le asigna el archivo cuando llega. Sin `noopener` en el
    // open (devolvería null y no se le podría asignar nada); se corta el
    // vínculo a mano.
    const pestana = window.open('', '_blank')
    if (pestana) {
      pestana.opener = null
      try {
        pestana.document.title = 'Abriendo el adjunto…'
        pestana.document.body.textContent = `Abriendo ${adjunto.nombre_original}…`
      } catch {
        // Si el navegador no deja escribir en la pestaña, queda en blanco
        // hasta que llega el archivo.
      }
    }
    setAbriendo(adjunto.id)
    try {
      const datos = await verAdjunto(id, adjunto.id)
      const tipo = TIPOS_QUE_SE_ABREN.includes(adjunto.tipo_contenido) ? adjunto.tipo_contenido : null
      const url = URL.createObjectURL(new Blob([datos], { type: tipo ?? 'application/octet-stream' }))
      setTimeout(() => URL.revokeObjectURL(url), LIBERAR_URL_EN)
      if (pestana && tipo) {
        // Si la persona cerró la pestaña mientras cargaba, no se abre nada.
        if (!pestana.closed) pestana.location.href = url
      } else {
        pestana?.close()
        descargar(url, adjunto.nombre_original)
        if (!pestana) toast('El navegador no dejó abrir una pestaña nueva: el archivo se descargó.')
      }
    } catch (e) {
      pestana?.close()
      setError(mensajeDeAdjunto(e))
    } finally {
      setAbriendo(null)
    }
  }

  // ─── Alta: todavía no hay Comprobante al que adjuntarle nada ───
  if (id == null) {
    return (
      <section className={styles.seccion} aria-labelledby="titulo-adjuntos">
        <div className={styles.encabezado}>
          <h2 id="titulo-adjuntos" className={styles.subtitulo}>Adjuntos</h2>
        </div>
        <p className={styles.vacio}>
          El PDF o la imagen del comprobante se adjuntan después de guardarlo.
        </p>
      </section>
    )
  }

  const subiendo = mutSubir.isPending

  return (
    <section className={styles.seccion} aria-labelledby="titulo-adjuntos">
      <div className={styles.encabezado}>
        <h2 id="titulo-adjuntos" className={styles.subtitulo} tabIndex={-1}>Adjuntos</h2>
        <span className={`${styles.contador} ${lleno ? styles.contadorLleno : ''}`}>
          {cantidad} de {MAXIMO_POR_COMPROBANTE}
        </span>
        {editable && (
          <span className={styles.ayuda}>PDF, PNG o JPG, de hasta 10 MB. Se guardan al subirlos.</span>
        )}
        {editable && (
          <div className={styles.accion}>
            {lleno && (
              <span id="motivo-no-subir" className={styles.motivo}>
                Tiene el máximo de {MAXIMO_POR_COMPROBANTE} adjuntos. Quitá uno para subir otro.
              </span>
            )}
            <input
              ref={entrada}
              type="file"
              accept={EXTENSIONES.join(',')}
              className={styles.entrada}
              tabIndex={-1}
              aria-hidden="true"
              onChange={alElegir}
            />
            <button
              ref={botonSubir}
              type="button"
              className="btn"
              disabled={lleno || subiendo}
              aria-describedby={lleno ? 'motivo-no-subir' : undefined}
              onClick={elegirArchivo}
            >
              {subiendo && <span className={`spinner ${styles.spinner}`} aria-hidden="true" />}
              {subiendo ? 'Subiendo…' : 'Subir archivo'}
            </button>
          </div>
        )}
      </div>

      {error && (
        <p className={styles.error} role="alert">
          <Icono nombre="alerta" size={14} enTexto className={styles.errorIcono} />
          <span>{error}</span>
          <button type="button" className={styles.cerrarError} onClick={() => setError(null)}>
            Cerrar
          </button>
        </p>
      )}

      {/* Sin adjunto, un Comprobante lo marca con el tono de aviso; un histórico
          no, igual que en el listado, donde nunca dice "Sin adjunto". */}
      {cantidad === 0 && !comprobante.es_historico ? (
        <p className={`${styles.vacio} ${styles.vacioAviso}`}>
          <Icono nombre="alerta" size={14} enTexto className={styles.vacioIcono} />
          <span>
            Falta el adjunto.
            {editable && ' Subí el PDF o la imagen del comprobante.'}
          </span>
        </p>
      ) : cantidad === 0 ? (
        <p className={styles.vacio}>
          Sin adjuntos.
          {editable && ' Subí el PDF o la imagen del comprobante.'}
        </p>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th scope="col">Archivo</th>
              <th scope="col" className={styles.colTipo}>Tipo</th>
              <th scope="col" className={`${styles.colTamano} ${styles.numerica}`}>Tamaño</th>
              <th scope="col" className={styles.colFecha}>Subido</th>
              <th scope="col" className={styles.colAcciones}><span className={styles.oculto}>Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {adjuntos.map(a => (
              <FilaAdjunto
                key={a.id}
                adjunto={a}
                editable={editable}
                abriendo={abriendo === a.id}
                confirmando={confirmandoQuitar === a.id}
                onVer={() => ver(a)}
                onPedirQuitar={() => { setError(null); setConfirmandoQuitar(a.id) }}
                onCancelarQuitar={() => setConfirmandoQuitar(null)}
                onQuitar={() => mutQuitar.mutate(a)}
                quitando={mutQuitar.isPending}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function FilaAdjunto({
  adjunto, editable, abriendo, confirmando, onVer, onPedirQuitar, onCancelarQuitar, onQuitar, quitando,
}) {
  // Al cancelar, el foco vuelve a su "Quitar", deshabilitado mientras se
  // confirmaba: después del render que lo habilita, no antes.
  const botonQuitar = useRef(null)
  const volverFoco = useRef(false)
  const cancelar = () => {
    volverFoco.current = true
    onCancelarQuitar()
  }
  useEffect(() => {
    if (!confirmando && volverFoco.current) {
      volverFoco.current = false
      botonQuitar.current?.focus()
    }
  }, [confirmando])
  return (
    <>
      <tr className={`${styles.fila} ${confirmando ? styles.filaConfirmando : ''}`}>
        <td className={styles.nombre}>{adjunto.nombre_original}</td>
        <td>{TIPOS[adjunto.tipo_contenido] ?? adjunto.tipo_contenido}</td>
        <td className={styles.numerica}>{tamanoLegible(adjunto.tamano_bytes)}</td>
        <td>{fechaHora(adjunto.subido_en)}</td>
        <td>
          <div className={styles.acciones}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={onVer}
              disabled={abriendo}
              aria-label={`Ver ${adjunto.nombre_original} en una pestaña nueva`}
            >
              {abriendo ? 'Abriendo…' : 'Ver'}
            </button>
            {editable && (
              <button
                ref={botonQuitar}
                type="button"
                className="btn btn-sm"
                onClick={onPedirQuitar}
                disabled={confirmando}
                aria-label={`Quitar ${adjunto.nombre_original}`}
              >
                Quitar
              </button>
            )}
          </div>
        </td>
      </tr>
      {confirmando && (
        <tr className={styles.fila}>
          <td colSpan={5} className={styles.celdaConfirmacion}>
            <div className={styles.confirmacion} role="alert">
              <span>
                ¿Quitar <strong>{adjunto.nombre_original}</strong>? Se borra el archivo del sistema y no se puede deshacer.
              </span>
              <button type="button" className="btn btn-sm btn-danger" onClick={onQuitar} disabled={quitando}>
                Sí, quitar
              </button>
              <button type="button" className="btn btn-sm" autoFocus onClick={cancelar}>
                Cancelar
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
