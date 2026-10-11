import { Navigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import { puedeVer } from '../permisos'
import usePermisosAlDia from '../usePermisosAlDia'

// Sin sesión → login. Con sesión pero sin permiso de ver la pantalla de la ruta
// (`modulo` + `pantalla`, ADR-0020) → vuelta al Inicio, que solo muestra
// tarjetas de lo que la persona sí ve. Los permisos se refrescan con
// /auth/me (usePermisosAlDia): si la persona pierde la pantalla en la que
// está, la guarda la saca al Inicio en cuanto llegan.
export default function ProtectedRoute({ modulo, pantalla, soloAdmin, children }) {
  usePermisosAlDia()
  const { token, usuario } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  // Administración es del Sistema, no de un módulo: exige el rol global.
  if (soloAdmin && usuario?.rol !== 'admin') return <Navigate to="/" replace />
  if (modulo && !puedeVer(usuario, modulo, pantalla)) return <Navigate to="/" replace />
  return children
}
