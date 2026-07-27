import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  listarQuincenasGerencial, listarEmpresasGerencial,
  obtenerResumen, obtenerEvolucion, obtenerPorCliente,
  obtenerPorGrupoTarea, obtenerDesvios,
} from '../services/gerencial'
import CargandoContenido from '../components/layout/CargandoContenido'
import styles from './Gerencial.module.css'

const moneda = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
})

const compacto = (n) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 0 })} mil`
  return moneda.format(n)
}

const fmtQuincena = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate() === 1 ? '1ra' : '2da'} ${format(d, 'MMM yyyy', { locale: es })}`
}

const fmtQuincenaCorta = (iso) => {
  const d = new Date(iso + 'T00:00:00')
  return `${d.getDate() === 1 ? '1q' : '2q'} ${format(d, 'MM/yy')}`
}

const fmtMes = (yyyyMm) => {
  const d = new Date(yyyyMm + '-01T00:00:00')
  return format(d, 'MMMM yyyy', { locale: es })
}

export default function Gerencial() {
  const [modo, setModo] = useState('quincena')          // 'quincena' | 'mes'
  const [quincena, setQuincena] = useState(null)
  const [mes, setMes] = useState(null)
  const [empresa, setEmpresa] = useState('')
  const [umbral, setUmbral] = useState(30)
  const [grupoDrill, setGrupoDrill] = useState(null)

  const { data: quincenas = [], isLoading: cargandoQuincenas } = useQuery({
    queryKey: ['gerencial-quincenas'],
    queryFn: listarQuincenasGerencial,
  })
  const { data: empresas = [] } = useQuery({
    queryKey: ['gerencial-empresas'],
    queryFn: listarEmpresasGerencial,
  })

  const meses = useMemo(
    () => [...new Set(quincenas.map(q => q.slice(0, 7)))],
    [quincenas]
  )

  // Período efectivo (default: la última quincena / el último mes con datos)
  const quincenaSel = quincena ?? quincenas[0] ?? null
  const mesSel = mes ?? meses[0] ?? null
  const periodo = useMemo(() => {
    if (modo === 'quincena' && quincenaSel) return { quincena: quincenaSel, empresa: empresa || undefined }
    if (modo === 'mes' && mesSel) return { mes: mesSel, empresa: empresa || undefined }
    return null
  }, [modo, quincenaSel, mesSel, empresa])

  const habilitado = Boolean(periodo)
  const keyPeriodo = JSON.stringify(periodo)

  const { data: resumen } = useQuery({
    queryKey: ['gerencial-resumen', keyPeriodo],
    queryFn: () => obtenerResumen(periodo),
    enabled: habilitado,
  })
  const { data: evolucion = [] } = useQuery({
    queryKey: ['gerencial-evolucion', empresa],
    queryFn: () => obtenerEvolucion(empresa || undefined),
  })
  const { data: porCliente = [] } = useQuery({
    queryKey: ['gerencial-cliente', keyPeriodo],
    queryFn: () => obtenerPorCliente(periodo),
    enabled: habilitado,
  })
  const { data: porGrupo = [] } = useQuery({
    queryKey: ['gerencial-grupo', keyPeriodo, grupoDrill],
    queryFn: () => obtenerPorGrupoTarea(periodo, grupoDrill),
    enabled: habilitado,
  })
  const { data: desvios } = useQuery({
    queryKey: ['gerencial-desvios', keyPeriodo, umbral],
    queryFn: () => obtenerDesvios(periodo, umbral),
    enabled: habilitado,
  })

  if (cargandoQuincenas) return <CargandoContenido texto="Cargando indicadores…" />

  if (!quincenas.length) {
    return (
      <div className={styles.page}>
        <h1>Vista gerencial</h1>
        <div className={styles.empty}>Todavía no hay preliquidaciones generadas.</div>
      </div>
    )
  }

  const etiquetaPeriodo = modo === 'quincena'
    ? (quincenaSel ? fmtQuincena(quincenaSel) : '')
    : (mesSel ? fmtMes(mesSel) : '')

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Vista gerencial</h1>
          <p className={styles.sub}>Mano de obra gastada · {etiquetaPeriodo}{empresa ? ` · ${empresa}` : ' · todas las empresas'}</p>
        </div>
      </header>

      {/* Filtros */}
      <div className={styles.filtros}>
        <div className={styles.modoSwitch}>
          <button
            className={modo === 'quincena' ? styles.modoActivo : styles.modoBtn}
            onClick={() => { setModo('quincena'); setGrupoDrill(null) }}
          >Quincena</button>
          <button
            className={modo === 'mes' ? styles.modoActivo : styles.modoBtn}
            onClick={() => { setModo('mes'); setGrupoDrill(null) }}
          >Mes</button>
        </div>

        {modo === 'quincena' ? (
          <select className="input" value={quincenaSel ?? ''} onChange={e => { setQuincena(e.target.value); setGrupoDrill(null) }}>
            {quincenas.map(q => <option key={q} value={q}>{fmtQuincena(q)}</option>)}
          </select>
        ) : (
          <select className="input" value={mesSel ?? ''} onChange={e => { setMes(e.target.value); setGrupoDrill(null) }}>
            {meses.map(m => <option key={m} value={m}>{fmtMes(m)}</option>)}
          </select>
        )}

        <select className="input" value={empresa} onChange={e => { setEmpresa(e.target.value); setGrupoDrill(null) }}>
          <option value="">Todas las empresas</option>
          {empresas.map(e2 => <option key={e2} value={e2}>{e2}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabel}>MANO DE OBRA DEL PERÍODO</div>
          <div className={styles.kpiHero}>{resumen ? moneda.format(resumen.total) : '—'}</div>
          {resumen?.periodo_anterior && (
            <div className={styles.kpiDelta}>
              {resumen.variacion_pct != null && (
                <span className={resumen.variacion_pct >= 0 ? styles.deltaUp : styles.deltaDown}>
                  {resumen.variacion_pct >= 0 ? '▲' : '▼'} {Math.abs(resumen.variacion_pct).toLocaleString('es-AR')} %
                </span>
              )}
              <span className={styles.deltaRef}> vs {compacto(resumen.periodo_anterior.total)} del período anterior</span>
            </div>
          )}
        </div>
        <div className={styles.kpiTile}>
          <div className={styles.kpiLabel}>PERSONAS</div>
          <div className={styles.kpiValor}>{resumen?.personas ?? '—'}</div>
        </div>
      </div>

      {/* Evolución */}
      <section className={styles.panel}>
        <div className={styles.panelTitulo}>EVOLUCIÓN POR QUINCENA</div>
        <GraficoEvolucion serie={evolucion} />
      </section>

      <div className={styles.dosColumnas}>
        {/* Por cliente */}
        <section className={styles.panel}>
          <div className={styles.panelTitulo}>POR CLIENTE</div>
          <ListaBarras
            items={porCliente.map(c => ({ id: c.cliente, etiqueta: c.cliente, total: c.total, porcentaje: c.porcentaje }))}
          />
        </section>

        {/* Por grupo de tareas */}
        <section className={styles.panel}>
          <div className={styles.panelTituloRow}>
            <div className={styles.panelTitulo}>
              {grupoDrill ? `TAREAS · ${grupoDrill}` : 'POR GRUPO DE TAREAS'}
            </div>
            {grupoDrill && (
              <button className="btn btn-sm" onClick={() => setGrupoDrill(null)}>← Volver a grupos</button>
            )}
          </div>
          <ListaBarras
            items={porGrupo.map(g => grupoDrill
              ? { id: g.tarea, etiqueta: g.tarea, total: g.total, porcentaje: g.porcentaje }
              : { id: g.grupo, etiqueta: g.grupo, total: g.total, porcentaje: g.porcentaje, extra: `${g.tareas} tareas` }
            )}
            onClickItem={grupoDrill ? undefined : (id) => setGrupoDrill(id)}
          />
        </section>
      </div>

      {/* Desvíos por persona */}
      <section className={styles.panel}>
        <div className={styles.panelTituloRow}>
          <div>
            <div className={styles.panelTitulo}>DESVÍOS POR PERSONA</div>
            <div className={styles.panelSub}>
              Cada persona contra su propia media de las últimas {desvios?.ventana_quincenas ?? 6} quincenas
              (mínimo {desvios?.minimo_quincenas ?? 3} con actividad). Promedios por quincena.
            </div>
          </div>
          <label className={styles.umbralCtl}>
            Umbral de alerta
            <input
              type="number" className="input" min="0" max="500" step="5"
              value={umbral}
              onChange={e => setUmbral(Number(e.target.value) || 0)}
            />
            %
          </label>
        </div>
        <TablaDesvios datos={desvios} />
      </section>

      <p className={styles.nota}>
        La quincena en curso sigue en revisión: sus importes pueden cambiar hasta que el liquidador la cierre.
      </p>
    </div>
  )
}

