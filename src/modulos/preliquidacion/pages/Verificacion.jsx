import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listarLineas, listarPreliquidaciones, obtenerControlPlantasJornal,
  obtenerControlTancadasJornal, setValorHoraPulv, setValorHoraTractorista,
} from '../services/preliquidacion'
import { claves } from '../services/claves'
import FiltrosBar from '../components/FiltrosBar'
import { PlantasJornal, TancadasJornal } from '../components/ControlesJornal'
import SelectorQuincena from '../components/SelectorQuincena'
import TablaOrdenable from '../components/TablaOrdenable'
import ModalDetalle from '../components/ModalDetalle'
import Icono from '../../../core/ui/iconos'
import { filtrarLineas } from './filtrarLineas'
import { agruparPosiblesDuplicados } from './posiblesDuplicados'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import styles from './Verificacion.module.css'
import { useEstadoPantalla } from '../estadoPantallas'

const SECCIONES = [
  { key: 'horas',          icono: 'reloj',     label: 'Horas excedidas',      umbral: '> 13 hs/día' },
  { key: 'tancadas',       icono: 'gota',      label: 'Tancadas excedidas',   umbral: '> 35/día' },
  { key: 'plantas',        icono: 'planta',    label: 'Plantas excedidas',    umbral: '> 6.000/día' },
  { key: 'empleados',      icono: 'persona',   label: 'Resumen por empleado', umbral: 'importe · días · $/día' },
  { key: 'plantas-jornal', icono: 'gerencial', label: 'Plantas vs Jornal',    umbral: 'rendimiento por tarea' },
  { key: 'tancadas-jornal',icono: 'gerencial', label: 'Tancadas vs Jornal',   umbral: 'tancada vs jornal' },
  { key: 'posibles-duplicados', icono: 'alerta', label: 'Posibles duplicados', umbral: 'mismas unidades, distintas horas' },
]

function calcularExcesos(lineas) {
  const porEmpleadoFecha = {}
  for (const l of lineas) {
    const legajo = l.legajo_asignado || l.legajo_campo || ''
    const fecha = l.fecha_tarea || ''
    const clave = `${legajo}__${fecha}`
    if (!porEmpleadoFecha[clave]) {
      porEmpleadoFecha[clave] = {
        legajo, fecha, nombre_empleado: l.nombre_empleado,
        hsjornal: 0, tancadas: 0, plantas: 0, lineas: [],
      }
    }
    const g = porEmpleadoFecha[clave]
    g.hsjornal += Number(l.hsjornal || 0)
    g.tancadas += Number(l.tancadas || 0)
    if ((l.grupo_pago_aplicado || '').trim().toUpperCase() === 'PLANTA')
      g.plantas += Number(l.unidades || 0)
    g.lineas.push({
      id: l.id, nombre_tarea: l.nombre_tarea,
      nombre_cliente: l.nombre_cliente, nombre_finca: l.nombre_finca,
      hsjornal: Number(l.hsjornal || 0), tancadas: Number(l.tancadas || 0), unidades: Number(l.unidades || 0),
      nombre_supervisor: l.nombre_supervisor,
    })
  }
  const grupos = Object.values(porEmpleadoFecha)
  return {
    excesoHoras:    grupos.filter(g => g.hsjornal > 13).map(g => ({ ...g, valor: g.hsjornal })).sort((a,b) => b.valor - a.valor),
    excesoTancadas: grupos.filter(g => g.tancadas > 35).map(g => ({ ...g, valor: g.tancadas })).sort((a,b) => b.valor - a.valor),
    excesoPlantas:  grupos.filter(g => g.plantas > 6000).map(g => ({ ...g, valor: g.plantas })).sort((a,b) => b.valor - a.valor),
  }
}

