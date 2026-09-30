import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import queryClient from './queryClient'

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      login: (token, usuario) => set({ token, usuario }),
      // Cerrar sesión vacía el caché de React Query: sin esto, quien entra
      // después en la misma pestaña ve (hasta el refetch) los datos que había
      // cargado la persona anterior. Va acá y no en cada botón porque todos los
      // caminos (Layout, Inicio, Login y el 401 de api.js) pasan por logout.
      // Primero se cancelan los pedidos en vuelo, así ninguno vuelve a llenar
      // el caché después del clear.
      logout: () => {
        queryClient.cancelQueries()
        queryClient.clear()
        set({ token: null, usuario: null })
      },
    }),
    {
      name: 'auth-asturiana',
      // version 2 (PR 3): la sesión guardada antes de los permisos por módulo
      // no tiene `modulos`; se descarta y el usuario vuelve a loguearse.
      version: 2,
      migrate: () => ({ token: null, usuario: null }),
    }
  )
)

export default useAuthStore
