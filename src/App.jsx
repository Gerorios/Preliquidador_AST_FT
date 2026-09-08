import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams, generatePath, useLocation } from 'react-router-dom'
import Layout from './core/layout/Layout'
import ProtectedRoute from './core/layout/ProtectedRoute'
import CargandoContenido from './core/ui/CargandoContenido'
import useAuthStore from './core/authStore'
import { homeDeUsuario } from './core/permisos'
import { rutas as rutasPreliquidacion, redirecciones as redirPreliquidacion, home as homePreliquidacion } from './modulos/preliquidacion/rutas'

const Login = lazy(() => import('./core/pages/Login'))

// Un módulo nuevo se registra agregando sus listas acá y en Layout.jsx.
const RUTAS = [...rutasPreliquidacion]
const REDIRECCIONES = [...redirPreliquidacion]

// Home de cada módulo registrado, en orden de prioridad. Login y ProtectedRoute
// la usan para decidir a dónde manda cada usuario según sus permisos.
export const HOMES = [homePreliquidacion]

function HomeDeUsuario() {
  const { usuario } = useAuthStore()
  return <Navigate to={homeDeUsuario(usuario, HOMES)} replace />
}

// Redirección que conserva los parámetros de la URL (p. ej. /revision/12 → /preliquidacion/revision/12)
// y también query string y hash.
function Redireccion({ to }) {
  const params = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: generatePath(to, params), search, hash }} replace />
}

export default function App() {
  return (
    <Suspense fallback={<CargandoContenido texto="Cargando…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute homes={HOMES}><Layout /></ProtectedRoute>}>
          <Route index element={<HomeDeUsuario />} />
          {RUTAS.map(({ path, element, modulo, roles }) => (
            <Route key={path} path={path} element={<ProtectedRoute modulo={modulo} roles={roles} homes={HOMES}>{element}</ProtectedRoute>} />
          ))}
          {REDIRECCIONES.map(({ from, to }) => (
            <Route key={from} path={from} element={<Redireccion to={to} />} />
          ))}
        </Route>
        <Route path="*" element={<HomeDeUsuario />} />
      </Routes>
    </Suspense>
  )
}
