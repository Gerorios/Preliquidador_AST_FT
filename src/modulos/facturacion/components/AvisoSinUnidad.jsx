import Icono from '../../../core/ui/iconos'
import styles from './AvisoSinUnidad.module.css'

// Aviso sobre la tabla del Resumen (plan E3, decisión 5 y FA5; boceto F0):
// las tareas facturables sin Unidad sugerida que tuvieron trabajo en el
// período. Sus cantidades no entran en ninguna columna, así que la pantalla lo
// dice una sola vez, con un desplegable de cuáles son y en cuántos Clientes.
// No es una Alerta: no suma en los cuadros ni cambia el Estado del mes. Sin
// tareas así, no aparece.

const enClientes = n => `en ${n} ${n === 1 ? 'cliente' : 'clientes'}`

export default function AvisoSinUnidad({ tareas }) {
  if (!tareas?.length) return null
  const n = tareas.length
  const titulo = n === 1
    ? '1 tarea facturable sin Unidad sugerida tuvo trabajo en el período.'
    : `${n} tareas facturables sin Unidad sugerida tuvieron trabajo en el período.`

  return (
    <div className={styles.aviso} role="note">
      <Icono nombre="alerta" size={16} enTexto className={styles.icono} />
      <div className={styles.cuerpo}>
        <p>
          <strong>{titulo}</strong> Sus cantidades no entran en las columnas del Resumen. Se
          definen en la app de campo.
        </p>
        <details className={styles.detalle}>
          <summary>Ver cuáles</summary>
          <ul className={styles.lista}>
            {tareas.map(t => (
              <li key={t.tarea_id}>
                {t.nombre ?? `Tarea ${t.tarea_id}`}
                <span className={styles.clientes}> · {enClientes(t.clientes)}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  )
}
