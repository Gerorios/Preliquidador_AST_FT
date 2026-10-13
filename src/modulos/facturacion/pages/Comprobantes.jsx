import { useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import FiltrosBar from '../../../core/ui/FiltrosBar'
import TablaOrdenable from '../../../core/ui/TablaOrdenable'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import { useEstadoPantalla } from '../../../core/estadoPantallas'
import useAuthStore from '../../../core/authStore'
import { puedeEditar } from '../../../core/permisos'
import { CLAVE_COMPROBANTES, listarComprobantes } from '../services/comprobantes'
import {
  CAMPOS_COMPROBANTES, ALERTAS_COMPROBANTES, filaDelListado,
  filtrarComprobantes, pasaBusquedaYAlertas,
} from '../listado'
import { formatoPesos } from '../numeros'
import styles from './Comprobantes.module.css'

// Listado de Comprobantes (plan E2, FA5): las Facturas y Notas de crédito
// registradas, del más nuevo al más viejo como las manda el backend, con la
// barra común de filtros y una tabla que ordena por cualquier columna. Cada
// fila abre su Comprobante. El listado no lee el sistema de campo (usa las
// copias que guarda cada Comprobante), así que carga rápido aunque el campo
// esté lento.

// "2025-08-20" a "20/08/2025" partiendo el texto: con `new Date` la zona
// horaria puede correr el día.
function textoFecha(fecha) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? '')
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : null
}

const apagado = texto => <span className={styles.apagado}>{texto}</span>

// Columnas de la tabla. `valor` es lo que ordena (las fechas y el mes en ISO,
// para que el orden de texto sea el de la fecha) y `mostrar` lo que se ve.
const COLUMNAS = [
  {
    clave: 'fecha', label: 'Fecha',
    valor: f => f.fecha,
    mostrar: f => textoFecha(f.fecha) ?? apagado('Sin fecha'),
  },
  { clave: 'tipo', label: 'Tipo', valor: f => f.tipo_texto },
  {
    // El número va con sus marcas: la de histórico y, en un histórico sin
    // número posterior al corte, la de Pendiente de facturar.
    clave: 'numero', label: 'Número',
    valor: f => f.numero,
    mostrar: f => (
      <span className={styles.numero}>
        {f.numero ? <span className="mono">{f.numero}</span> : apagado(f.numero_texto)}
        {f.es_historico && <span className="badge badge-muted">Histórico</span>}
        {f.etiqueta && <span className="badge badge-warn">{f.etiqueta}</span>}
      </span>
    ),
  },
  { clave: 'cliente', label: 'Cliente', valor: f => f.cliente_nombre },
  {
    clave: 'empresa', label: 'Empresa emisora',
    valor: f => f.empresa_emisora,
    mostrar: f => f.empresa_emisora ?? apagado(f.empresa_texto ?? '—'),
  },
  { clave: 'mes', label: 'Mes', valor: f => f.mes, mostrar: f => f.mes_texto ?? '—' },
  {
    // A uno sin adjunto se le ve la falta en la fila, con el mismo tono que
    // el botón de Alerta de la barra. Un histórico no la genera.
    clave: 'adjuntos', label: 'Adjuntos', numerica: true,
    valor: f => f.cantidad_adjuntos,
    mostrar: f => f.cantidad_adjuntos > 0
      ? f.cantidad_adjuntos
      : f.es_historico ? apagado('—') : <span className="badge badge-warn">Sin adjunto</span>,
  },
  {
    // Con signo: una Nota de crédito resta.
    clave: 'total', label: 'Total', numerica: true,
    valor: f => Number(f.total_neto),
    mostrar: f => formatoPesos(f.total_neto),
  },
]

const cantidad = n => `${n} ${n === 1 ? 'comprobante' : 'comprobantes'}`

