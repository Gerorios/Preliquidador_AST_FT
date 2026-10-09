import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  listarPreliquidaciones, listarOperariosMantenimiento,
  setCategoriaOperario, heredarCategoriasOperario,
} from '../services/preliquidacion'
import { claves } from '../services/claves'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import FiltrosBar from '../components/FiltrosBar'
import AvisoError from '../components/AvisoError'
import SelectorQuincena from '../components/SelectorQuincena'
import styles from './CategoriasOperarios.module.css'
import { useEstadoPantalla } from '../estadoPantallas'

const CATEGORIAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

export default function CategoriasOperarios() {
  const qc = useQueryClient()
  const [elegida, setElegida] = useEstadoPantalla('mantenimiento.quincena', null)
  const [busqueda, setBusqueda] = useEstadoPantalla('mantenimiento.busqueda', '')

  const {
    data: preliquidaciones = [],
    isLoading: cargandoQuincenas,
    isError: errorQuincenas,
  } = useQuery({
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
  })
  // Arranca en la quincena más nueva, como el resto de las pantallas.
  const preliqId = elegida ?? preliquidaciones[0]?.id ?? null

  const { data: operarios = [], isLoading } = useQuery({
    queryKey: ['operarios-mantenimiento', preliqId],
    queryFn: () => listarOperariosMantenimiento(preliqId),
    enabled: !!preliqId,
  })

  const operariosFiltrados = useMemo(() => {
    if (!busqueda) return operarios
    const q = busqueda.toLowerCase()
    return operarios.filter(o =>
      o.nombre_empleado?.toLowerCase().includes(q) ||
      o.cuil?.toLowerCase?.().includes(q) ||
      String(o.cuil ?? '').includes(q) ||
      String(o.legajo ?? '').includes(q)
    )
  }, [operarios, busqueda])

  const mutCategoria = useMutation({
    mutationFn: ({ cuil, categoria }) => setCategoriaOperario(preliqId, cuil, categoria),
    onSuccess: () => {
      toast.success('Categoría actualizada')
      qc.invalidateQueries({ queryKey: ['operarios-mantenimiento', preliqId] })
    },
    onError: err => toast.error(err.message),
  })

  const mutHeredar = useMutation({
    mutationFn: () => heredarCategoriasOperario(preliqId),
    onSuccess: (data) => {
      toast.success(`Se heredaron ${data.heredados} categoría(s) de la quincena anterior`)
      qc.invalidateQueries({ queryKey: ['operarios-mantenimiento', preliqId] })
    },
    onError: err => toast.error(err.message),
  })

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Categorías de operarios de mantenimiento</div>
      </div>

      <FiltrosBar
        key={preliqId}
        datos={operarios}
        campos={[]}
        filtros={{}}
        onChange={() => {}}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        mostrarAlertas={false}
        mostrarBusqueda={!!preliqId}
        placeholderBusqueda="Buscar por nombre, CUIL o legajo..."
        quincena={(
          <SelectorQuincena
            preliquidaciones={preliquidaciones}
            value={preliqId}
            onChange={id => { setElegida(id); setBusqueda('') }}
          />
        )}
      />

      {/* Sin quincena elegida, distinguir carga, error y lista vacía: si no, un F5 o
          una caída del backend se leen como "no hay quincenas" (GUIA-MODULOS regla 21). */}
      {!preliqId && cargandoQuincenas ? (
        <CargandoContenido texto="Cargando quincenas…" />
      ) : !preliqId && errorQuincenas ? (
        <AvisoError>
          No se pudieron cargar las quincenas. Probá recargar la página.
        </AvisoError>
      ) : !preliqId ? (
        <div className={styles.empty}>Todavía no hay quincenas generadas.</div>
      ) : (
        <>
          <div className={styles.toolbar}>
            <button
              className="btn btn-sm"
              onClick={() => mutHeredar.mutate()}
              disabled={mutHeredar.isPending}
            >
              {mutHeredar.isPending ? <><span className="spinner" /> Heredando...</> : 'Heredar de quincena anterior'}
            </button>
            <span className={styles.count}>{operariosFiltrados.length} operario(s)</span>
          </div>

          <div className={styles.content}>
            {isLoading ? (
              <CargandoContenido texto="Cargando operarios…" />
            ) : operariosFiltrados.length === 0 ? (
              <div className={styles.empty}>No hay operarios de mantenimiento para esta quincena.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>EMPLEADO</th>
                      <th>LEGAJO</th>
                      <th>CUIL</th>
                      <th>CATEGORÍA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operariosFiltrados.map(op => (
                      <tr key={op.cuil} className={op.categoria == null ? styles.filaSinCategoria : ''}>
                        <td>{op.nombre_empleado || '—'}</td>
                        <td className="mono">{op.legajo || '—'}</td>
                        <td className="mono">{op.cuil || '—'}</td>
                        <td>
                          <select
                            className={`input ${styles.categoriaSelect}`}
                            value={op.categoria ?? ''}
                            onChange={e => {
                              const v = e.target.value
                              mutCategoria.mutate({ cuil: op.cuil, categoria: v === '' ? null : parseInt(v) })
                            }}
                          >
                            <option value="">— Sin categoría —</option>
                            {CATEGORIAS.map(c => (
                              <option key={c} value={c}>Categoría {c}</option>
                            ))}
                          </select>
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
