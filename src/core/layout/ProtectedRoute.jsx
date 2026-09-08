import { Navigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { tienePermiso } from '../permisos'

// Sin sesión → login. Con sesión pero sin permiso en el módulo de la ruta →
// vuelta al Inicio, que solo muestra tarjetas de módulos a los que sí accede.
export default function ProtectedRoute({ modulo, roles, children }) {
  const { token, usuario } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (modulo && !tienePermiso(usuario, modulo, roles)) return <Navigate to="/" replace />
  return children
}
