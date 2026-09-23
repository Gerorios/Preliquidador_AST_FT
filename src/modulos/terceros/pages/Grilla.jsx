import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import FiltroMultiple from '../components/FiltroMultiple'
import SelectorQuincena from '../components/SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { listarLineas } from '../services/terceros'
import { ORDEN_CONCEPTOS, columnasDe, filtrosDe, valorDe } from '../columnasGrilla'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import { bajarCsv, comoNumeroCsv } from '../exportar'
import { comoEntero, comoPesos, comoPesosEnteros } from '../formato'
import styles from './Grilla.module.css'

// La quincena entera en una sola pantalla, con los seis conceptos mezclados.
//
// Reemplaza a las cinco pantallas de solo lectura de la etapa 2. El liquidador
// no revisa "los viajes" y después "el combustible": revisa a un tercero, y
// necesita ver de un saque lo que le paga y lo que le descuenta.
//
// De ahí sale el orden de la pantalla, que es el de la pregunta que se hace:
//
//   1. El TERCERO, arriba de todo. Es el filtro maestro y cruza las seis
//      fuentes: elegido un dueño, todo lo que sigue es de él.
//   2. El CONCEPTO, que parte lo de ese dueño en lo que se le paga y lo que se
//      le descuenta, en el orden del recibo.
//   3. Los filtros PROPIOS de ese concepto, que recién ahí tienen sentido:
//      capataz es una pregunta de viajes, y vale una de combustible.
//
// **No hay botón de recalcular.** Cargar un precio en el Tarifario ya lo
// aplica: el backend recalcula ese concepto en el mismo request, igual que hace
// Preliquidación con sus conceptos. Un botón aparte deja la pantalla mostrando
// números viejos hasta que alguien se acuerde de apretarlo.
//
// Los filtros son en memoria: la quincena más grande son 1.160 líneas, ya están
// todas en el navegador, y pedirlas de nuevo agregaría segundos contra una base
// que está en otro servidor.
//
// Hubo un buscador de texto libre y se sacó: desde que cada concepto tiene sus
// filtros con casillas, lo único que agregaba era otra forma de hacer lo mismo.
// Dos caminos para la misma pregunta obligan a elegir uno antes de empezar.

// Un hecho sin importe no vale cero: dice por qué no lo tiene, y cada motivo lo
// resuelve alguien distinto. Por eso el estado se muestra y se puede filtrar.
const ESTADOS = {
  CALCULADO: { label: 'Calculado', tono: 'ok' },
  SIN_TERCERO: { label: 'Sin dueño', tono: 'alerta', ayuda: 'El sistema de campo no dice de quién es' },
  SIN_TARIFA: { label: 'Sin tarifa', tono: 'aviso', ayuda: 'Falta pactarle el precio en el Tarifario' },
  TARIFA_AMBIGUA: { label: 'Tarifa ambigua', tono: 'alerta', ayuda: 'Dos reglas igual de específicas lo alcanzan' },
  NO_COBRAR: { label: 'No se cobra', tono: 'neutro', ayuda: 'Alguien decidió no cobrarlo' },
  NO_APROBADA: { label: 'Sin aprobar', tono: 'aviso', ayuda: 'La hora de taller todavía no se aprobó' },
  SIN_CANTIDAD: { label: 'Sin cantidad', tono: 'alerta', ayuda: 'Hay tarifa, pero la línea no trae la medida que esa tarifa cobra' },
}

const etiquetaDe = (clave, valor) =>
  clave === 'estado' ? (ESTADOS[valor]?.label ?? valor) : valor

