import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import FiltrosBar from '../../../core/ui/FiltrosBar'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import { useEstadoPantalla } from '../../../core/estadoPantallas'
import useAuthStore from '../../../core/authStore'
import { puedeEditar } from '../../../core/permisos'
import { claveResumen, obtenerResumen } from '../services/resumen'
import { ATAJO_INICIAL, MESES_MAXIMOS, rangoValido } from '../periodo'
import { ESTADOS, accionDeFila, rutaDelDetalle } from '../estados'
import {
  CAMPOS_RESUMEN, filaDelResumen, datosParaFiltros, filtrarResumen, contarAlertas, ordenarResumen,
} from '../resumen'
import {
  OTRO_PERIODO, horaDeLectura, medidaIlegible, medidaVacia, periodoElegido, textoMedida, textoUnidad,
} from '../vistaResumen'
import { signoDeDiferencia, textoDiferencia, textoPct } from '../detalle'
import { avisoFueraDelFiltro } from '../fueraDelFiltro'
import CuadrosAlertas from '../components/CuadrosAlertas'
import EtiquetasEstado from '../components/EtiquetasEstado'
import SelectorMeses from '../components/SelectorMeses'
import AvisoSinUnidad from '../components/AvisoSinUnidad'
import AvisoFueraDelFiltro from '../components/AvisoFueraDelFiltro'
import PieConfiguracion from '../components/PieConfiguracion'
import styles from './Resumen.module.css'

// Resumen de Facturación (plan E3, FA5; pantallas.md, mockup aprobado y
// boceto de la E3a por grupo; spec de la E3a por grupo, Ticket 1): un bloque
// por mes y Cliente, con un encabezado que lleva el Estado del mes y la acción,
// y debajo una línea por grupo de tareas y unidad con Campo, Facturado, Dif. y
// Dif. %. Sólo cantidades: sin pesos ni fila TOTAL. El orden es fijo, sin
// ordenar por columna (decisión 2): el mes más nuevo, el Estado más urgente y
// el Cliente; las líneas vienen ordenadas del backend. Arriba, los cuadros de
// Alertas, que filtran la tabla; la barra común con el período y los filtros
// de Mes, Cliente y Estado; y el aviso de tareas sin Unidad sugerida. El pie
// dice cómo se controla. Lo trabajado sale del sistema de campo, que es lento:
// la hora de la lectura se ve arriba a la derecha, con "Volver a leer".
//
// El filtro es por día (Ticket 4 de la spec de la E3a por grupo): cada fila
// sigue siendo un mes y un Cliente, con el filtro recortado a ese mes. Una
// Línea que cae en parte afuera no cuenta: su grupo dice "fuera del filtro" y
// el bloque lleva, debajo del encabezado, el aviso con el botón que pasa el
// filtro al período de esas Líneas.

// Las columnas de las líneas que van a la derecha.
const COLUMNAS_LINEA = ['Campo', 'Facturado', 'Dif.', 'Dif. %']

// Todas las columnas: Mes, Cliente, Grupo de tareas, Unidad, las de la línea,
// Estado y Acción. El aviso de lo que no entra va a todo el ancho.
const COLUMNAS = 4 + COLUMNAS_LINEA.length + 2

// Para el chip "Alerta: …" de la barra cuando un cuadro filtra. Los botones
// de alerta de la barra no se muestran: esa tarea la hacen los cuadros.
const ALERTAS = ['pendiente_de_facturar', 'con_diferencia', 'falta_comprobante']
  .map(clave => ({ value: clave, label: ESTADOS[clave].etiqueta }))

// Antes del corte va en gris: muestra sus líneas con la Dif., pero no se
// controla, así que ninguna avisa. Un período en curso se controla igual
// (plan del 2026-10-17): no va en gris, lleva la etiqueta "En curso".
const esGris = f => (f.estados ?? []).includes('antes_del_corte')

const filas_ = n => `${n} ${n === 1 ? 'fila' : 'filas'}`

const nombreCliente = f => f.cliente_nombre ?? `Cliente ${f.cliente_id}`

// Una cantidad de una línea. Con `conCero` (el Campo, que se compara con lo
// facturado) el cero se muestra; la raya queda para lo que no hay: el Campo
// de una línea sin unidad o lo Facturado en cero.
function Medida({ valor, conCero = false }) {
  const raya = conCero ? medidaIlegible(valor) : medidaVacia(valor)
  return raya
    ? <span className={styles.vacia}>—</span>
    : textoMedida(valor, { conCero })
}

const Raya = () => <span className={styles.vacia}>—</span>