// ─── Evolución: columnas SVG de una sola serie, tooltip por hover ────────────

function GraficoEvolucion({ serie }) {
  const [hover, setHover] = useState(null)
  if (!serie.length) return <div className={styles.empty}>Sin datos.</div>

  const ANCHO = 900, ALTO = 220, MARGEN = { top: 16, right: 8, bottom: 28, left: 56 }
  const plotW = ANCHO - MARGEN.left - MARGEN.right
  const plotH = ALTO - MARGEN.top - MARGEN.bottom
  const max = Math.max(...serie.map(s => s.total), 1)
  const paso = plotW / serie.length
  const anchoBarra = Math.min(Math.max(paso - 2, 3), 46)

  const yTicks = [0, 0.5, 1].map(f => ({
    y: MARGEN.top + plotH * (1 - f),
    valor: max * f,
  }))

  return (
    <div className={styles.graficoWrap}>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className={styles.grafico} role="img"
           aria-label="Evolución de la mano de obra por quincena">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={MARGEN.left} x2={ANCHO - MARGEN.right} y1={t.y} y2={t.y} className={styles.gridline} />
            <text x={MARGEN.left - 8} y={t.y + 4} className={styles.tickLabel} textAnchor="end">
              {compacto(t.valor)}
            </text>
          </g>
        ))}
        {serie.map((s, i) => {
          const h = Math.max((s.total / max) * plotH, s.total > 0 ? 2 : 0)
          const x = MARGEN.left + i * paso + (paso - anchoBarra) / 2
          const y = MARGEN.top + plotH - h
          const esHover = hover === i
          return (
            <g key={s.quincena}>
              {/* target de hover más grande que la barra */}
              <rect
                x={MARGEN.left + i * paso} y={MARGEN.top} width={paso} height={plotH + 20}
                fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              />
              <rect
                x={x} y={y} width={anchoBarra} height={h} rx="4"
                className={esHover ? styles.barraHover : styles.barra}
                style={{ pointerEvents: 'none' }}
              />
              {(i % Math.ceil(serie.length / 8) === 0 || esHover) && (
                <text
                  x={x + anchoBarra / 2} y={ALTO - 8}
                  className={esHover ? styles.tickLabelActivo : styles.tickLabel}
                  textAnchor="middle"
                >
                  {fmtQuincenaCorta(s.quincena)}
                </text>
              )}
              {esHover && (
                <text x={x + anchoBarra / 2} y={y - 6} className={styles.valorHover} textAnchor="middle">
                  {compacto(s.total)} · {s.personas} pers.
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Barras horizontales (cliente / grupo de tareas) ─────────────────────────

function ListaBarras({ items, onClickItem }) {
  if (!items.length) return <div className={styles.empty}>Sin datos.</div>
  const max = Math.max(...items.map(i => i.total), 1)
  return (
    <div className={styles.listaBarras}>
      {items.map(item => (
        <div
          key={item.id}
          className={`${styles.filaBarra} ${onClickItem ? styles.filaClickeable : ''}`}
          onClick={onClickItem ? () => onClickItem(item.id) : undefined}
          title={onClickItem ? 'Ver tareas del grupo' : undefined}
        >
          <div className={styles.barraEtiqueta}>
            {item.etiqueta}
            {item.extra && <span className={styles.barraExtra}> · {item.extra}</span>}
          </div>
          <div className={styles.barraTrack}>
            <div className={styles.barraFill} style={{ width: `${(item.total / max) * 100}%` }} />
          </div>
          <div className={styles.barraValor}>
            {compacto(item.total)}
            <span className={styles.barraPct}> {item.porcentaje.toLocaleString('es-AR')} %</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Tabla de desvíos ────────────────────────────────────────────────────────

function TablaDesvios({ datos }) {
  const [verSinHistorial, setVerSinHistorial] = useState(false)
  if (!datos) return <div className={styles.empty}>Sin datos.</div>
  const { personas, sin_historial: sinHistorial } = datos
  const maxAbs = Math.max(...personas.map(p => Math.abs(p.desvio_pct ?? 0)), 1)

  return (
    <>
      {!personas.length ? (
        <div className={styles.empty}>Ninguna persona con historial comparable en este período.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PERSONA</th>
                <th className={styles.thNum}>PROMEDIO QUINCENAL</th>
                <th className={styles.thNum}>SU MEDIA HISTÓRICA</th>
                <th className={styles.thNum}>DESVÍO</th>
                <th className={styles.thBarra}></th>
              </tr>
            </thead>
            <tbody>
              {personas.map(p => (
                <tr key={p.cuil} className={p.supera_umbral ? styles.filaAlerta : undefined}>
                  <td>
                    <div>{p.nombre}</div>
                    <div className={styles.cuil}>{p.cuil} · {p.quincenas_historia} quinc. de historia</div>
                  </td>
                  <td className={`mono ${styles.tdNum}`}>{moneda.format(p.promedio_quincenal)}</td>
                  <td className={`mono ${styles.tdNum}`}>{moneda.format(p.media_historica)}</td>
                  <td className={`mono ${styles.tdNum}`}>
                    <span className={p.supera_umbral ? styles.desvioAlerta : styles.desvioNormal}>
                      {p.desvio_pct > 0 ? '+' : ''}{p.desvio_pct?.toLocaleString('es-AR')} %
                    </span>
                    {p.supera_umbral && <span className={styles.badgeAlerta}>⚠ sobre umbral</span>}
                  </td>
                  <td className={styles.tdBarra}>
                    <BarraDesvio pct={p.desvio_pct} maxAbs={maxAbs} alerta={p.supera_umbral} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sinHistorial.length > 0 && (
        <div className={styles.sinHistorial}>
          <button className="btn btn-sm" onClick={() => setVerSinHistorial(v => !v)}>
            {verSinHistorial ? '▾' : '▸'} {sinHistorial.length} personas sin historial comparable
          </button>
          {verSinHistorial && (
            <div className={styles.sinHistorialLista}>
              {sinHistorial.map(p => (
                <div key={p.cuil} className={styles.sinHistorialItem}>
                  <span>{p.nombre}</span>
                  <span className={styles.cuil}>{p.quincenas_historia} quinc. de historia</span>
                  <span className="mono">{moneda.format(p.promedio_quincenal)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

// Barra divergente centrada en 0: derecha = por encima de su media.
// El color solo refuerza (rojo únicamente sobre umbral); el signo y el texto
// llevan la información — nunca color solo.
function BarraDesvio({ pct, maxAbs, alerta }) {
  if (pct == null) return null
  const mitad = 50
  const ancho = Math.min(Math.abs(pct) / maxAbs, 1) * mitad
  return (
    <div className={styles.desvioTrack}>
      <div className={styles.desvioEjeCentral} />
      <div
        className={`${styles.desvioFill} ${alerta ? styles.desvioFillAlerta : pct >= 0 ? styles.desvioFillPos : styles.desvioFillNeg}`}
        style={pct >= 0
          ? { left: `${mitad}%`, width: `${ancho}%` }
          : { left: `${mitad - ancho}%`, width: `${ancho}%` }}
      />
    </div>
  )
}
