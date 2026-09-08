import { createContext, useContext } from 'react'

// El núcleo (carpeta core) no puede importar los módulos: si lo hiciera,
// agregar un módulo obligaría a tocar el núcleo. El contexto vive acá y el
// valor lo inyecta App.jsx, que sí conoce el registro de módulos.
export const RegistroContext = createContext(null)

export const useRegistro = () => {
  const registro = useContext(RegistroContext)
  if (!registro) throw new Error('useRegistro() fuera de <RegistroContext.Provider>')
  return registro
}
