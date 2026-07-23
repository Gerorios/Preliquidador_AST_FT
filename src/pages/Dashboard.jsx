import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { listarPreliquidaciones, generarPreliquidacion } from '../services/preliquidacion'
import CargandoContenido from '../components/layout/CargandoContenido'
import styles from './Dashboard.module.css'

const QUINCENAS = () => {
  const hoy = new Date()
  const opciones = []
  for (let m = 0; m < 3; m++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - m, 1)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    opciones.push({ label: `1ra quincena ${format(d, 'MMMM yyyy', { locale: es })}`, value: `${y}-${mo}-01` })
    opciones.push({ label: `2da quincena ${format(d, 'MMMM yyyy', { locale: es })}`, value: `${y}-${mo}-16` })
  }
  return opciones
}

export default function Dashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [quincena, setQuincena] = useState(QUINCENAS()[0].value)

  const { data: preliquidaciones = [], isLoading } = useQuery({
    queryKey: ['preliquidaciones'],
    queryFn: listarPreliquidaciones,
  })

  const { mutate: generar, isPending } = useMutation({
    mutationFn: () => generarPreliquidacion(quincena),
    onSuccess: (data) => {
      toast.success(data.detalle || 'Preliquidación generada')
      // Firma v5: el array pelado (v4) no matchea la key y react-query
      // terminaba invalidando TODAS las queries del caché.
      qc.invalidateQueries({ queryKey: ['preliquidaciones'] })
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Preliquidaciones</h1>
          <p className={styles.sub}>Seleccioná una quincena para generar o continuar</p>
        </div>
      </header>

      {/* Panel de generación */}
      <div className={styles.genPanel}>
        <div className={styles.genLabel}>NUEVA QUINCENA</div>
        <div className={styles.genRow}>
          <select
            className="input"
            value={quincena}
            onChange={e => setQuincena(e.target.value)}
            style={{ width: 280 }}
          >
            {QUINCENAS().map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={() => generar()}
            disabled={isPending}
          >
            {isPending
              ? <><span className="spinner" /> Procesando...</>
              : '▶ Generar / Actualizar'
            }
          </button>
        </div>
        {isPending && (
          <div className={styles.procesando}>
            Consultando datos de campo y aplicando reglas... esto puede tardar unos segundos.
          </div>
        )}
      </div>

      {/* Tabla de preliquidaciones */}
      <div className={styles.tableSection}>
        <div className={styles.sectionTitle}>HISTORIAL</div>
        {isLoading ? (
          <CargandoContenido texto="Cargando preliquidaciones…" />
        ) : preliquidaciones.length === 0 ? (
          <div className={styles.empty}>No hay preliquidaciones aún.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>QUINCENA</th>
                  <th>TOTAL LÍNEAS</th>
                  <th>ALERTAS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {preliquidaciones.map(p => {
                  return (
                    <tr key={p.id} onClick={() => navigate(`/revision/${p.id}`)}>
                      <td className="mono">{formatQuincena(p.quincena)}</td>
                      <td className="mono">{p.total_lineas}</td>
                      <td>
                        {p.lineas_con_alerta > 0
                          ? <span className="badge badge-warn">{p.lineas_con_alerta} alertas</span>
                          : <span className="badge badge-green">OK</span>
                        }
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={e => { e.stopPropagation(); navigate(`/revision/${p.id}`) }}
                        >
                          Abrir →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function formatQuincena(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  const q = d.getDate() === 1 ? '1ra' : '2da'
  return `${q} ${format(d, 'MMMM yyyy', { locale: es })}`
}
