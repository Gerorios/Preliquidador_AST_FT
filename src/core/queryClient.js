import { QueryClient } from '@tanstack/react-query'

// La instancia vive en su propio archivo (y no en main.jsx) para que el
// authStore pueda vaciar el caché al cerrar sesión sin importar main.jsx,
// que es el punto de entrada y montaría la app otra vez.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
})

export default queryClient
