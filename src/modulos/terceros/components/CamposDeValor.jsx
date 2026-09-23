import styles from '../pages/Tarifario.module.css'

// Lo que una regla resuelve: el precio y, según el tarifario, algo más —el tipo
// de viaje, la unidad que se cobra—.
//
// Se dibuja igual en los tres lugares donde se pone un precio (cargar una
// tarifa nueva, pactar lo que falta, aplicar a lo filtrado) para que sean el
// mismo gesto. Antes cada uno los ordenaba como venían y quedaban en distinto
// orden en cada pantalla.
//
// **Lo que califica al precio va antes que el precio.** El tipo de viaje dice
// de qué precio estamos hablando; leerlo después es leerlo al revés.

const ordenados = (valores) =>
  [...valores].sort((a, b) => (a.tipo === 'pesos') - (b.tipo === 'pesos'))

export default function CamposDeValor({ tarifario, valores, onCambiar, onEnter, opcional }) {
  const set = (clave, v) => onCambiar({ ...valores, [clave]: v })
  const tecla = (e) => { if (e.key === 'Enter' && onEnter) onEnter() }

  return ordenados(tarifario.valores).map(v => (
    <label key={v.clave} className={styles.campo}>
      <span className={styles.campoLabel}>
        {v.label}{v.requerida && !opcional ? ' *' : ''}
      </span>
      {v.tipo === 'opciones' ? (
        <select className="input" value={valores[v.clave] ?? ''}
                onChange={e => set(v.clave, e.target.value)}>
          <option value="">{opcional ? 'dejar como está' : 'elegir…'}</option>
          {v.opciones.map(o => (
            <option key={o} value={o}>{v.etiquetas?.[o] ?? o}</option>
          ))}
        </select>
      ) : (
        <input className="input" type="number" step="0.01" placeholder="0,00"
               style={{ width: 130, textAlign: 'right' }}
               value={valores[v.clave] ?? ''}
               onChange={e => set(v.clave, e.target.value)}
               onKeyDown={tecla} />
      )}
    </label>
  ))
}

// Si están los campos que el tarifario exige. El precio siempre hace falta: una
// regla sin precio no resuelve nada.
export const completo = (tarifario, valores) =>
  tarifario.valores.every(v => !v.requerida || valores[v.clave]) && !!valores.precio