function calcularResumenEmpleados(lineas) {
  const porEmpleado = {}
  for (const l of lineas) {
    const legajo = l.legajo_asignado || l.legajo_campo || ''
    if (!porEmpleado[legajo]) {
      porEmpleado[legajo] = {
        legajo, nombre_empleado: l.nombre_empleado, empresa_asignada: l.empresa_asignada,
        importe_total: 0, fechas: new Set(), lineas: [],
      }
    }
    const emp = porEmpleado[legajo]
    emp.importe_total += Number(l.importe_total || 0)
    if (l.fecha_tarea) emp.fechas.add(l.fecha_tarea)
    emp.lineas.push({
      id: l.id, fecha_tarea: l.fecha_tarea, nombre_tarea: l.nombre_tarea,
      nombre_cliente: l.nombre_cliente, nombre_finca: l.nombre_finca,
      importe_total: Number(l.importe_total || 0),
      conceptos: l.conceptos || [],
    })
  }
  return Object.values(porEmpleado).map(emp => {
    const dias = emp.fechas.size
    return {
      ...emp, dias_trabajados: dias,
      importe_por_dia: dias ? Math.round((emp.importe_total / dias) * 100) / 100 : 0,
      lineas: emp.lineas.sort((a,b) => (a.fecha_tarea||'').localeCompare(b.fecha_tarea||'')),
    }
  }).sort((a,b) => b.importe_total - a.importe_total)
}

// Fuera del componente y con `busqueda` como argumento: así no se recrea en
// cada render y los useMemo que la usan dependen sólo de sus datos y de
// `busqueda`. Adentro del componente, agregarla a las deps haría que los
// memos se recalcularan en cada render.
function filtrarBusqueda(lista, busqueda) {
  if (!busqueda) return lista
  const q = busqueda.toLowerCase()
  return lista.filter(item => item.nombre_empleado?.toLowerCase().includes(q) || item.legajo?.toLowerCase().includes(q))
}

