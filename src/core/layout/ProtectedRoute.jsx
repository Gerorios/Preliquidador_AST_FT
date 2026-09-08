import { Navigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { tienePermiso, homeDeUsuario } from '../permisos'

export default function ProtectedRoute({ modulo, roles, homes = [], children }) {
  const { token, usuario } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (modulo && !tienePermiso(usuario, modulo, roles)) {
    return <Navigate to={homeDeUsuario(usuario, homes)} replace />
  }
  return children
}