// Una línea (grupo, unidad) del bloque. En un mes en gris, sin tono en la
// Dif. ni "Supera". Un grupo con alguna Línea que cae en parte afuera del
// filtro no se compara (decisión 7): Facturado dice "fuera del filtro" en
// gris, y la Dif. y el % van con raya.
function Linea({ linea, gris }) {
  const fuera = Boolean(linea.fuera_del_filtro)
  const signo = gris || fuera ? null : signoDeDiferencia(linea.diferencia)
  const tono = signo ? ` ${styles[signo]}` : ''
  return (
    <tr className={styles.linea}>
      <td colSpan={2} />
      <td className={styles.grupo}>{linea.grupo}</td>
      <td className={linea.unidad ? styles.unidad : styles.sinUnidad}>{textoUnidad(linea.unidad)}</td>
      <td className={styles.numero}><Medida valor={linea.campo} conCero /></td>
      <td className={styles.numero}>
        {fuera ? <span className={styles.fuera}>fuera del filtro</span> : <Medida valor={linea.facturado} />}
      </td>
      <td className={`${styles.numero}${tono}`}>{fuera ? <Raya /> : textoDiferencia(linea.diferencia)}</td>
      <td className={`${styles.numero}${tono}`}>{fuera ? <Raya /> : textoPct(linea.diferencia_pct)}</td>
      <td>{!gris && !fuera && linea.supera && <span className="badge badge-warn">Supera</span>}</td>
      <td />
    </tr>
  )
}