export default function Verificacion() {
  const [elegida, setElegida] = useEstadoPantalla('verificacion.quincena', null)
  const [seccion, setSeccion] = useEstadoPantalla('verificacion.seccion', 'horas')
  const [busqueda, setBusqueda] = useEstadoPantalla('verificacion.busqueda', '')
  // El orden de cada tabla se guarda por sección.
  const [orden, setOrden] = useEstadoPantalla(`verificacion.orden.${seccion}`, null)
  const [filtros, setFiltros] = useEstadoPantalla('verificacion.filtros', {})

  const { data: preliquidaciones = [] } = useQuery({
    queryKey: claves.preliquidaciones,
    queryFn: listarPreliquidaciones,
  })
  // Arranca en la quincena más nueva, como el resto de las pantallas.
  const preliqId = elegida ?? preliquidaciones[0]?.id ?? null
  const cambiarQuincena = (id) => {
    setElegida(id)
    setFiltros({})
    setBusqueda('')
  }

  // Misma clave que Revisión: las dos piden exactamente lo mismo (todas las
  // líneas de la quincena, sin filtros de servidor) y así una invalidación
  // desde Conceptos, Dashboard o una edición en Revisión también llega acá.
  // El filtro de mensualizados es de esta pantalla y se hace abajo, en cliente,
  // sobre la data cruda: por eso no va en un `select` ni cambia la clave.
  const { data: lineasCrudas = [], isLoading } = useQuery({
    queryKey: claves.lineas(preliqId),
    queryFn: () => listarLineas(preliqId, {}),
    enabled: !!preliqId,
  })
  // Personas mensualizadas (no jornalizadas): se excluyen de todas las
  // secciones de Verificación porque estos controles miden razonabilidad del
  // pago jornalizado y no aplican a un sueldo mensual fijo. Revisión (misma
  // fuente de líneas, otra página) no filtra por esto: ahí sí hay que
  // verlas/editarlas para liquidar su sueldo. Quién es mensualizado lo decide
  // el servidor (configuración por CUIL, fuera del código) y lo marca en cada
  // línea con `mensualizado`; el front no guarda datos de personas. Contra un
  // backend que no manda el campo no se filtra nada.
  const lineas = useMemo(
    () => lineasCrudas.filter(l => !l.mensualizado),
    [lineasCrudas]
  )

  // La búsqueda no filtra líneas: se aplica sobre cada lista ya armada (abajo).
  const lineasFiltradas = useMemo(() => filtrarLineas(lineas, '', filtros), [lineas, filtros])

  const { excesoHoras, excesoTancadas, excesoPlantas } = useMemo(() => calcularExcesos(lineasFiltradas), [lineasFiltradas])
  const resumenEmpleadosCompleto = useMemo(() => calcularResumenEmpleados(lineasFiltradas), [lineasFiltradas])
  const posiblesDuplicadosCompleto = useMemo(() => agruparPosiblesDuplicados(lineasFiltradas), [lineasFiltradas])

  // El precio por planta sale del pago real congelado (backend): lo que
  // efectivamente se pagó en las líneas, venga del camino que venga.
  const { data: plantasJornal = { filas: [], totales: {}, valor_hora_tractorista: null } } = useQuery({
    queryKey: ['control-plantas-jornal', preliqId],
    queryFn: () => obtenerControlPlantasJornal(preliqId),
    enabled: !!preliqId && seccion === 'plantas-jornal',
  })

  const queryClient = useQueryClient()
  const guardarValorHoraTractorista = useMutation({
    mutationFn: (valor) => setValorHoraTractorista(preliqId, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['control-plantas-jornal', preliqId] }),
  })
  const { data: tancadasJornal = { filas: [], totales: {}, valor_hora_pulv: null } } = useQuery({
    queryKey: ['control-tancadas-jornal', preliqId],
    queryFn: () => obtenerControlTancadasJornal(preliqId),
    enabled: !!preliqId && seccion === 'tancadas-jornal',
  })
  const guardarValorHora = useMutation({
    mutationFn: (valor) => setValorHoraPulv(preliqId, valor),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['control-tancadas-jornal', preliqId] }),
  })

  // `busqueda` llega ya debounceada desde FiltrosBar (dueña del input):
  // tipear no re-renderiza esta página hasta que el valor se asienta.
  const excesoHorasF    = useMemo(() => filtrarBusqueda(excesoHoras, busqueda),            [excesoHoras, busqueda])
  const excesoTancadasF = useMemo(() => filtrarBusqueda(excesoTancadas, busqueda),         [excesoTancadas, busqueda])
  const excesoPlantasF  = useMemo(() => filtrarBusqueda(excesoPlantas, busqueda),          [excesoPlantas, busqueda])
  const resumenEmpleados = useMemo(() => filtrarBusqueda(resumenEmpleadosCompleto, busqueda), [resumenEmpleadosCompleto, busqueda])
  const posiblesDuplicados = useMemo(() => filtrarBusqueda(posiblesDuplicadosCompleto, busqueda), [posiblesDuplicadosCompleto, busqueda])

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Verificación</div>
      </div>

      <FiltrosBar
        key={preliqId}
        lineas={lineas}
        filtros={filtros}
        onChange={setFiltros}
        busqueda={busqueda}
        onBusqueda={setBusqueda}
        mostrarAlertas={false}
        mostrarBusqueda={!!preliqId && seccion !== 'plantas-jornal'}
        placeholderBusqueda="Buscar empleado o legajo..."
        quincena={<SelectorQuincena preliquidaciones={preliquidaciones} value={preliqId} onChange={cambiarQuincena} />}
      />

      {!preliqId ? (
        <div className={styles.empty} style={{ padding: 40, textAlign: 'center' }}>
          Todavía no hay quincenas generadas.
        </div>
      ) : (
        <>

          <div className={styles.nav}>
            {SECCIONES.map(s => {
              const cantidad = {
                horas:          excesoHorasF.length,
                tancadas:       excesoTancadasF.length,
                plantas:        excesoPlantasF.length,
                empleados:      resumenEmpleados.length,
                'plantas-jornal': null,
                'tancadas-jornal': null,
                'posibles-duplicados': posiblesDuplicados.length,
              }[s.key]
              return (
                <button
                  key={s.key}
                  className={`${styles.navItem} ${seccion === s.key ? styles.navItemActive : ''}`}
                  onClick={() => setSeccion(s.key)}
                >
                  <span className={styles.navLabel}><Icono nombre={s.icono} size={15} /> {s.label}</span>
                  <span className={styles.navUmbral}>{s.umbral}</span>
                  {cantidad != null && cantidad > 0 && (
                    <span className="badge badge-warn mono" style={{ marginLeft: 8 }}>{cantidad}</span>
                  )}
                </button>
              )
            })}
          </div>

          {isLoading ? (
            <CargandoContenido texto="Cargando líneas…" />
          ) : (
            <div className={styles.content}>
              {seccion === 'horas'         && <ListaExceso titulo="Empleados con más de 13 horas jornal en un mismo día" items={excesoHorasF} unidad="hs" orden={orden} onOrden={setOrden} />}
              {seccion === 'tancadas'      && <ListaExceso titulo="Empleados con más de 35 tancadas en un mismo día" items={excesoTancadasF} unidad="tancadas" orden={orden} onOrden={setOrden} />}
              {seccion === 'plantas'       && <ListaExceso titulo="Empleados con más de 6.000 plantas en un mismo día" items={excesoPlantasF} unidad="plantas" orden={orden} onOrden={setOrden} />}
              {seccion === 'empleados'     && <ResumenEmpleados items={resumenEmpleados} orden={orden} onOrden={setOrden} />}
              {seccion === 'plantas-jornal'&& <PlantasJornal data={plantasJornal} onGuardar={(v) => guardarValorHoraTractorista.mutate(v)} guardando={guardarValorHoraTractorista.isPending} orden={orden} onOrden={setOrden} />}
              {seccion === 'tancadas-jornal'&& <TancadasJornal data={tancadasJornal} onGuardar={(v) => guardarValorHora.mutate(v)} guardando={guardarValorHora.isPending} orden={orden} onOrden={setOrden} />}
              {seccion === 'posibles-duplicados' && <ListaPosiblesDuplicados items={posiblesDuplicados} orden={orden} onOrden={setOrden} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Secciones ────────────────────────────────────────────────────────────────

// Las líneas llegan crudas de la API (los Decimal como string, '4.00'): se
// muestran como número, y el 0 o el nulo como '—'.
const numero = (v) => Number(v || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })
const numeroOGuion = (v) => (Number(v || 0) ? numero(v) : '—')
const pesos = (v) => `$${numero(v)}`
const fecha = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const sumar = (lista, campo) => lista.reduce((s, l) => s + Number(l[campo] || 0), 0)
const derecha = { textAlign: 'right' }

// Empleados que pasan un umbral en un mismo día (horas, tancadas o plantas).
// Tabla ordenable; cada fila abre el detalle de ese día en un modal.
function ListaExceso({ titulo, items, unidad, orden, onOrden }) {
  const [abierto, setAbierto] = useState(null)
  if (items.length === 0) return <div className={styles.empty}>No hay excesos para este control.</div>
  const etiquetaValor = unidad === 'hs' ? 'Horas jornal' : unidad === 'tancadas' ? 'Tancadas' : 'Plantas'
  const columnas = [
    { clave: 'nombre', label: 'Empleado', valor: i => i.nombre_empleado || '', mostrar: i => i.nombre_empleado || '—' },
    { clave: 'legajo', label: 'Legajo', valor: i => i.legajo || '' },
    { clave: 'fecha', label: 'Fecha', valor: i => i.fecha || '', mostrar: i => fecha(i.fecha) },
    { clave: 'lineas', label: 'Líneas', valor: i => i.lineas.length, numerica: true },
    { clave: 'valor', label: etiquetaValor, valor: i => i.valor, mostrar: i => <b>{numero(i.valor)}</b>, numerica: true },
  ]
  return (
    <div>
      <div className={styles.seccionTitulo}>{titulo} — {items.length} casos</div>
      <TablaOrdenable
        columnas={columnas}
        filas={items}
        claveFila={i => `${i.legajo}-${i.fecha}`}
        orden={orden}
        onOrden={onOrden}
        onAbrir={setAbierto}
        etiquetaFila={i => `${i.nombre_empleado} del ${fecha(i.fecha)}`}
      />
      {abierto && (
        <ModalDetalle
          titulo={abierto.nombre_empleado || '—'}
          subtitulo={`Legajo ${abierto.legajo || '—'} · ${fecha(abierto.fecha)}`}
          onCerrar={() => setAbierto(null)}
          datos={[
            { label: 'Horas jornal del día', valor: numero(abierto.hsjornal), destacado: unidad === 'hs' },
            { label: 'Tancadas del día', valor: numero(abierto.tancadas), destacado: unidad === 'tancadas' },
            { label: 'Plantas del día', valor: numero(abierto.plantas), destacado: unidad === 'plantas' },
            { label: 'Líneas', valor: abierto.lineas.length },
          ]}
        >
          <table>
            <thead><tr><th>Tarea</th><th>Cliente</th><th>Finca</th><th>Supervisor</th><th style={derecha}>Hs jornal</th><th style={derecha}>Tancadas</th><th style={derecha}>Unidades</th></tr></thead>
            <tbody>
              {abierto.lineas.map(l => (
                <tr key={l.id}>
                  <td>{l.nombre_tarea}</td>
                  <td>{l.nombre_cliente || '—'}</td>
                  <td>{l.nombre_finca || '—'}</td>
                  <td>{l.nombre_supervisor || '—'}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.hsjornal)}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.tancadas)}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.unidades)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total del día</td>
                <td className="mono" style={derecha}>{numero(sumar(abierto.lineas, 'hsjornal'))}</td>
                <td className="mono" style={derecha}>{numero(sumar(abierto.lineas, 'tancadas'))}</td>
                <td className="mono" style={derecha}>{numero(sumar(abierto.lineas, 'unidades'))}</td>
              </tr>
            </tfoot>
          </table>
        </ModalDetalle>
      )}
    </div>
  )
}

// Cada fila es un grupo de líneas iguales salvo en las horas (la marca la
// pone el backend). El importe en duda es la suma del grupo menos la línea de
// mayor importe, o sea lo que sobraría si sólo una de ellas fuera trabajo real.
function ListaPosiblesDuplicados({ items, orden, onOrden }) {
  const [abierto, setAbierto] = useState(null)
  if (items.length === 0) return <div className={styles.empty}>No hay posibles duplicados.</div>
  const columnas = [
    { clave: 'nombre', label: 'Empleado', valor: i => i.nombre_empleado || '', mostrar: i => i.nombre_empleado || '—' },
    { clave: 'legajo', label: 'Legajo', valor: i => i.legajo || '' },
    { clave: 'fecha', label: 'Fecha', valor: i => i.fecha || '', mostrar: i => fecha(i.fecha) },
    { clave: 'lineas', label: 'Líneas', valor: i => i.lineas.length, numerica: true },
    { clave: 'valor', label: 'Importe en duda', valor: i => Number(i.valor || 0), mostrar: i => <b>{pesos(i.valor)}</b>, numerica: true },
  ]
  return (
    <div>
      <div className={styles.seccionTitulo}>Líneas iguales con distintas horas en un mismo día — {items.length} casos</div>
      <TablaOrdenable
        columnas={columnas}
        filas={items}
        claveFila={i => i.clave}
        orden={orden}
        onOrden={onOrden}
        onAbrir={setAbierto}
        etiquetaFila={i => `${i.nombre_empleado} del ${fecha(i.fecha)}`}
      />
      {abierto && (
        <ModalDetalle
          titulo={abierto.nombre_empleado || '—'}
          subtitulo={`Legajo ${abierto.legajo || '—'} · ${fecha(abierto.fecha)}`}
          onCerrar={() => setAbierto(null)}
          datos={[
            { label: 'Importe en duda', valor: pesos(abierto.valor), destacado: true },
            { label: 'Líneas del grupo', valor: abierto.lineas.length },
          ]}
        >
          <table>
            <thead><tr><th>Tarea</th><th>Cliente · Finca</th><th>Supervisor</th><th style={derecha}>Hs jornal</th><th style={derecha}>Hs máquina</th><th style={derecha}>Tancadas</th><th style={derecha}>Unidades</th><th style={derecha}>Importe</th><th></th></tr></thead>
            <tbody>
              {[...abierto.lineas].sort((a, b) => a.id - b.id).map(l => (
                <tr key={l.id}>
                  <td>{l.nombre_tarea}</td>
                  <td>{l.nombre_cliente} · {l.nombre_finca}</td>
                  <td>{l.nombre_supervisor || '—'}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.hsjornal)}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.hsmaquina)}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.tancadas)}</td>
                  <td className="mono" style={derecha}>{numeroOGuion(l.unidades)}</td>
                  <td className="mono" style={derecha}>{pesos(l.importe_total)}</td>
                  <td>
                    {l.es_duplicado
                      ? <span className="badge badge-danger">DUPLICADO</span>
                      : l.es_posible_duplicado && <span className="badge badge-warn">POSIBLE DUPLICADO</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ModalDetalle>
      )}
    </div>
  )
}