const unicos = (filas, clave) =>
  [...new Set(filas.map(f => f[clave]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))

function Chip({ activo, onClick, children, cuenta }) {
  return (
    <button className={`${styles.chip} ${activo ? styles.chipActivo : ''}`} onClick={onClick}>
      {children}
      {cuenta !== undefined && <span className={styles.chipCuenta}>{comoEntero(cuenta)}</span>}
    </button>
  )
}

export default function Grilla() {
  const quincena = useQuincenaStore(s => s.quincena)
  // Cada filtro guarda un Set. Vacío = todos, que es como se lee un filtro
  // recién abierto y evita la pantalla en blanco por destildar todo sin querer.
  const [terceros, setTerceros] = useState(new Set())
  const [concepto, setConcepto] = useState('')
  const [filtros, setFiltros] = useState({})
  const [orden, setOrden] = useState({ clave: null, asc: true })

  const { data: lineas = [], isLoading } = useQuery({
    queryKey: ['terceros', 'lineas', quincena],
    queryFn: () => listarLineas(quincena),
    enabled: !!quincena,
  })

  const columnas = useMemo(() => columnasDe(concepto), [concepto])
  const declarados = useMemo(() => filtrosDe(concepto), [concepto])

  const todosLosTerceros = useMemo(() => unicos(lineas, 'tercero'), [lineas])

  const claves = useMemo(() => declarados.map(([c]) => c), [declarados])

  const pasaTercero = (f) => terceros.size === 0 || terceros.has(f.tercero)

  // `salvo` deja un filtro afuera, que es lo que hace falta para armar sus
  // propias opciones: si se aplicara a sí mismo, lo único que quedaría para
  // elegir sería lo que ya está elegido.
  const pasa = (fila, salvo) =>
    pasaTercero(fila) && pasaFiltros(fila, claves, filtros, salvo)

  // Cambiar de concepto cambia las columnas y los filtros, así que lo que había
  // puesto ya no significa lo mismo: un capataz elegido no tiene sentido en
  // Combustible. Los filtros se sueltan; el tercero no, que es el maestro y lo
  // normal es seguir mirando al mismo dueño.
  const elegirConcepto = (clave) => {
    setConcepto(clave)
    setOrden({ clave: null, asc: true })
    setFiltros({})
  }

  const delConcepto = useMemo(
    () => (concepto ? lineas.filter(f => f.concepto === concepto) : lineas),
    [lineas, concepto]
  )

  // Las opciones de cada filtro salen de lo que queda al aplicar los OTROS:
  // elegido un cliente, el de finca ofrece las fincas de ese cliente y no las
  // de la quincena entera. Un filtro sin nada que ofrecer no se muestra: un
  // desplegable vacío es una promesa que la pantalla no puede cumplir.
  const opciones = useMemo(
    () => opcionesCascada(delConcepto.filter(pasaTercero), claves, filtros),
    [delConcepto, claves, filtros, terceros])

  const visibles = useMemo(() => {
    const filas = delConcepto.filter(f => pasa(f, null))
    if (!orden.clave) return filas
    const columna = columnas.find(c => c.clave === orden.clave)
    const copia = [...filas]
    copia.sort((a, b) => {
      const x = columna ? valorDe(columna, a) : a[orden.clave]
      const y = columna ? valorDe(columna, b) : b[orden.clave]
      if (x === y) return 0
      if (x === null || x === undefined || x === '') return 1   // los vacíos, al final
      if (y === null || y === undefined || y === '') return -1
      const numericos = !isNaN(Number(x)) && !isNaN(Number(y))
      const cmp = numericos ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es')
      return orden.asc ? cmp : -cmp
    })
    return copia
  }, [delConcepto, declarados, filtros, terceros, orden, columnas])

  // Los totales son de lo que se está viendo, no de la quincena: si filtrás un
  // tercero querés su número, y un total que no se mueve con el filtro es un
  // número que nadie puede verificar contra lo que tiene delante.
  const totales = useMemo(() => {
    let paga = 0, descuenta = 0, seguros = 0, sinCalcular = 0
    for (const f of visibles) {
      if (f.estado !== 'CALCULADO') { sinCalcular += 1; continue }
      const monto = Number(f.importe ?? 0)
      if (f.concepto === 'seguros') seguros += monto
      else if (f.signo > 0) paga += monto
      else descuenta += monto
    }
    return {
      paga, descuenta, seguros, sinCalcular,
      aFacturar: paga - descuenta,
      aPagar: paga - descuenta - seguros,
    }
  }, [visibles])

  // Los botones van en el orden del recibo, no en el que las filas aparecen por
  // fecha. Y la cuenta de cada uno **respeta el tercero elegido**: cada botón
  // dice cuántas líneas de ese concepto tiene ÉL. Sin eso, el número de arriba
  // contradice a la tabla de abajo.
  const conceptos = useMemo(() => {
    const cuenta = {}, etiqueta = {}
    for (const f of lineas) {
      etiqueta[f.concepto] = f.concepto_label
      if (pasaTercero(f)) cuenta[f.concepto] = (cuenta[f.concepto] ?? 0) + 1
    }
    return ORDEN_CONCEPTOS
      .filter(c => etiqueta[c])
      .map(c => ({ clave: c, label: etiqueta[c], cuenta: cuenta[c] ?? 0 }))
  }, [lineas, terceros])

  const totalDelTercero = useMemo(
    () => conceptos.reduce((n, c) => n + c.cuenta, 0), [conceptos])

  // Se exporta lo que se ve, con las columnas que se ven: bajar la quincena
  // entera cuando en pantalla hay un tercero filtrado obliga a filtrar de nuevo
  // en el Excel.
  const exportar = () => {
    const cols = columnas.map(c => ({
      label: c.label,
      valor: f => {
        const v = valorDe(c, f)
        if (c.clave === 'estado') return ESTADOS[v]?.label ?? v
        // Con signo: en una planilla se suma una columna, y el signo es lo que
        // hace que la suma dé el neto en vez de dar cualquier cosa.
        if (c.clave === 'importe') return v === null ? '' : comoNumeroCsv(String(f.signo * Number(v)))
        if (c.align === 'right') return comoNumeroCsv(v)
        return v
      },
    }))
    bajarCsv(`terceros-${quincena}${concepto ? `-${concepto}` : ''}`, cols, visibles)
    toast.success(`${comoEntero(visibles.length)} líneas exportadas`)
  }

  const ordenarPor = (clave) =>
    setOrden(o => (o.clave === clave ? { clave, asc: !o.asc } : { clave, asc: true }))

  const hayFiltro = Object.values(filtros).some(s => s?.size)

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>Quincena</div>
        <SelectorQuincena />
        <div className={styles.acciones}>
          <button className="btn btn-sm" disabled={!visibles.length} onClick={exportar}>
            Exportar
          </button>
        </div>
      </div>

      {!quincena && <div className={styles.vacio}>Elegí una quincena para verla.</div>}
      {quincena && isLoading && <CargandoContenido texto="Trayendo la quincena…" />}

      {quincena && !isLoading && (
        <>
          {/* El maestro: cruza las seis fuentes, así que va arriba de todo. */}
          <div className={styles.maestro}>
            <FiltroMultiple label="Tercero" valores={todosLosTerceros}
                            seleccion={terceros} onCambiar={setTerceros} />
            <span className={styles.maestroNota}>
              {terceros.size === 0
                ? 'Todos los dueños de la quincena'
                : `${comoEntero(totalDelTercero)} líneas`}
            </span>
          </div>

          <div className={styles.chips}>
            <Chip activo={!concepto} onClick={() => elegirConcepto('')} cuenta={totalDelTercero}>
              Todos
            </Chip>
            {conceptos.map(c => (
              <Chip key={c.clave} activo={concepto === c.clave} cuenta={c.cuenta}
                    onClick={() => elegirConcepto(concepto === c.clave ? '' : c.clave)}>
                {c.label}
              </Chip>
            ))}
          </div>

          <div className={styles.filtros}>
            {declarados.filter(([clave]) => opciones[clave]).map(([clave, label]) => (
              <FiltroMultiple
                key={clave} label={label} valores={opciones[clave]}
                seleccion={filtros[clave] ?? new Set()}
                etiqueta={v => etiquetaDe(clave, v)}
                onCambiar={sel => setFiltros(f => ({ ...f, [clave]: sel }))}
              />
            ))}
            {hayFiltro && (
              <button className={styles.limpiar} onClick={() => setFiltros({})}>
                Limpiar filtros
              </button>
            )}
          </div>

          {/* Sólo plata. La cuenta de líneas estaba acá y se sacó: entre seis
              cifras en pesos, un número que no suma se lee como si sumara.
              Cuántas hay ya lo dicen los botones de arriba. */}
          <div className={styles.resumen}>
            <div className={styles.dato}>
              <span className={styles.datoLabel}>Se le paga</span>
              <span className={styles.datoValor}>{comoPesosEnteros(totales.paga)}</span>
            </div>
            <div className={styles.dato}>
              <span className={styles.datoLabel}>Se le descuenta</span>
              <span className={styles.datoValor}>{comoPesosEnteros(totales.descuenta)}</span>
            </div>
            <div className={`${styles.dato} ${styles.datoFuerte}`}>
              <span className={styles.datoLabel}>Total a facturar</span>
              <span className={styles.datoValor}>{comoPesosEnteros(totales.aFacturar)}</span>
            </div>
            <div className={styles.dato}>
              <span className={styles.datoLabel}>Seguros</span>
              <span className={styles.datoValor}>{comoPesosEnteros(totales.seguros)}</span>
            </div>
            <div className={`${styles.dato} ${styles.datoFuerte}`}>
              <span className={styles.datoLabel}>Total a pagar</span>
              <span className={styles.datoValor}>{comoPesosEnteros(totales.aPagar)}</span>
            </div>
            {totales.sinCalcular > 0 && (
              <div className={`${styles.dato} ${styles.datoAviso}`}>
                <span className={styles.datoLabel}>Sin precio</span>
                <span className={styles.datoValor}>{comoEntero(totales.sinCalcular)} líneas</span>
              </div>
            )}
          </div>

          <p className={styles.nota}>
            Los totales son de lo que estás viendo. Las líneas sin precio no suman: no valen
            cero, están esperando que alguien las resuelva. Los precios se aplican solos al
            cargarlos en el Tarifario.
          </p>

          <div className={styles.tabla}>
            <table>
              <thead>
                <tr>
                  {columnas.map(c => (
                    <th key={c.clave} onClick={() => ordenarPor(c.clave)} className={styles.th}
                        style={{ textAlign: c.align ?? 'left', width: c.ancho }}
                        title="Ordenar por esta columna">
                      {c.label}
                      {orden.clave === c.clave && (
                        <span className={styles.flecha}>{orden.asc ? '▲' : '▼'}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(f => (
                  <tr key={`${f.concepto}-${f.id}`}>
                    {columnas.map(c => {
                      if (c.tipo === 'importe') {
                        return (
                          <td key={c.clave} style={{ textAlign: 'right' }}
                              className={f.signo > 0 ? styles.paga : styles.descuenta}>
                            {f.importe === null ? '' :
                              `${f.signo < 0 ? '−' : ''}${comoPesos(f.importe)}`}
                          </td>
                        )
                      }
                      if (c.tipo === 'estado') {
                        if (f.estado === 'CALCULADO') return <td key={c.clave} />
                        const e = ESTADOS[f.estado] ?? { label: f.estado, tono: 'neutro' }
                        return (
                          <td key={c.clave}>
                            <span className={`${styles.estado} ${styles[e.tono]}`} title={e.ayuda}>
                              {e.label}
                            </span>
                          </td>
                        )
                      }
                      const valor = valorDe(c, f)
                      return (
                        <td key={c.clave} style={{ textAlign: c.align ?? 'left' }} title={valor ?? ''}>
                          {c.formato ? c.formato(valor) : (valor ?? '')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {visibles.length === 0 && (
              <div className={styles.vacio}>
                {lineas.length === 0
                  ? 'Esta quincena no está generada todavía. Generala desde Inicio.'
                  : 'Ninguna línea coincide con esos filtros.'}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
