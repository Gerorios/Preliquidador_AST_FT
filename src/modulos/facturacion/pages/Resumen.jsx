import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import FiltrosBar from '../../../core/ui/FiltrosBar'
import { EncabezadoOrdenable } from '../../../core/ui/TablaOrdenable'
import { ordenarFilas } from '../../../core/ui/ordenarFilas'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import { useEstadoPantalla } from '../../../core/estadoPantallas'
import useAuthStore from '../../../core/authStore'
import { puedeEditar } from '../../../core/permisos'
import { claveResumen, obtenerResumen } from '../services/resumen'
import { ATAJO_INICIAL, MESES_MAXIMOS, rangoValido } from '../periodo'
import { ESTADOS, accionDeFila, estadoMasUrgente, rutaDelDetalle } from '../estados'
import {
  CAMPOS_RESUMEN, filaDelResumen, datosParaFiltros, filtrarResumen, contarAlertas, totales,
} from '../resumen'
import { horaDeLectura, medidaVacia, periodoElegido, textoMedida } from '../vistaResumen'
import { formatoPesos } from '../numeros'
import CuadrosAlertas from '../components/CuadrosAlertas'
import EtiquetasEstado from '../components/EtiquetasEstado'
import SelectorMeses from '../components/SelectorMeses'
import AvisoSinUnidad from '../components/AvisoSinUnidad'
import PieConfiguracion from '../components/PieConfiguracion'
import styles from './Resumen.module.css'

// Resumen de Facturación (plan E3, FA5; pantallas.md, mockup aprobado y
// boceto F0): una fila por mes y Cliente con lo trabajado según el campo, lo
// facturado (neto) y el Estado del mes. Arriba, los cuadros de Alertas, que
// filtran la tabla; la barra común con el período y los filtros de Mes,
// Cliente y Estado; y el aviso de tareas sin Unidad sugerida. La fila TOTAL
// queda fija abajo y el pie dice cómo se controla. Lo trabajado sale del
// sistema de campo, que es lento: la hora de la lectura se ve arriba a la
// derecha, con "Volver a leer".

// Las medidas de la tabla, en el orden del mockup: lo trabajado según el campo.
const MEDIDAS = [
  { clave: 'horas_peon', label: 'Horas peón' },
  { clave: 'horas_tractor', label: 'Horas tractor' },
  { clave: 'tancadas', label: 'Tancadas' },
  { clave: 'plantas', label: 'Plantas' },
  { clave: 'hectareas', label: 'Hectáreas' },
]

// Para ordenar: los decimales como número; vacío, al final (ordenarFilas).
const numero = texto => (texto == null || texto === '' ? null : Number(texto))

// `valor` es lo que ordena. El Estado ordena por urgencia (el más urgente
// primero) y el Mes en ISO, así el orden de texto es el de la fecha.
const COLUMNAS = [
  { clave: 'mes', label: 'Mes', valor: f => f.mes },
  { clave: 'cliente', label: 'Cliente', valor: f => f.cliente_nombre },
  ...MEDIDAS.map(m => ({ ...m, numerica: true, valor: f => numero(f[m.clave]) })),
  { clave: 'facturado', label: 'Facturado', numerica: true, valor: f => numero(f.facturado_neto) },
  { clave: 'estado', label: 'Estado', valor: f => ESTADOS[estadoMasUrgente(f.estados)]?.orden ?? null },
]

// Para el chip "Alerta: …" de la barra cuando un cuadro filtra. Los botones
// de alerta de la barra no se muestran: esa tarea la hacen los cuadros.
const ALERTAS = ['pendiente_de_facturar', 'con_diferencia', 'falta_comprobante']
  .map(clave => ({ value: clave, label: ESTADOS[clave].etiqueta }))

// Antes del corte y Mes en curso van en gris: muestran sus números y suman en
// el TOTAL, pero no se controlan (o, en el mes en curso, sólo el PDF).
const esGris = f => (f.estados ?? []).some(e => e === 'mes_en_curso' || e === 'antes_del_corte')

