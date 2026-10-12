import { useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import useAuthStore from '../../../core/authStore'
import { puedeEditar } from '../../../core/permisos'
import { mensajeDeError } from '../../../core/mensajeError'
import { listarTareas, definirTarea } from '../services/facturacion'
import {
  UNIDADES, UNIDADES_COSECHA, ETIQUETAS,
  VALOR_SIN_DEFINIR, VALOR_NO_FACTURABLE,
  valorDeTarea, cuerpoDesdeValor, etiquetaDe, filtrarTareas, contarSinDefinir,
  vecinoAlSalir, recorreConTecla,
} from '../unidades'
import styles from './UnidadFacturacion.module.css'

// Pantalla Unidad de medida por defecto: cada tarea activa del sistema de campo
// con su Unidad sugerida o la marca No facturable. El backend ya las manda con
// las sin definir primero (plan E1, contrato 2.5).

const CLAVE_TAREAS = ['facturacion', 'tareas']
const AGRICOLAS = UNIDADES.filter(u => !UNIDADES_COSECHA.includes(u))

export default function UnidadFacturacion() {
  const qc = useQueryClient()
  const { usuario } = useAuthStore()
  // Definir la unidad es la única escritura de la pantalla (el backend la pide
  // con Editar en facturacion.unidad). Con sólo Ver, la unidad va como texto.
  const editable = puedeEditar(usuario, 'facturacion', 'unidad')

  const [texto, setTexto] = useState('')
  const [soloSinDefinir, setSoloSinDefinir] = useState(false)

  // Lo elegido con el teclado y todavía sin guardar, por tarea: el select lo
  // muestra hasta que se guarda o falla. Con el mouse vive sólo mientras se
  // guarda, para que el select no vuelva un instante al valor anterior.
  const [pendientes, setPendientes] = useState({})
  // Lo que ya salió al backend, por tarea: salir del select no lo manda dos veces.
  const enviados = useRef(new Map())
  // Si el último cambio del select vino de una tecla que recorre opciones.
  const porTeclado = useRef(false)
  const selects = useRef(new Map())
  const chipRef = useRef(null)

  // Vuelve a leer al volver a la pestaña, sólo esta pantalla (el núcleo lo
  // apaga para todas): dos contadoras pueden cargar a la vez, y así se ve lo
  // que guardó la otra. Si las dos tocan la misma tarea, gana la última que
  // guarda (plan E1, 3.7).
  const {
    data: tareas = [], isLoading, isError, error, refetch, isFetching,
  } = useQuery({ queryKey: CLAVE_TAREAS, queryFn: listarTareas, refetchOnWindowFocus: true })

  const visibles = useMemo(
    () => filtrarTareas(tareas, { texto, soloSinDefinir }),
    [tareas, texto, soloSinDefinir],
  )
  const sinDefinir = contarSinDefinir(tareas)

  // Al guardar se reemplaza el ítem en el caché con lo que devuelve el PATCH,
  // sin volver a leer: releer el campo es lento y reordenaría la lista bajo el
  // cursor (plan E1, D8; el precedente es Revisión). La lista entera se vuelve
  // a leer sólo al volver a la pestaña (ver la consulta). El overlay
  // "Procesando" lo pone el Layout mientras dura la escritura.
  const mutDefinir = useMutation({
    mutationFn: ({ tareaId, valor }) => definirTarea(tareaId, cuerpoDesdeValor(valor)),
    onSuccess: (data) => {
      const filtros = { texto, soloSinDefinir }
      const antes = qc.getQueryData(CLAVE_TAREAS) ?? []
      const despues = antes.map(t => (t.tarea_id === data.tarea_id ? data : t))
      // Con "Sólo sin definir" la tarea sale de la vista y su select se
      // desmonta: si el foco estaba ahí, pasa a la tarea que queda en su lugar
      // o, si no queda ninguna, al chip. Si la persona ya se fue a otro lado,
      // no se le mueve el foco.
      const select = selects.current.get(data.tarea_id)
      if (select && document.activeElement === select) {
        const { sale, vecino } = vecinoAlSalir(
          filtrarTareas(antes, filtros), filtrarTareas(despues, filtros), data.tarea_id,
        )
        if (sale) (vecino !== null ? selects.current.get(vecino) : chipRef.current)?.focus()
      }
      qc.setQueryData(CLAVE_TAREAS, despues)
      toast.success(`${data.nombre}: ${etiquetaDe(data)}`)
    },
    onError: (err) => toast.error(err.message),
    onSettled: (_data, _err, { tareaId, valor }) => {
      enviados.current.delete(tareaId)
      // Si mientras se guardaba se eligió otra cosa con el teclado, queda pendiente.
      setPendientes(p => {
        if (p[tareaId] !== valor) return p
        const { [tareaId]: _, ...resto } = p
        return resto
      })
    },
  })

  const quitarPendiente = (tareaId) => setPendientes(p => {
    if (!(tareaId in p)) return p
    const { [tareaId]: _, ...resto } = p
    return resto
  })

  // Si el valor es el guardado no se manda nada; si ya salió, tampoco. Lo
  // guardado se lee del caché y no de la fila del último render, que puede
  // estar un paso atrás justo después de un guardado.
  const guardar = (tarea, valor) => {
    const guardada = qc.getQueryData(CLAVE_TAREAS)?.find(t => t.tarea_id === tarea.tarea_id) ?? tarea
    if (valor === valorDeTarea(guardada)) {
      quitarPendiente(tarea.tarea_id)
      return
    }
    if (enviados.current.get(tarea.tarea_id) === valor) return
    enviados.current.set(tarea.tarea_id, valor)
    mutDefinir.mutate({ tareaId: tarea.tarea_id, valor })
  }

  // Con el mouse (o eligiendo en la lista abierta) se guarda al elegir. Con
  // las flechas, Inicio/Fin o letras sobre el select cerrado, cada tecla
  // dispara un cambio: queda pendiente y se guarda al salir o con Enter.
  const cambiar = (tarea, valor) => {
    const conTeclado = porTeclado.current
    porTeclado.current = false
    setPendientes(p => ({ ...p, [tarea.tarea_id]: valor }))
    if (!conTeclado) guardar(tarea, valor)
  }

  const guardarPendiente = (tarea) => {
    if (tarea.tarea_id in pendientes) guardar(tarea, pendientes[tarea.tarea_id])
  }

  return (
    <div className={styles.page}>
      <header className={styles.encabezado}>
        <h1>Unidad de medida por defecto</h1>
        <p className={styles.explicacion}>
          Cada tarea del sistema de campo con la unidad en que se factura por defecto. La tarea
          que no se le factura a ningún cliente se marca No facturable.
        </p>
      </header>

      {isLoading ? (
        <CargandoContenido texto="Leyendo las tareas del sistema de campo…" />
      ) : isError ? (
        <div className={styles.aviso} role="alert">
          <Icono nombre="alerta" size={16} enTexto className={styles.avisoIcono} />
          <span className={styles.avisoTexto}>
            No se pudieron leer las tareas. {mensajeDeError(error?.detail) || error?.message}
          </span>
          <button className="btn btn-sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? <><span className="spinner" /> Reintentando…</> : 'Reintentar'}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.barra}>
            <label className={styles.busqueda}>
              <Icono nombre="buscar" size={15} className={styles.busquedaIcono} />
              <input
                className={`input ${styles.busquedaInput}`}
                placeholder="Buscar por tarea o grupo de tareas…"
                aria-label="Buscar por tarea o grupo de tareas"
                value={texto}
                onChange={e => setTexto(e.target.value)}
              />
            </label>
            <button
              ref={chipRef}
              type="button"
              className={`chip ${soloSinDefinir ? 'chip-active' : ''} ${styles.chip}`}
              aria-pressed={soloSinDefinir}
              onClick={() => setSoloSinDefinir(!soloSinDefinir)}
            >
              Sólo sin definir
            </button>
            <span className={styles.resumen}>
              {sinDefinir > 0 ? (
                <>
                  <Icono nombre="alerta" size={15} enTexto className={styles.resumenIconoFalta} />
                  <strong>{sinDefinir}</strong> {sinDefinir === 1 ? 'tarea sin definir' : 'tareas sin definir'}
                </>
              ) : (
                <>
                  <Icono nombre="tilde" size={15} enTexto className={styles.resumenIconoOk} />
                  Todas las tareas están definidas
                </>
              )}
              <span className={styles.conteo}>
                {visibles.length === tareas.length
                  ? `${tareas.length} tareas`
                  : `${visibles.length} de ${tareas.length} tareas`}
              </span>
            </span>
          </div>

          <div className={styles.content}>
            {visibles.length === 0 ? (
              <div className={styles.vacio}>
                {tareas.length === 0
                  ? 'El sistema de campo no tiene tareas activas.'
                  : soloSinDefinir && !texto
                    ? 'No quedan tareas sin definir.'
                    : 'Ninguna tarea coincide con la búsqueda.'}
              </div>
            ) : (
              <div className="table-wrap">
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>Tarea</th>
                      <th>Grupo de tareas</th>
                      <th>Unidad sugerida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map(t => (
                      <tr key={t.tarea_id} className={t.sin_definir ? 'alerta' : undefined}>
                        <td>{t.nombre}</td>
                        <td className={t.grupo_tarea ? undefined : styles.sinDato}>{t.grupo_tarea || '—'}</td>
                        <td>
                          {editable ? (
                            <select
                              ref={el => {
                                if (el) selects.current.set(t.tarea_id, el)
                                else selects.current.delete(t.tarea_id)
                              }}
                              className={`input ${styles.unidad} ${t.sin_definir ? styles.unidadSinDefinir : ''}`}
                              aria-label={`Unidad sugerida de ${t.nombre}`}
                              value={pendientes[t.tarea_id] ?? valorDeTarea(t)}
                              onKeyDown={e => {
                                porTeclado.current = recorreConTecla(e)
                                if (e.key === 'Enter') guardarPendiente(t)
                              }}
                              onPointerDown={() => { porTeclado.current = false }}
                              onChange={e => cambiar(t, e.target.value)}
                              onBlur={() => guardarPendiente(t)}
                            >
                              <option value={VALOR_SIN_DEFINIR}>Sin definir</option>
                              {AGRICOLAS.map(u => <option key={u} value={u}>{ETIQUETAS[u]}</option>)}
                              <optgroup label="Cosecha">
                                {UNIDADES_COSECHA.map(u => <option key={u} value={u}>{ETIQUETAS[u]}</option>)}
                              </optgroup>
                              <option value={VALOR_NO_FACTURABLE}>No facturable</option>
                            </select>
                          ) : (
                            <span className={
                              t.sin_definir ? styles.textoSinDefinir
                                : t.no_facturable ? styles.textoNoFacturable : undefined
                            }>
                              {etiquetaDe(t)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
