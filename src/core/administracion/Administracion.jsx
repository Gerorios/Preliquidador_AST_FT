import { useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import BarraSuperior from '../layout/BarraSuperior'

// Andamio mínimo: la pantalla real (listado, alta e invitación de usuarios) la
// completa una task siguiente. Esto solo hace que la ruta resuelva.
export default function Administracion() {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()

  const salir = () => {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <BarraSuperior usuario={usuario} etiqueta="Admin" onSalir={salir} volverA="/" titulo="Administración" />
      <p style={{ padding: 24 }}>En preparación.</p>
    </div>
  )
}
