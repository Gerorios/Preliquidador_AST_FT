import { ATAJOS_RESUMEN } from '../periodo'
import { OTRO_PERIODO, periodoElegido } from '../vistaResumen'
import styles from './SelectorMeses.module.css'

// Período del Resumen (plan E3, FA5): va primero en la barra común, en el
// lugar de la quincena. "Otro período" abre Desde y Hasta por mes, porque el
// Resumen pide meses ("AAAA-MM").
//
// `valor`: { atajo, desde?, hasta? }; qué meses pide lo dice periodoElegido y
// si el rango es válido, rangoValido (periodo.js). El backend manda (422
// `rango_invalido`).

// El mes en curso como "AAAA-MM": el tope de los dos campos de mes.
const mesDe = hoy => `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`

export default function SelectorMeses({ valor, onChange, hoy }) {
  const elegirAtajo = id => {
    // "Otro período" arranca en el que se estaba viendo, para ajustarlo.
    onChange(id === OTRO_PERIODO
      ? { atajo: OTRO_PERIODO, ...periodoElegido(valor, hoy) }
      : { atajo: id })
  }

  const tope = mesDe(hoy)
  const otro = valor.atajo === OTRO_PERIODO

  return (
    <div className={styles.periodo} role="group" aria-label="Período">
      <select
        className="input"
        aria-label="Atajo de período"
        value={valor.atajo}
        onChange={e => elegirAtajo(e.target.value)}
      >
        {ATAJOS_RESUMEN.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        <option value={OTRO_PERIODO}>Otro período</option>
      </select>
      {otro && (
        <>
          <input
            className={`input ${styles.mes}`}
            type="month"
            aria-label="Desde"
            max={tope}
            value={valor.desde ?? ''}
            onChange={e => onChange({ ...valor, desde: e.target.value })}
          />
          <span className={styles.a}>a</span>
          <input
            className={`input ${styles.mes}`}
            type="month"
            aria-label="Hasta"
            max={tope}
            value={valor.hasta ?? ''}
            onChange={e => onChange({ ...valor, hasta: e.target.value })}
          />
        </>
      )}
    </div>
  )
}
