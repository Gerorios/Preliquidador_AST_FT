import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Revision from './pages/Revision'
import Verificacion from './pages/Verificacion'
import Precios from './pages/Precios'
import Conceptos from './pages/Conceptos'
import Historial from './pages/Historial'

export default function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<Login />} />

      {/* Rutas protegidas */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="revision/:id" element={<Revision />} />
        <Route path="verificacion/:id" element={<Verificacion />} />
        <Route path="precios" element={<Precios />} />
        <Route path="conceptos" element={<Conceptos />} />
        <Route path="historial" element={<Historial />} />
      </Route>

      {/* Cualquier ruta desconocida → dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}