export default function Comprobantes() {
  const navigate = useNavigate()
  const { usuario } = useAuthStore()
  const editable = puedeEditar(usuario, 'facturacion', 'comprobantes')

  // Filtros, búsqueda y orden sobreviven al ir a un Comprobante y volver
  // (estadoPantallas), como en las pantallas de Preliquidación.
  const [filtros, setFiltros] = useEstadoPantalla('facturacion.comprobantes.filtros', {})
  const [busqueda, setBusqueda] = useEstadoPantalla('facturacion.comprobantes.busqueda', '')
  const [orden, setOrden] = useEstadoPantalla('facturacion.comprobantes.orden', null)

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: CLAVE_COMPROBANTES,
    queryFn: listarComprobantes,
  })

  // Las filas pasan por filaDelListado antes de la barra y la tabla: ahí
  // salen los textos que filtran ("Sin empresa", "ago 2025", "Sin adjunto").
  const filas = useMemo(() => (data ?? []).map(filaDelListado), [data])
  const visibles = useMemo(
    () => filtrarComprobantes(filas, busqueda, filtros),
    [filas, busqueda, filtros],
  )
  // Las opciones de cada filtro salen de lo que ya pasa la búsqueda y la Alerta.
  const prefiltro = useCallback(
    f => pasaBusquedaYAlertas(f, busqueda, filtros),
    [busqueda, filtros],
  )

  const abrir = f => navigate(`/facturacion/comprobantes/${f.id}`)

  let contenido
  // isPending y no isLoading: una lectura en pausa o cancelada sin datos queda
  // en pending sin buscar, y con isLoading la pantalla decía "Todavía no hay
  // comprobantes registrados" (revisión de FT-A, RA4).
  if (isPending) {
    contenido = <CargandoContenido texto="Cargando comprobantes…" />
  } else if (isError && !data) {
    // Si ya había datos y falla sólo una actualización de fondo, la tabla
    // sigue a la vista con lo último que llegó.
    contenido = (
      <div className={styles.error} role="alert">
        <Icono nombre="alerta" size={16} enTexto className={styles.errorIcono} />
        <div className={styles.errorTexto}>
          <strong>No se pudieron cargar los comprobantes.</strong>
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
        <h2 className={styles.vacioTitulo}>Todavía no hay comprobantes registrados</h2>
        <p className={styles.vacioTexto}>
          {editable
            ? <>Cada Factura o Nota de crédito que se emite en el sistema contable se registra acá, con sus Líneas copiadas del PDF. Tocá <strong>Nuevo comprobante</strong> para cargar el primero.</>
            : 'Cuando se registre la primera Factura o Nota de crédito, va a aparecer en esta lista.'}
        </p>
        {editable && (
          <Link to="/facturacion/comprobantes/nuevo" className={`btn btn-primary ${styles.enlaceBoton}`}>
            Nuevo comprobante
          </Link>
        )}
      </div>
    )
  } else if (visibles.length === 0) {
    contenido = (
      <div className={styles.vacio}>
        <h2 className={styles.vacioTitulo}>Ningún comprobante coincide</h2>
        <p className={styles.vacioTexto}>
          Ninguno de los {cantidad(filas.length)} cumple la búsqueda y los filtros elegidos.
          Sacá alguno desde <strong>Filtrando por</strong>, o tocá <strong>Limpiar</strong> en la barra para ver todos.
        </p>
      </div>
    )
  } else {
    contenido = (
      <div className={styles.tabla}>
        <TablaOrdenable
          columnas={COLUMNAS}
          filas={visibles}
          claveFila={f => f.id}
          orden={orden}
          onOrden={setOrden}
          onAbrir={abrir}
          etiquetaFila={f => `${f.tipo_texto} ${f.numero_texto} de ${f.cliente_nombre}`}
        />
      </div>
    )
  }

  // Sin Comprobantes (o mientras carga, o si falló) la barra no tiene nada
  // que filtrar: aparece cuando hay filas.
  const hayDatos = filas.length > 0

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <h1 className={styles.titulo}>Comprobantes</h1>
        {hayDatos && (
          <span className={styles.cuenta} aria-live="polite">
            {visibles.length === filas.length
              ? cantidad(filas.length)
              : `${visibles.length} de ${cantidad(filas.length)}`}
          </span>
        )}
        {editable && (
          <Link to="/facturacion/comprobantes/nuevo" className={`btn btn-primary ${styles.nuevo} ${styles.enlaceBoton}`}>
            Nuevo comprobante
          </Link>
        )}
      </div>

      {hayDatos && (
        <FiltrosBar
          datos={filas}
          campos={CAMPOS_COMPROBANTES}
          alertas={ALERTAS_COMPROBANTES}
          filtros={filtros}
          onChange={setFiltros}
          busqueda={busqueda}
          onBusqueda={setBusqueda}
          prefiltro={prefiltro}
          placeholderBusqueda="Buscar por número o cliente..."
        />
      )}

      {contenido}
    </div>
  )
}