const UNIDAD_LABEL = {
  hsjornal: 'hs jornal',
  hsmaquina: 'hs máquina',
  tancadas: 'tancadas',
  unidades: 'unidades',
  jornal_tope1: 'jornal',
  jornal_tope1_mas_excedente: 'jornal',
}

// Texto del badge de un concepto adicional: "Cód. N — cantidad unidad — $precio"
// (el precio unitario por el que se paga, sin el importe total). Los casos sin
// cantidad real (fijo) muestran "— fijo — $precio"; los manuales, sin código ni
// precio, muestran solo su "— $importe".
function etiquetaConcepto(c) {
  const importe = Number(c.importe || 0).toLocaleString('es-AR')
  const esManual = c.codigo_concepto === null || c.codigo_concepto === undefined
  if (esManual) return `Manual — $${importe}`

  const cod = `Cód. ${c.codigo_concepto}`
  const precio = c.precio != null ? Number(c.precio).toLocaleString('es-AR') : null
  // fijo: la cantidad es siempre 1 y no hay unidad real → sin cantidad.
  if (c.unidad_base === 'fijo') return `${cod} — fijo — $${precio ?? importe}`

  const label = UNIDAD_LABEL[c.unidad_base]
  if (!label || c.cantidad == null || precio == null) return `${cod} — $${precio ?? importe}`

  const cant = Number(c.cantidad).toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return `${cod} — ${cant} ${label} — $${precio}`
}

