import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './core/layout/Layout'
import ProtectedRoute, { homeDeRol } from './core/layout/ProtectedRoute'
import CargandoContenido from './core/ui/CargandoContenido'
import useAuthStore from './core/authStore'

const Login = lazy(() => import('./core/pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Revision = lazy(() => import('./pages/Revision'))
const Verificacion = lazy(() => import('./pages/Verificacion'))
const Conceptos = lazy(() => import('./pages/Conceptos'))
const CategoriasOperarios = lazy(() => import('./pages/CategoriasOperarios'))
const Gerencial = lazy(() => import('./pages/Gerencial'))

const OPERATIVO = ['admin', 'jefe']
const TODOS = ['admin', 'jefe', 'gerente']

function HomePorRol() {
  const { usuario } = useAuthStore()
  return <Navigate to={homeDeRol(usuario?.rol)} replace />
}

export default function App() {
  return (
    <Suspense fallback={<CargandoContenido texto="Cargando…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<HomePorRol />} />
          <Route path="dashboard" element={<ProtectedRoute roles={OPERATIVO}><Dashboard /></ProtectedRoute>} />
          <Route path="revision/:id" element={<ProtectedRoute roles={OPERATIVO}><Revision /></ProtectedRoute>} />
          <Route path="verificacion" element={<ProtectedRoute roles={OPERATIVO}><Verificacion /></ProtectedRoute>} />
          <Route path="conceptos" element={<ProtectedRoute roles={TODOS}><Conceptos /></ProtectedRoute>} />
          <Route path="categorias-operarios" element={<ProtectedRoute roles={OPERATIVO}><CategoriasOperarios /></ProtectedRoute>} />
          <Route path="gerencial" element={<ProtectedRoute roles={TODOS}><Gerencial /></ProtectedRoute>} />
        </Route>
        <Route path="*" element={<HomePorRol />} />
      </Routes>
    </Suspense>
  )
}
