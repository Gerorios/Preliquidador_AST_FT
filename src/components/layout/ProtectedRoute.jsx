import { Navigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

// Página de inicio según rol: el gerente solo ve la vista gerencial.
export const homeDeRol = (rol) => (rol === 'gerente' ? '/gerencial' : '/dashboard')

export default function ProtectedRoute({ roles, children }) {
  const { token, usuario } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (roles && usuario && !roles.includes(usuario.rol)) {
    return <Navigate to={homeDeRol(usuario.rol)} replace />
  }
  return children
}
