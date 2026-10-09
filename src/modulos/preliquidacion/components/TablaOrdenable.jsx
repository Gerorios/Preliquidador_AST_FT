import Icono from '../../../core/ui/iconos'
import { ordenarFilas, siguienteOrden } from '../pages/ordenarFilas'
import styles from './TablaOrdenable.module.css'

// Encabezado de columna que ordena, para tablas con estructura propia (por
// ejemplo con fila de totales) que no usan TablaOrdenable entera.
export function EncabezadoOrdenable({ columna, orden, onOrden }) {
  const activa = orden?.clave === columna.clave
  return (
    <th
      scope="col"
      className={columna.numerica ? styles.derecha : undefined}
      aria-sort={activa ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button type="button" className={styles.encabezado} onClick={() => onOrden(siguienteOrden(orden, columna.clave, columna.numerica))}>
        {columna.label}
        <span className={`${styles.flecha} ${activa ? styles.flechaActiva : ''}`}>
          <Icono nombre={activa && orden.dir === 'asc' ? 'arriba' : 'abajo'} size={13} />
        </span>
      </button>
    </th>
  )
}

// Tabla de Verificación: cada encabezado ordena (de mayor a menor en números,
// de A a Z en texto; un segundo click invierte y un tercero vuelve al orden
// original) y cada fila abre su detalle. `columnas`: { clave, label, valor
// (fila → valor para ordenar), mostrar? (fila → lo que se ve), numerica?,
// ancho? }. El orden lo guarda la pantalla (`orden` / `onOrden`), así se
// conserva al ir y volver.
export default function TablaOrdenable({ columnas, filas, claveFila, orden, onOrden, onAbrir, etiquetaFila }) {
  const ordenadas = ordenarFilas(filas, columnas, orden)

  return (
    <div className={styles.contenedor}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            {columnas.map(c => (
              <EncabezadoOrdenable key={c.clave} columna={c} orden={orden} onOrden={onOrden} />
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map(f => (
            <tr
              key={claveFila(f)}
              tabIndex={0}
              className={styles.fila}
              onClick={() => onAbrir(f)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(f) } }}
              aria-label={etiquetaFila ? `Ver detalle de ${etiquetaFila(f)}` : undefined}
            >
              {columnas.map(c => (
                <td key={c.clave} className={c.numerica ? `${styles.derecha} mono` : undefined}>
                  {c.mostrar ? c.mostrar(f) : (c.valor(f) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
