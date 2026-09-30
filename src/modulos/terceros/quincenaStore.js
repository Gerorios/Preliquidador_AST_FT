import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// La quincena elegida es de todo el módulo, no de una pantalla: el liquidador
// mira viajes, combustible, repuestos y horas de la MISMA quincena y va y viene
// entre las cuatro. Si cada pantalla guardara la suya, bastaría un clic en el
// menú para estar comparando dos quincenas distintas sin darse cuenta.
//
// Se persiste para que volver al módulo no obligue a elegirla de nuevo. Empieza
// en null: la portada la inicializa con la más reciente que devuelve el backend,
// así no hay que calcular el calendario en dos lados.
const useQuincenaStore = create(
  persist(
    (set) => ({
      quincena: null,
      setQuincena: (quincena) => set({ quincena }),
    }),
    { name: 'terceros-quincena' }
  )
)

export default useQuincenaStore
