import { Fragment, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { listarPreliquidaciones, generarPreliquidacion } from '../services/preliquidacion'
import { claves } from '../services/claves'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import { desgloseAlertas } from './desgloseAlertas'
import Icono from '../../../core/ui/iconos'
import useAuthStore from '../../../core/authStore'
import { puedeEditar, puedeVer } from '../../../core/permisos'
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
  const [elegida, setQuincena] = useState(null)
  // Generar es la escritura de esta pantalla (el backend la protege con Editar
  // Inicio) y abrir una quincena lleva a Revisión, que es otra pantalla. Con
  // sólo Ver, el Inicio queda como historial: sin panel de generación y, si
  // tampoco ve Revisión, sin filas que se abran.
  const { usuario } = useAuthStore()
  const puedeGenerar = puedeEditar(usuario, 'preliquidacion', 'inicio')
  const puedeAbrir = puedeVer(usuario, 'preliquidacion', 'revision')
  const abrir = (id) => navigate(`/preliquidacion/revision/${id}`)

  const { data: preliquidaciones = [], isLoading } = useQuery({
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
    // El desglose de alertas del historial viene en este listado, y Revisión y
    // Conceptos no lo invalidan al editar: sin esto quedaría viejo hasta 30 s.
    refetchOnMount: 'always',
  })
  // Arranca en la última quincena generada (si está entre las opciones), no
  // en la del mes en curso, que todavía puede no tener datos.
  const opciones = QUINCENAS()
  const ultimaGenerada = preliquidaciones[0]?.quincena
  const quincena = elegida
    ?? (opciones.some(o => o.value === ultimaGenerada) ? ultimaGenerada : opciones[0].value)

  const [abierta, setAbierta] = useState(null)

  const { mutate: generar, isPending } = useMutation({
    mutationFn: () => generarPreliquidacion(quincena),
    onSuccess: (data) => {
      toast.success(data.detalle || 'Preliquidación generada')
      // Firma v5: el array pelado (v4) no matchea la key y react-query
      // terminaba invalidando TODAS las queries del caché.
      qc.invalidateQueries({ queryKey: claves.preliquidaciones })
      // Generar (o regenerar) reescribe las líneas de esa quincena: si Revisión
      // o Verificación quedaron con datos viejos en caché, tienen que refetchear.
      // Se invalida por prefijo porque acá no se conoce el id de la preliquidación.
      qc.invalidateQueries({ queryKey: claves.todasLasLineas })
      qc.invalidateQueries({ queryKey: claves.todasLasStats })
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Preliquidaciones</h1>
          {(puedeGenerar || puedeAbrir) && (
            <p className={styles.sub}>
              {puedeGenerar && puedeAbrir
                ? 'Seleccioná una quincena para generar o continuar'
                : puedeGenerar
                  ? 'Seleccioná una quincena para generar'
                  : 'Abrí una quincena del historial para revisarla'}
            </p>
          )}
        </div>
      </header>

      {/* Panel de generación: sólo con Editar Inicio. */}
      {puedeGenerar && (
        <div className={styles.genPanel}>
          <div className={styles.genLabel}>NUEVA QUINCENA</div>
          <div className={styles.genRow}>
            {/* Mientras carga el listado, la quincena elegida todavía es la del mes en
                curso (la última generada llega con el listado): un clic temprano
                generaría la quincena equivocada. Por eso el selector y el botón esperan. */}
            <select
              className="input"
              value={quincena}
              onChange={e => setQuincena(e.target.value)}
              disabled={isLoading}
              style={{ width: 280 }}
            >
              {opciones.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={() => generar()}
              disabled={isPending || isLoading}
            >
              {isPending
                ? <><span className="spinner" /> Procesando...</>
                : <><Icono nombre="generar" size={14} enTexto /> Generar / Actualizar</>
              }
            </button>
          </div>
          {isPending && (
            <div className={styles.procesando}>
              Consultando datos de campo y aplicando reglas... esto puede tardar unos segundos.
            </div>
          )}
        </div>
      )}

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
                  {puedeAbrir && <th></th>}
                </tr>
              </thead>
              <tbody>
                {preliquidaciones.map(p => {
                  const desglose = p.lineas_con_alerta > 0 ? desgloseAlertas(p) : []
                  const estaAbierta = abierta === p.id
                  return (
                    <Fragment key={p.id}>
                      <tr
                        onClick={puedeAbrir ? () => abrir(p.id) : undefined}
                        className={puedeAbrir ? undefined : styles.filaSinAbrir}
                      >
                        <td className="mono">{formatQuincena(p.quincena)}</td>
                        <td className="mono">{p.total_lineas}</td>
                        <td>
                          {p.lineas_con_alerta > 0 ? (
                            <div className={styles.alertas}>
                              <span className="badge badge-warn">{p.lineas_con_alerta} líneas con alerta</span>
                              {desglose.length > 0 && (
                                <span className={styles.desglose}>
                                  {desglose.map(d => (
                                    <span key={d.clave} className={`${styles.tipo} ${styles[d.tono]}`} title={d.explicacion}>
                                      <b>{d.cantidad}</b> {d.etiqueta}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </div>
                          ) : <span className="badge badge-green">OK</span>}
                        </td>
                        <td>
                          {desglose.length > 0 && (
                            <button
                              className="btn btn-sm"
                              aria-expanded={estaAbierta}
                              onClick={e => { e.stopPropagation(); setAbierta(estaAbierta ? null : p.id) }}
                            >
                              {estaAbierta ? 'Ocultar detalle' : 'Detalle'}
                            </button>
                          )}
                        </td>
                        {puedeAbrir && (
                          <td>
                            <button
                              className="btn btn-sm"
                              onClick={e => { e.stopPropagation(); abrir(p.id) }}
                            >
                              Abrir →
                            </button>
                          </td>
                        )}
                      </tr>
                      {estaAbierta && (
                        <tr className={styles.filaDetalle}>
                          <td colSpan={puedeAbrir ? 5 : 4}>
                            <ul className={styles.detalle}>
                              {desglose.map(d => (
                                <li key={d.clave}>
                                  <span className={`${styles.tipo} ${styles[d.tono]}`}><b>{d.cantidad}</b> {d.etiqueta}</span>
                                  <span className={styles.explicacion}>{d.explicacion}</span>
                                </li>
                              ))}
                            </ul>
                            <p className={styles.notaDetalle}>Una línea puede tener más de una alerta, por eso los números pueden sumar más que el total.</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