const filas_ = n => `${n} ${n === 1 ? 'fila' : 'filas'}`

const nombreCliente = f => f.cliente_nombre ?? `Cliente ${f.cliente_id}`

function Medida({ valor }) {
  return medidaVacia(valor)
    ? <span className={styles.vacia}>—</span>
    : textoMedida(valor)
}

export default function Resumen() {
  const qc = useQueryClient()
  const { usuario } = useAuthStore()
  const editaComprobantes = puedeEditar(usuario, 'facturacion', 'comprobantes')
  // El Umbral y el Mes de corte los cambia sólo el Admin (plan E3, decisión
  // 4), como decide el núcleo.
  const esAdmin = usuario?.rol === 'admin'

  // Período, filtros y orden sobreviven al ir a un Detalle o a un Comprobante
  // y volver (estadoPantallas).
  const [periodo, setPeriodo] = useEstadoPantalla('facturacion.resumen.periodo', { atajo: ATAJO_INICIAL })
  const [filtros, setFiltros] = useEstadoPantalla('facturacion.resumen.filtros', {})
  const [orden, setOrden] = useEstadoPantalla('facturacion.resumen.orden', null)

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
  const ordenadas = useMemo(() => ordenarFilas(visibles, COLUMNAS, orden), [visibles, orden])
  const cuenta = useMemo(() => contarAlertas(filas, filtros), [filas, filtros])
  const total = useMemo(() => totales(visibles), [visibles])
  // Con un cuadro elegido, las opciones de la barra salen de las filas que
  // tienen esa Alerta.
  const prefiltro = useCallback(
    f => !filtros.alerta || (f.estados ?? []).includes(filtros.alerta),
    [filtros.alerta],
  )
  const elegirAlerta = alerta => setFiltros(f => ({ ...f, alerta }))

  const hayDatos = valido && Boolean(data)
  const hora = horaDeLectura(data?.leido_en)

  let contenido
  if (!valido) {
    contenido = (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>Revisá el período</h2>
        <p className={styles.vacioTexto}>
          Elegí Desde y Hasta: Hasta no puede ser anterior a Desde ni posterior al mes en curso,
          y el período abarca {MESES_MAXIMOS} meses como máximo.
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
          Ningún Cliente tuvo trabajo en el campo ni Comprobantes en esos meses. Elegí otro
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
          <caption className={styles.soloLector}>Resumen por mes y Cliente</caption>
          <thead>
            <tr>
              {COLUMNAS.map(c => <EncabezadoOrdenable key={c.clave} columna={c} orden={orden} onOrden={setOrden} />)}
              <th scope="col"><span className={styles.soloLector}>Acción</span></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map(f => {
              const accion = accionDeFila(f, editaComprobantes)
              return (
                <tr key={`${f.cliente_id}-${f.mes}`} className={esGris(f) ? styles.gris : undefined}>
                  <td className={`mono ${styles.mes}`}>{f.mes_texto ?? f.mes}</td>
                  <td className={styles.cliente}>
                    <Link to={rutaDelDetalle(f)} className={styles.linkCliente}>{nombreCliente(f)}</Link>
                  </td>
                  {MEDIDAS.map(m => (
                    <td key={m.clave} className={styles.numero}><Medida valor={f[m.clave]} /></td>
                  ))}
                  <td className={styles.numero}>
                    {medidaVacia(f.facturado_neto)
                      ? <span className={styles.vacia}>—</span>
                      : formatoPesos(f.facturado_neto)}
                  </td>
                  <td><EtiquetasEstado fila={f} puedeEditarComprobantes={editaComprobantes} /></td>
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
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>TOTAL · {filas_(total.cantidad)}</td>
              {MEDIDAS.map(m => (
                <td key={m.clave} className={styles.numero}><Medida valor={total[m.clave]} /></td>
              ))}
              <td className={styles.numero}>{formatoPesos(total.facturado_neto)}</td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.titulo}>Resumen</h1>
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
