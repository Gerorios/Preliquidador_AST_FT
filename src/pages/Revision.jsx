import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarLineas, obtenerEstadisticas,
  actualizarLinea, eliminarConcepto,
  recalcularPrecios, listarPreliquidaciones, aplicarConceptos,
} from '../services/preliquidacion'
import PanelLinea from '../components/preliquidacion/PanelLinea'
import PanelPrecios from '../components/preliquidacion/PanelPrecios'
import FiltrosBar from '../components/preliquidacion/FiltrosBar'
import AlertasBanner from '../components/preliquidacion/AlertasBanner'
import styles from './Revision.module.css'

export default function Revision() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [filtros, setFiltros] = useState({})
  const [lineaSeleccionada, setLineaSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarPanelPrecios, setMostrarPanelPrecios] = useState(false)

  // Obtener datos de la preliquidación para pasar la quincena al panel
  const { data: preliqData } = useQuery({
    queryKey: ['preliq', id],
    queryFn: () => import('../services/preliquidacion').then(m =>
      m.listarPreliquidaciones().then(list => list.find(p => String(p.id) === String(id)))
    ),
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', id],
    queryFn: () => obtenerEstadisticas(id),
    refetchInterval: 10_000,
  })

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['lineas', id, filtros],
    queryFn: () => listarLineas(id, filtros),
  })

  const lineasFiltradas = useMemo(() => {
    let resultado = lineas

    // Filtro de búsqueda libre
    if (busqueda) {
      const q = busqueda.toLowerCase()
      resultado = resultado.filter(l =>
        l.nombre_empleado?.toLowerCase().includes(q) ||
        l.legajo_campo?.toLowerCase().includes(q) ||
        l.legajo_asignado?.toLowerCase().includes(q) ||
        l.nombre_tarea?.toLowerCase().includes(q) ||
        l.nombre_cliente?.toLowerCase().includes(q) ||
        l.nombre_finca?.toLowerCase().includes(q)
      )
    }

    // Filtros de desplegable
    if (filtros.cliente)    resultado = resultado.filter(l => l.nombre_cliente === filtros.cliente)
    if (filtros.finca)      resultado = resultado.filter(l => l.nombre_finca === filtros.finca)
    if (filtros.tarea)      resultado = resultado.filter(l => l.nombre_tarea === filtros.tarea)
    if (filtros.empresa)    resultado = resultado.filter(l => l.empresa_asignada === filtros.empresa)
    if (filtros.grupo_pago) resultado = resultado.filter(l => l.grupo_pago_aplicado === filtros.grupo_pago)
    if (filtros.supervisor) resultado = resultado.filter(l => l.nombre_supervisor === filtros.supervisor)
    if (filtros.revisado != null && filtros.revisado !== undefined) {
      const rev = filtros.revisado === 'true' || filtros.revisado === true
      resultado = resultado.filter(l => l.revisado === rev)
    }

    // Filtro de alerta específica
    if (filtros.alerta === 'sin_precio')     resultado = resultado.filter(l => l.alerta_sin_precio)
    if (filtros.alerta === 'alerta_legajo')  resultado = resultado.filter(l => l.alerta_legajo)
    if (filtros.alerta === 'alerta_empresa') resultado = resultado.filter(l => l.alerta_empresa)
    if (filtros.alerta === 'es_duplicado')   resultado = resultado.filter(l => l.es_duplicado)

    return resultado
  }, [lineas, busqueda, filtros])

  // Helper: refresca la query de líneas ESPERANDO la respuesta del servidor
  // (a diferencia de invalidateQueries, que solo marca stale y no espera el
  // refetch — por eso el panel mostraba datos viejos hasta la próxima acción)
  // y sincroniza el panel abierto con los datos frescos.
  const refrescarYSincronizarPanel = async () => {
    // refetchQueries espera el refetch real (a diferencia de invalidateQueries,
    // que solo marca stale y no espera) pero no devuelve los datos —
    // hay que leerlos del cache DESPUÉS de que el await resuelva.
    await qc.refetchQueries({ queryKey: ['lineas', id], exact: false })
    const lineasFrescas = qc.getQueryData(['lineas', id, filtros])
    if (lineasFrescas && lineaSeleccionada) {
      const lineFresca = lineasFrescas.find(l => l.id === lineaSeleccionada.id)
      if (lineFresca) setLineaSeleccionada(lineFresca)
    }
    qc.invalidateQueries(['stats', id])
  }

  const { mutate: recalcular, isPending: recalculando } = useMutation({
    mutationFn: () => recalcularPrecios(id),
    onSuccess: async (data) => {
      toast.success(data.detalle || 'Precios recalculados')
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: aplicarConc, isPending: aplicandoConceptos } = useMutation({
    mutationFn: () => aplicarConceptos(id),
    onSuccess: async (data) => {
      toast.success(data.detalle || 'Conceptos aplicados')
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const { mutate: guardar, isPending: guardando } = useMutation({
    mutationFn: ({ lineaId, datos }) => actualizarLinea(lineaId, datos),
    onSuccess: async (data) => {
      toast.success('Línea actualizada')
      setLineaSeleccionada(data)  // datos frescos del servidor con importe recalculado
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  // Al agregar concepto por código, refrescamos y actualizamos el panel con datos frescos.
  // Usa refetchQueries (espera la respuesta real) en vez de invalidateQueries
  // (que solo marca stale y deja la lectura inmediata con datos viejos).
  const handleConceptoAgregado = async () => {
    toast.success('Concepto agregado')
    await refrescarYSincronizarPanel()
  }

  const { mutate: delConcepto } = useMutation({
    mutationFn: (conceptoId) => eliminarConcepto(conceptoId),
    onSuccess: async () => {
      toast.success('Concepto eliminado')
      await refrescarYSincronizarPanel()
    },
    onError: (err) => toast.error(err.message),
  })

  const claseLinea = (linea) => {
    if (linea.es_duplicado) return 'duplicado'
    if (linea.alerta_sin_precio) return 'alerta'
    if (linea.alerta_legajo || linea.alerta_empresa) return 'alerta'
    if (linea.revisado) return 'revisada'
    return ''
  }

  const iconoAlerta = (linea) => {
    if (linea.es_duplicado) return { icon: '⧉', color: 'var(--danger)', title: 'Duplicado' }
    if (linea.alerta_sin_precio) return { icon: '$', color: 'var(--warn)', title: 'Sin precio' }
    if (linea.alerta_legajo) return { icon: '#', color: 'var(--warn)', title: 'Legajo inválido' }
    if (linea.alerta_empresa) return { icon: '!', color: 'var(--info)', title: 'Verificar empresa' }
    return null
  }

  return (
    <div className={styles.page}>
      {/* Topbar */}
      <div className={styles.topbar}>
        <button className="btn btn-sm" onClick={() => navigate('/dashboard')}>
          ← Volver
        </button>
        <div className={styles.topbarInfo}>
          {stats && (
            <>
              <span className="badge badge-muted mono">{stats.total_lineas} líneas</span>
              <span className="badge badge-green mono">{stats.lineas_revisadas} revisadas</span>
              {stats.lineas_con_alerta > 0 &&
                <span className="badge badge-warn mono">{stats.lineas_con_alerta} alertas</span>
              }
            </>
          )}
        </div>
        <button
          className="btn btn-sm"
          onClick={() => navigate(`/verificacion/${id}`)}
          title="Controles de verificación: excesos de horas, tancadas, plantas y resumen por empleado"
        >
          ⚑ Verificación
        </button>
        <button
          className="btn btn-sm"
          onClick={() => recalcular()}
          disabled={recalculando}
          title="Aplica los precios cargados a las lineas que aun no tienen precio"
        >
          {recalculando ? <><span className="spinner" /> Recalculando...</> : '↻ Aplicar precios'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => aplicarConc()}
          disabled={aplicandoConceptos}
          title="Aplica las reglas del maestro de conceptos a las lineas que matcheen"
        >
          {aplicandoConceptos ? <><span className="spinner" /> Aplicando...</> : '↻ Aplicar conceptos'}
        </button>
        <button className="btn btn-primary btn-sm">
          ↓ Exportar Excel
        </button>
      </div>

      {/* Banners */}
      <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {stats?.sin_precio > 0 && (
          <div style={{
            background: 'var(--warn-dim)', borderBottom: '1px solid rgba(232,168,74,0.3)',
            padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 12,
            fontSize: 12, color: 'var(--warn)',
          }}>
            <span>⚠</span>
            <span><strong>{stats.sin_precio} líneas sin precio</strong> — cargá los precios para calcular los importes</span>
            <button
              onClick={() => setMostrarPanelPrecios(true)}
              style={{
                marginLeft: 'auto', background: 'var(--warn)', border: 'none',
                color: 'var(--bg-base)', cursor: 'pointer', fontSize: 11,
                fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-sm)',
              }}
            >
              Cargar precios →
            </button>
          </div>
        )}
        {stats?.lineas_con_alerta > 0 && stats?.sin_precio === 0 && (
          <AlertasBanner
            total={stats.lineas_con_alerta}
            sinPrecio={stats.sin_precio}
            duplicados={stats.duplicados}
            alertaLegajo={stats.alerta_legajo}
            onFiltrar={() => setFiltros(f => ({ ...f, solo_alertas: true }))}
          />
        )}
      </div>

      <div className={styles.layout}>
        {/* Tabla */}
        <div className={styles.tablePane}>
          <FiltrosBar
            lineas={lineas}
            filtros={filtros}
            onChange={setFiltros}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
          />

          {isLoading ? (
            <div className={styles.loading}><span className="spinner" /> Cargando líneas...</div>
          ) : (
            <div className="table-wrap" style={{ flex: 1, overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>✓</th>
                    <th>FECHA</th>
                    <th>EMPLEADO</th>
                    <th>LEGAJO</th>
                    <th>EMPRESA</th>
                    <th>TAREA</th>
                    <th>CLIENTE · FINCA</th>
                    <th>GRUPO PAGO</th>
                    <th title="Horas jornal">HS. JORN.</th>
                    <th title="Horas máquina">HS. MAQ.</th>
                    <th title="Tancadas">TANC.</th>
                    <th title="Unidades / plantas / bins">UNID.</th>
                    <th>PRECIO A</th>
                    <th>IMPORTE</th>
                    <th>BONOS</th>
                  </tr>
                </thead>
                <tbody>
                  {lineasFiltradas.map(linea => (
                    <tr
                      key={linea.id}
                      className={claseLinea(linea)}
                      onClick={() => setLineaSeleccionada(linea)}
                      style={lineaSeleccionada?.id === linea.id
                        ? { outline: '1px solid var(--accent)', outlineOffset: '-1px' }
                        : {}
                      }
                    >
                      <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div className={`${styles.check} ${linea.revisado ? styles.checkDone : ''}`}>
                          {linea.revisado ? '✓' : ''}
                        </div>
                        {(() => { const a = iconoAlerta(linea); return a ? (
                          <span title={a.title} style={{ fontSize: 10, color: a.color, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{a.icon}</span>
                        ) : null })()}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {linea.fecha_tarea || '—'}
                      </td>
                      <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linea.nombre_empleado || '—'}
                      </td>
                      <td className="mono">{linea.legajo_asignado || linea.legajo_campo}</td>
                      <td>
                        <span className="badge badge-muted">{linea.empresa_asignada || '—'}</span>
                      </td>
                      <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {linea.nombre_tarea || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {linea.nombre_cliente} · {linea.nombre_finca}
                      </td>
                      <td>
                        {linea.alerta_sin_precio
                          ? <span className="badge badge-warn">SIN PRECIO</span>
                          : <span className="badge badge-muted mono">{linea.grupo_pago_aplicado || '—'}</span>
                        }
                      </td>
                      {/* Columnas de cantidad — siempre visibles */}
                      <td className="mono">{fmt(linea.hsjornal)}</td>
                      <td className="mono">{fmt(linea.hsmaquina)}</td>
                      <td className="mono">{fmt(linea.tancadas)}</td>
                      <td className="mono">{fmt(linea.unidades)}</td>
                      <td className="mono">
                        {linea.precio_a ? `$${Number(linea.precio_a).toLocaleString('es-AR')}` : '—'}
                      </td>
                      <td className="mono" style={{ fontWeight: 500 }}>
                        {linea.importe_total
                          ? `$${Number(linea.importe_total).toLocaleString('es-AR')}`
                          : '—'
                        }
                      </td>
                      <td>
                        {linea.conceptos?.length > 0
                          ? <span className="badge badge-info">+{linea.conceptos.length}</span>
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lineasFiltradas.length === 0 && (
                <div className={styles.empty}>Sin resultados para los filtros aplicados.</div>
              )}
            </div>
          )}
        </div>

        {/* Panel de precios */}
        {mostrarPanelPrecios && (
          <PanelPrecios
            preliqId={id}
            quincena={preliqData?.quincena}
            onCerrar={() => setMostrarPanelPrecios(false)}
            onPreciosCargados={() => {
              qc.invalidateQueries(['lineas', id])
              qc.invalidateQueries(['stats', id])
            }}
          />
        )}

        {/* Panel lateral de línea */}
        {!mostrarPanelPrecios && lineaSeleccionada && (
          <PanelLinea
            linea={lineaSeleccionada}
            onGuardar={(datos) => guardar({ lineaId: lineaSeleccionada.id, datos })}
            onConceptoAgregado={handleConceptoAgregado}
            onEliminarConcepto={(conceptoId) => delConcepto(conceptoId)}
            onCerrar={() => setLineaSeleccionada(null)}
            guardando={guardando}
          />
        )}
      </div>
    </div>
  )
}

function fmt(v) {
  if (v === null || v === undefined || v === '' || Number(v) === 0) return '—'
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 2 })
}