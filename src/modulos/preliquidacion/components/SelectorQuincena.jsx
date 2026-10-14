import { formatoQuincena } from '../pages/formatoQuincena'

// Selector de quincena común a todas las pantallas: misma lista (las
// preliquidaciones generadas, la más nueva primero) y mismo formato.
// `value` y `onChange` trabajan con el id de la preliquidación.
export default function SelectorQuincena({ preliquidaciones = [], value, onChange }) {
  return (
    <select
      className="input"
      aria-label="Quincena"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
      style={{ width: 240 }}
    >
      {!value && <option value="">Elegí una quincena</option>}
      {preliquidaciones.map(p => (
        <option key={p.id} value={p.id}>{formatoQuincena(p.quincena)}</option>
      ))}
    </select>
  )
}
