import { useState, useEffect } from 'react'

// Input de búsqueda dueño de su propio texto: cada tecla re-renderiza solo
// este componente, y recién el valor debounceado se propaga con onChange.
// Evita que tipear re-renderice la página contenedora (tablas grandes).
// `value` es el valor debounceado del padre: solo se usa para detectar un
// borrado externo (ej. botón "Limpiar") y vaciar el texto local.
export default function InputBusqueda({ value = '', onChange, placeholder, style, delay = 200 }) {
  const [texto, setTexto] = useState(value)

  useEffect(() => {
    if (texto === value) return
    const t = setTimeout(() => onChange(texto), delay)
    return () => clearTimeout(t)
  }, [texto])

  useEffect(() => {
    if (value === '' && texto !== '') setTexto('')
  }, [value])

  return (
    <input
      className="input"
      style={style}
      placeholder={placeholder}
      value={texto}
      onChange={e => setTexto(e.target.value)}
    />
  )
}
