import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams, generatePath } from 'react-router-dom'
import Layout from './core/layout/Layout'
import ProtectedRoute, { homeDeRol } from './core/layout/ProtectedRoute'
import CargandoContenido from './core/ui/CargandoContenido'
import useAuthStore from './core/authStore'
import { rutas as rutasPreliquidacion, redirecciones as redirPreliquidacion } from './modulos/preliquidacion/rutas'

const Login = lazy(() => import('./core/pages/Login'))

// Un módulo nuevo se registra agregando sus listas acá y en Layout.jsx.
const RUTAS = [...rutasPreliquidacion]
const REDIRECCIONES = [...redirPreliquidacion]

function HomePorRol() {
  const { usuario } = useAuthStore()
  return <Navigate to={homeDeRol(usuario?.rol)} replace />
}

// Redirección que conserva los parámetros de la URL (p. ej. /revision/12 → /preliquidacion/revision/12).
function Redireccion({ to }) {
  const params = useParams()
  return <Navigate to={generatePath(to, params)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<CargandoContenido texto="Cargando…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePorRol />} />
          {RUTAS.map(({ path, element, roles }) => (
            <Route key={path} path={path} element={<ProtectedRoute roles={roles}>{element}</ProtectedRoute>} />
          ))}
          {REDIRECCIONES.map(({ from, to }) => (
            <Route key={from} path={from} element={<Redireccion to={to} />} />
          ))}
        </Route>
        <Route path="*" element={<HomePorRol />} />
      </Routes>
    </Suspense>
  )
}
