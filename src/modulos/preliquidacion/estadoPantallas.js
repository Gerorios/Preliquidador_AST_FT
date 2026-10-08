import { useCallback, useRef } from 'react'
import { create } from 'zustand'
import useAuthStore from '../../core/authStore'
import { conectarCierreDeSesion, resolverValor } from './pages/estadoGuardado'

// Estado de cada pantalla del módulo (filtros, búsqueda, quincena elegida,
// solapa, sección, orden) que sobrevive al ir y volver entre pantallas: si se
// filtra Revisión, se pasa a Conceptos y se vuelve, Revisión sigue filtrada.
// Vive en memoria: recargar la página, cerrar sesión o entrar con otro usuario
// lo vuelve a cero.
const useEstado = create(set => ({
  valores: {},
  poner: (clave, valor) => set(s => ({ valores: { ...s.valores, [clave]: valor } })),
  limpiar: () => set({ valores: {} }),
}))

// Cerrar sesión borra todo, y también entrar con otro usuario sin haberla
// cerrado (cualquier cambio de token): quien entra después en la misma pestaña
// no ve los filtros de la persona anterior.
conectarCierreDeSesion(useAuthStore, () => useEstado.getState().limpiar())

// Como useState, pero guardado por `clave` (por ejemplo 'revision.filtros').
// Acepta un valor o una función del valor anterior, igual que useState.
export function useEstadoPantalla(clave, inicial) {
  const inicialRef = useRef(inicial)
  const guardado = useEstado(s => s.valores[clave])
  const poner = useEstado(s => s.poner)
  const valor = guardado === undefined ? inicialRef.current : guardado

  const setValor = useCallback(v => {
    const previo = useEstado.getState().valores[clave]
    poner(clave, resolverValor(previo, inicialRef.current, v))
  }, [clave, poner])

  return [valor, setValor]
}