// Cuánto cobra cada persona en la quincena: tabla ordenable y, al abrir una
// fila, el detalle día por día con los conceptos que se le aplicaron.
function ResumenEmpleados({ items, orden, onOrden }) {
  const [abierto, setAbierto] = useState(null)
  if (items.length === 0) return <div className={styles.empty}>No hay líneas en esta quincena.</div>
  const columnas = [
    { clave: 'nombre', label: 'Empleado', valor: e => e.nombre_empleado || '', mostrar: e => e.nombre_empleado || '—' },
    { clave: 'legajo', label: 'Legajo', valor: e => e.legajo || '' },
    { clave: 'empresa', label: 'Empresa', valor: e => e.empresa_asignada || '' },
    { clave: 'dias', label: 'Días', valor: e => e.dias_trabajados, numerica: true },
    { clave: 'porDia', label: '$ por día', valor: e => e.importe_por_dia, mostrar: e => pesos(e.importe_por_dia), numerica: true },
    { clave: 'total', label: 'Total quincena', valor: e => e.importe_total, mostrar: e => <b>{pesos(e.importe_total)}</b>, numerica: true },
  ]
  return (
    <div>
      <div className={styles.seccionTitulo}>Importe, días trabajados y $ por día de cada empleado — {items.length} empleados</div>
      <TablaOrdenable
        columnas={columnas}
        filas={items}
        claveFila={e => e.legajo}
        orden={orden}
        onOrden={onOrden}
        onAbrir={setAbierto}
        etiquetaFila={e => e.nombre_empleado}
      />
      {abierto && (
        <ModalDetalle
          titulo={abierto.nombre_empleado || '—'}
          subtitulo={`Legajo ${abierto.legajo || '—'} · ${abierto.empresa_asignada || 'sin empresa'}`}
          onCerrar={() => setAbierto(null)}
          datos={[
            { label: 'Total de la quincena', valor: pesos(abierto.importe_total), destacado: true },
            { label: 'Días trabajados', valor: abierto.dias_trabajados },
            { label: '$ por día', valor: pesos(abierto.importe_por_dia) },
            { label: 'Líneas', valor: abierto.lineas.length },
          ]}
        >
          <table>
            <thead><tr><th>Fecha</th><th>Tarea</th><th>Cliente · Finca</th><th>Conceptos</th><th style={derecha}>Importe</th></tr></thead>
            <tbody>
              {abierto.lineas.map(l => (
                <tr key={l.id}>
                  <td className="mono">{fecha(l.fecha_tarea)}</td>
                  <td>{l.nombre_tarea}</td>
                  <td>{l.nombre_cliente} · {l.nombre_finca}</td>
                  <td>
                    <div className={styles.conceptosDia}>
                      {l.conceptos.length === 0
                        ? <span className={styles.lineaMuted}>Sin conceptos</span>
                        : l.conceptos.map(c => <span key={c.id} className="badge badge-muted mono">{etiquetaConcepto(c)}</span>)}
                    </div>
                  </td>
                  <td className="mono" style={derecha}>{pesos(l.importe_total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td colSpan={4}>Total de la quincena</td><td className="mono" style={derecha}>{pesos(abierto.importe_total)}</td></tr>
            </tfoot>
          </table>
        </ModalDetalle>
      )}
    </div>
  )
}
