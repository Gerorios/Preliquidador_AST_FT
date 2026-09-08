import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      login: (token, usuario) => set({ token, usuario }),
      logout: () => set({ token: null, usuario: null }),
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
