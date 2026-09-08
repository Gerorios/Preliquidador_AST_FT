import { ClipLoader } from 'react-spinners'

/**
 * Loader centrado para la carga inicial de datos de una pantalla (tablas,
 * listas). Grande y claro, mismo lenguaje visual que el overlay de escritura.
 */
export default function CargandoContenido({ texto = 'Cargando datos…' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 16, padding: '64px 20px',
      color: 'var(--text-secondary)',
    }}>
      <ClipLoader color="#6D8B46" size={42} speedMultiplier={0.9} />
      <div style={{ fontSize: 14, fontWeight: 500 }}>{texto}</div>
    </div>
  )
}
