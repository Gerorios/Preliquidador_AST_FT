import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import SelectorQuincena from './SelectorQuincena'
import useQuincenaStore from '../quincenaStore'
import { claveQuery, conjuntoPorClave } from '../conjuntos'
import styles from './PantallaConjunto.module.css'

/**
 * El molde de las cuatro pantallas de la etapa 2. Las cuatro hacen lo mismo:
 * elegir quincena, traer un conjunto de solo lectura y mostrarlo con un
 * buscador y orden por columna. Cada pantalla aporta su clave y sus columnas.
 *
 * La consulta se arma con la clave compartida de `conjuntos.js`, así la portada
 * y esta pantalla usan la misma entrada de caché: entrar acá desde la portada
 * no vuelve a pedir nada.
 *
 * El filtro y el orden son en memoria a propósito: el conjunto más grande de
 * 2026 son 756 filas, ya están todas en el navegador, y filtrar contra el
 * servidor agregaría segundos de espera a cada tecla contra dos bases externas
 * y un Google Sheet.
 *
 * columnas: [{ clave, label, align?, formato? }]
 */
export default function PantallaConjunto({ clave, columnas, ayuda }) {
  const conjunto = conjuntoPorClave(clave)
  const quincena = useQuincenaStore(s => s.quincena)
  const [busqueda, setBusqueda] = useState('')
  const [orden, setOrden] = useState({ clave: null, asc: true })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: claveQuery(clave, quincena),
    queryFn: () => conjunto.traer(quincena),
    enabled: !!quincena,
    retry: false,
  })

  const filas = useMemo(() => (data ? conjunto.filas(data) : []), [data, conjunto])

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const filtradas = !q ? filas : filas.filter(f =>
      columnas.some(c => String(f[c.clave] ?? '').toLowerCase().includes(q))
    )
    if (!orden.clave) return filtradas
    const copia = [...filtradas]
    copia.sort((a, b) => {
      const x = a[orden.clave], y = b[orden.clave]
      if (x === y) return 0
      if (x === null || x === undefined || x === '') return 1   // los vacíos, al final
      if (y === null || y === undefined || y === '') return -1
      const numericos = !isNaN(Number(x)) && !isNaN(Number(y))
      const cmp = numericos ? Number(x) - Number(y) : String(x).localeCompare(String(y), 'es')
      return orden.asc ? cmp : -cmp
    })
    return copia
  }, [filas, busqueda, orden, columnas])

  const ordenarPor = (col) =>
    setOrden(o => (o.clave === col ? { clave: col, asc: !o.asc } : { clave: col, asc: true }))

  return (
    <div className={styles.page}>
      <div className={styles.topbar}>
        <div className={styles.titulo}>{conjunto.titulo}</div>
        <SelectorQuincena />
        <input
          className="input"
          style={{ width: 240 }}
          placeholder="Buscar en la tabla…"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <div className={styles.count}>
          {busqueda && visibles.length !== filas.length
            ? `${visibles.length} de ${filas.length} filas`
            : `${filas.length} filas`}
        </div>
      </div>

      {ayuda && <div className={styles.ayuda}>{ayuda}</div>}

      <div className={styles.content}>
        {!quincena && <div className={styles.empty}>Elegí una quincena para ver los datos.</div>}
        {quincena && isLoading && <CargandoContenido />}
        {quincena && isError && (
          <div className={styles.error}>
            <div className={styles.errorTitulo}>No se pudo leer el origen</div>
            <div>{error.message}</div>
          </div>
        )}
        {quincena && !isLoading && !isError && filas.length === 0 && (
          <div className={styles.empty}>Esta quincena no tiene movimientos.</div>
        )}
        {quincena && !isLoading && !isError && filas.length > 0 && (
          <table>
            <thead>
              <tr>
                {columnas.map(c => (
                  <th
                    key={c.clave}
                    onClick={() => ordenarPor(c.clave)}
                    className={styles.th}
                    style={{ textAlign: c.align ?? 'left' }}
                    title="Ordenar por esta columna"
                  >
                    {c.label}
                    {orden.clave === c.clave && <span className={styles.flecha}>{orden.asc ? '▲' : '▼'}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((f, i) => (
                <tr key={i}>
                  {columnas.map(c => (
                    <td key={c.clave} style={{ textAlign: c.align ?? 'left' }}>
                      {c.formato ? c.formato(f[c.clave], f) : (f[c.clave] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
