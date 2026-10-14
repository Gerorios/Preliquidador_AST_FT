import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAuthStore from './authStore'
import { obtenerUsuarioActual } from './sesionApi'
import { fusionarSesion } from './sesion'

// Refresca el usuario de la sesión con `/auth/me` (ADR-0020): un cambio de
// roles en Administración se ve sin volver a entrar, al volver a la pestaña o
// al cambiar de pantalla, de a lo sumo una vez por minuto. Lo llama
// ProtectedRoute; las instancias anidadas comparten la consulta.
//
// - `refetchOnWindowFocus` va sólo acá: queryClient.js lo apaga para todo.
// - La clave lleva el token: si cambia la persona (o la sesión) es otra
//   consulta, y la respuesta de la sesión anterior no pisa la nueva.
// - Un 401 lo maneja el interceptor de api.js (logout y /login); cualquier otro
//   error deja la sesión guardada como estaba.
// - `actualizarUsuario` no toca el token, así que no limpia el estado guardado
//   por pantalla (`conectarCierreDeSesion` sólo reacciona a cambios de token).
export default function usePermisosAlDia() {
  const token = useAuthStore(s => s.token)
  const actualizarUsuario = useAuthStore(s => s.actualizarUsuario)

  const { data } = useQuery({
    queryKey: ['sesion-me', token],
    queryFn: obtenerUsuarioActual,
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  // El efecto corre también al montar otra pantalla con la respuesta ya en el
  // caché: si no cambió nada, no se toca el store (evita volver a dibujar todo
  // lo que lee `usuario`).
  useEffect(() => {
    if (!data) return
    const { token: actual, usuario } = useAuthStore.getState()
    if (actual !== token) return
    const nuevo = fusionarSesion(usuario, data)
    if (JSON.stringify({ ...usuario, ...nuevo }) === JSON.stringify(usuario)) return
    actualizarUsuario(nuevo)
  }, [data, token, actualizarUsuario])
}