export default function Resumen() {
  const qc = useQueryClient()
  const { usuario } = useAuthStore()
  const editaComprobantes = puedeEditar(usuario, 'facturacion', 'comprobantes')
  // El Umbral y el Mes de corte los cambia sólo el Admin (plan E3, decisión
  // 4), como decide el núcleo.
  const esAdmin = usuario?.rol === 'admin'

  // Período y filtros sobreviven al ir a un Detalle o a un Comprobante y
  // volver (estadoPantallas).
  const [periodo, setPeriodo] = useEstadoPantalla('facturacion.resumen.periodo', { atajo: ATAJO_INICIAL })
  const [filtros, setFiltros] = useEstadoPantalla('facturacion.resumen.filtros', {})

  // El día de hoy fija los atajos y el tope de los meses. Se toma una vez por
  // visita a la pantalla.
  const [hoy] = useState(() => new Date())
  const { desde, hasta } = periodoElegido(periodo, hoy)
  const valido = rangoValido(desde, hasta, hoy)
  const clave = claveResumen(desde, hasta)

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: clave,
    queryFn: () => obtenerResumen({ desde, hasta }),
    enabled: valido,
  })

  // "Volver a leer" pide lo mismo con refrescar=true (el backend vacía su
  // caché del campo) y deja la respuesta en la clave del período. Es una
  // lectura: no pasa por el overlay de escrituras, el link dice "Leyendo…".
  const [releyendo, setReleyendo] = useState(false)
  const volverALeer = async () => {
    setReleyendo(true)
    try {
      qc.setQueryData(clave, await obtenerResumen({ desde, hasta, refrescar: true }))
    } catch (e) {
      toast.error(`No se pudo volver a leer el campo. ${e.message}`)
    } finally {
      setReleyendo(false)
    }
  }

  const filas = useMemo(() => (data?.filas ?? []).map(filaDelResumen), [data])
  const datosBarra = useMemo(() => datosParaFiltros(filas), [filas])
  const visibles = useMemo(() => filtrarResumen(filas, filtros), [filas, filtros])
  const ordenadas = useMemo(() => ordenarResumen(visibles), [visibles])
  const cuenta = useMemo(() => contarAlertas(filas, filtros), [filas, filtros])
  // Con un cuadro elegido, las opciones de la barra salen de las filas que
  // tienen esa Alerta.
  const prefiltro = useCallback(
    f => !filtros.alerta || (f.estados ?? []).includes(filtros.alerta),
    [filtros.alerta],
  )
  const elegirAlerta = alerta => setFiltros(f => ({ ...f, alerta }))
  // El botón del aviso pasa el filtro al período de lo que no entra, como un
  // Otro período: el campo muestra Desde y Hasta y el calendario los marca, para
  // ajustarlo. La tabla se desmonta mientras carga y el botón se va con ella: el
  // foco pasa al título, para que el próximo Tab siga en el selector del período
  // y no vuelva al principio de la página.
  const tituloRef = useRef(null)
  const verPeriodo = ({ desde: d, hasta: h }) => {
    setPeriodo({ atajo: OTRO_PERIODO, desde: d, hasta: h })
    tituloRef.current?.focus()
  }

  const hayDatos = valido && Boolean(data)
  const hora = horaDeLectura(data?.leido_en)

  let contenido
  if (!valido) {
    contenido = (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>Revisá el período</h2>
        <p className={styles.vacioTexto}>
          El período abarca {MESES_MAXIMOS} meses como máximo. Abrí el calendario y elegí uno
          más corto.
        </p>
      </div>
    )
  } else if (isPending) {
    contenido = <CargandoContenido texto="Leyendo lo trabajado en el campo…" />
  } else if (isError && !data) {
    // Si ya había datos y falla sólo una actualización de fondo, la tabla
    // sigue a la vista con lo último que llegó.
    contenido = (
      <div className={styles.error} role="alert">
        <Icono nombre="alerta" size={16} enTexto className={styles.errorIcono} />
        <div className={styles.errorTexto}>
          <strong>No se pudo armar el Resumen.</strong>
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
        <h2 className={styles.vacioTitulo}>Sin trabajo ni comprobantes en el período</h2>
        <p className={styles.vacioTexto}>
          Ningún Cliente tuvo trabajo en el campo ni Comprobantes en esas fechas. Elegí otro
          período en la barra.
        </p>
      </div>
    )
  } else if (visibles.length === 0) {
    contenido = (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>Nada con estos filtros</h2>
        <p className={styles.vacioTexto}>
          Ninguna de las {filas_(filas.length)} cumple los filtros elegidos. Sacá alguno
          desde <strong>Filtrando por</strong>, tocá de nuevo el cuadro elegido o
          tocá <strong>Limpiar</strong> en la barra.
        </p>
      </div>
    )
  } else {
    contenido = (
      <div className={styles.tabla}>
        <table>
          <caption className={styles.soloLector}>
            Resumen por mes y Cliente, con una línea por grupo de tareas y unidad
          </caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Cliente</th>
              <th scope="col">Grupo de tareas</th>
              <th scope="col">Unidad</th>
              {COLUMNAS_LINEA.map(c => <th key={c} scope="col" className={styles.numero}>{c}</th>)}
              <th scope="col">Estado</th>
              <th scope="col"><span className={styles.soloLector}>Acción</span></th>
            </tr>
          </thead>
          {ordenadas.map(f => {
            const accion = accionDeFila(f, editaComprobantes)
            const gris = esGris(f)
            const aviso = avisoFueraDelFiltro(f)
            return (
              <tbody key={`${f.cliente_id}-${f.mes}`} className={gris ? styles.gris : undefined}>
                <tr className={styles.bloque}>
                  <td className={`mono ${styles.mes}`}>{f.mes_texto ?? f.mes}</td>
                  <th scope="rowgroup" className={styles.cliente}>
                    <Link to={rutaDelDetalle(f)} className={styles.linkCliente}>{nombreCliente(f)}</Link>
                  </th>
                  <td colSpan={2 + COLUMNAS_LINEA.length} />
                  <td className={styles.estado}>
                    <EtiquetasEstado fila={f} puedeEditarComprobantes={editaComprobantes} />
                  </td>
                  <td className={styles.accion}>
                    <Link
                      to={accion.destino}
                      className={`btn btn-sm ${accion.primaria ? 'btn-primary' : ''} ${styles.enlaceBoton}`}
                      aria-label={`${accion.texto}: ${nombreCliente(f)}, ${f.mes_texto ?? f.mes}`}
                    >
                      {accion.texto}
                    </Link>
                  </td>
                </tr>
                {aviso && (
                  <tr className={styles.filaAviso}>
                    <td colSpan={COLUMNAS}><AvisoFueraDelFiltro aviso={aviso} onVer={verPeriodo} /></td>
                  </tr>
                )}
                {(f.grupos ?? []).map(l => (
                  <Linea key={`${l.grupo}|${l.unidad ?? ''}`} linea={l} gris={gris} />
                ))}
              </tbody>
            )
          })}
        </table>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 ref={tituloRef} tabIndex={-1} className={styles.titulo}>Resumen</h1>
        {hayDatos && filas.length > 0 && (
          <span className="badge badge-muted" aria-live="polite">
            {visibles.length === filas.length
              ? filas_(filas.length)
              : `${visibles.length} de ${filas_(filas.length)}`}
          </span>
        )}
        {hayDatos && (
          <span className={styles.lectura}>
            {hora && <>Datos del campo de las <span className="mono">{hora}</span> ·</>}
            <button type="button" className={styles.link} onClick={volverALeer} disabled={releyendo}>
              {releyendo ? 'Leyendo…' : 'Volver a leer'}
            </button>
          </span>
        )}
      </div>

      {hayDatos && filas.length > 0 && (
        <CuadrosAlertas cuenta={cuenta} activa={filtros.alerta} onElegir={elegirAlerta} />
      )}

      <FiltrosBar
        datos={datosBarra}
        campos={CAMPOS_RESUMEN}
        alertas={ALERTAS}
        filtros={filtros}
        onChange={setFiltros}
        mostrarAlertas={false}
        mostrarBusqueda={false}
        prefiltro={prefiltro}
        quincena={<SelectorMeses valor={periodo} onChange={setPeriodo} hoy={hoy} />}
      />

      {hayDatos && <AvisoSinUnidad tareas={data.tareas_sin_unidad} />}

      {contenido}

      {hayDatos && (
        <PieConfiguracion
          umbral={data.umbral_pct}
          mesCorte={data.mes_corte}
          mesEnCurso={data.mes_en_curso}
          esAdmin={esAdmin}
          ultimoCambio={data}
        />
      )}
    </div>
  )
}
