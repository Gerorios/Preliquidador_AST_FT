import { useNavigate } from 'react-router-dom'
import useAuthStore from '../authStore'
import BarraSuperior from '../layout/BarraSuperior'

// Andamio mínimo: el formulario real lo completa una task siguiente. Esto
// solo hace que la ruta resuelva.
export default function CambiarPassword() {
  const navigate = useNavigate()
  const { usuario, logout } = useAuthStore()

  const salir = () => {
    logout()
    navigate('/login')
  }

  return (
    <div>
      <BarraSuperior usuario={usuario} etiqueta="" onSalir={salir} volverA="/" titulo="Cambiar mi contraseña" />
      <p style={{ padding: 24 }}>En preparación.</p>
    </div>
  )
}
