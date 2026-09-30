import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CamposDeValor, { completo } from './CamposDeValor'
import FiltroMultiple from './FiltroMultiple'
import { crearTarifasEnLote } from '../services/terceros'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import { comoEntero, comoNumero } from '../formato'
import styles from '../pages/Tarifario.module.css'

// Las combinaciones que la quincena tiene y el tarifario no.
//
// Es la diferencia entre "cargá las tarifas" y "poné estos precios". Agosto
// tiene 44 combinaciones de horas de servicio sin precio: tipear
// `tercero | cliente | finca | tarea` cuarenta y cuatro veces, de memoria y sin
// saber cuáles existen, es exactamente lo que el módulo vino a sacar.
//
// **Se filtra y se aplica a lo filtrado**, igual que en todo el módulo. En la
// práctica el precio se pacta por tarea o por dueño, así que las 44 suelen ser
// cuatro o cinco precios: filtrar por tarea y poner un número.
//
// Van de la que más líneas alcanza a la que menos, que es el orden en que
// conviene pactarlas: la primera mueve el recibo mucho más que la última.

export default function SinPrecio({ tipo, tarifario, quincena, combinaciones, onVolver }) {
  const [filtros, setFiltros] = useState({})
  const [valores, setValores] = useState({})
  const qc = useQueryClient()

  const claves = useMemo(
    () => tarifario.dimensiones.map(d => d.clave), [tarifario])

  const faltan = useMemo(
    () => combinaciones.filter(c => c.sin_precio > 0), [combinaciones])

  const opciones = useMemo(
    () => opcionesCascada(faltan, claves, filtros), [faltan, claves, filtros])

  const visibles = useMemo(
    () => faltan.filter(c => pasaFiltros(c, claves, filtros)), [faltan, claves, filtros])

  const cargar = useMutation({
    mutationFn: () => crearTarifasEnLote(tipo, quincena, visibles.map(c => ({
      ...Object.fromEntries(claves.map(d => [d, c[d]])),
      ...valores,
    }))),
    onSuccess: (d) => {
      toast.success(`${comoEntero(d.cargadas)} precio(s) cargados`)
      // Lo que no entró se dice, no se traga: si una combinación ya tenía
      // regla, el liquidador tiene que enterarse de que quedó como estaba.
      if (d.rechazadas.length) {
        toast.error(`${comoEntero(d.rechazadas.length)} no entraron: ${d.rechazadas[0]}`)
      }
      setValores({})
      qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'liquidaciones'] })
    },
    onError: err => toast.error(err.message),
  })

  if (faltan.length === 0) {
    return (
      <div className={styles.vacio}>
        Toda la quincena tiene precio en este tarifario.
      </div>
    )
  }

  const listo = visibles.length > 0 && completo(tarifario, valores)
  const lineas = visibles.reduce((n, c) => n + c.sin_precio, 0)
  const lineasTotal = faltan.reduce((n, c) => n + c.sin_precio, 0)
  const hayFiltro = Object.values(filtros).some(s => s?.size)

  return (
    <>
      {/* La vista tiene que decir en qué está: sin esto se parece tanto a la de
          cargadas que tocar el botón parecía no hacer nada. */}
      <div className={styles.bannerSin}>
        <div>
          <div className={styles.bannerTitulo}>
            Faltan pactar {comoEntero(lineasTotal)} línea(s), en {comoEntero(faltan.length)} combinación(es)
          </div>
        </div>
        {onVolver && (
          <button className="btn btn-sm" onClick={onVolver}>Volver a las cargadas</button>
        )}
      </div>

      <div className={styles.nuevaCaja}>
        <span className={styles.nuevaTitulo}>Poner precio a las {comoEntero(visibles.length)} de abajo</span>
        <CamposDeValor tarifario={tarifario} valores={valores}
                       onCambiar={setValores}
                       onEnter={() => { if (listo) cargar.mutate() }} />
        <button className="btn btn-primary btn-sm" disabled={!listo || cargar.isPending}
                onClick={() => cargar.mutate()}>
          {cargar.isPending ? 'Cargando…' : `Aplicar (${comoEntero(visibles.length)})`}
        </button>
      </div>

      <div className={`${styles.tabla} ${styles.tablaSin}`}>
      {Object.keys(opciones).length > 0 && (
        <div className={styles.barraFiltros}>
          <span className={styles.barraTitulo}>Filtrar esta tabla</span>
          {tarifario.dimensiones.filter(d => opciones[d.clave]).map(d => (
            <FiltroMultiple
              key={d.clave} label={d.label} valores={opciones[d.clave]}
              seleccion={filtros[d.clave] ?? new Set()}
              onCambiar={sel => setFiltros(f => ({ ...f, [d.clave]: sel }))}
            />
          ))}
          {hayFiltro && (
            <button className={styles.limpiar} onClick={() => setFiltros({})}>
              Limpiar filtros
            </button>
          )}
          <span className={styles.cuentaFiltro}>
            {comoEntero(visibles.length)} de {comoEntero(faltan.length)},
            {' '}{comoEntero(lineas)} línea(s)
          </span>
        </div>
      )}
      <table>
        <thead>
          <tr>
            {tarifario.dimensiones.map(d => <th key={d.clave}>{d.label}</th>)}
            <th style={{ textAlign: 'right' }}>Líneas</th>
            <th style={{ textAlign: 'right' }}>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((c, i) => (
            <tr key={i}>
              {tarifario.dimensiones.map(d => (
                <td key={d.clave}>
                  {c[d.clave] ?? <span className={styles.cualquiera}>—</span>}
                </td>
              ))}
              <td style={{ textAlign: 'right' }}>{comoEntero(c.sin_precio)}</td>
              <td style={{ textAlign: 'right' }}>{comoNumero(c.cantidad)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {visibles.length === 0 && (
        <div className={styles.vacio}>Ninguna coincide con esos filtros.</div>
      )}
      </div>
    </>
  )
}
