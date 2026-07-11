import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/layout/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Revision from './pages/Revision'
import Verificacion from './pages/Verificacion'
import Conceptos from './pages/Conceptos'
import Historial from './pages/Historial'
import CategoriasOperarios from './pages/CategoriasOperarios'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="revision/:id" element={<Revision />} />
        <Route path="verificacion" element={<Verificacion />} />
        <Route path="conceptos" element={<Conceptos />} />
        <Route path="categorias-operarios" element={<CategoriasOperarios />} />
        <Route path="historial" element={<Historial />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}