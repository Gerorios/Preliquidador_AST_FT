import { useState, useEffect, useRef } from 'react'

// Input de búsqueda dueño de su propio texto: cada tecla re-renderiza solo
// este componente, y recién el valor debounceado se propaga con onChange.
// Evita que tipear re-renderice la página contenedora (tablas grandes).
// `value` es el valor debounceado del padre: solo se usa para detectar un
// borrado externo (ej. botón "Limpiar") y vaciar el texto local.
export default function InputBusqueda({ value = '', onChange, placeholder, style, delay = 200 }) {
  const [texto, setTexto] = useState(value)

  // `onChange` va en un ref para no depender de su identidad: si el padre
  // pasara una función nueva en cada render, tenerla en las deps reiniciaría
  // el debounce a cada render del padre.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // `value` en las deps es seguro: cuando el padre iguala `value` a `texto`,
  // el efecto corta en el early return y no vuelve a llamar a onChange.
  useEffect(() => {
    if (texto === value) return
    const t = setTimeout(() => onChangeRef.current(texto), delay)
    return () => clearTimeout(t)
  }, [texto, value, delay])

  // Borrado externo: se vacía el texto sólo cuando `value` PASA a ''. No se
  // lee `texto` a propósito: con `texto` en las deps, cada tecla volvería a
  // evaluar la condición mientras el padre todavía tiene '' (antes del
  // debounce) y borraría lo que se está tipeando.
  const prevValue = useRef(value)
  useEffect(() => {
    if (prevValue.current !== '' && value === '') setTexto('')
    prevValue.current = value
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
