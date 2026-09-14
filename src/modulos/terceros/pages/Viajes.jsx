import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoNumero, comoEntero, comoPatente } from '../formato'

// Los viajes de la quincena tal como los cargó el supervisor en el sistema de
// campo. Todavía sin precio: la tarifa llega en la etapa 4.
const columnas = [
  { clave: 'fecha_uso', label: 'Fecha', formato: comoFecha },
  { clave: 'colectivo_patente', label: 'Patente', formato: comoPatente },
  { clave: 'colectivo_nombre', label: 'Tercero' },
  { clave: 'cliente', label: 'Cliente' },
  { clave: 'finca', label: 'Finca' },
  { clave: 'nombre_capataz', label: 'Capataz' },
  { clave: 'nombre_chofer', label: 'Chofer' },
  { clave: 'nombre_tarea', label: 'Tarea' },
  { clave: 'cantidadviajes', label: 'Viajes', align: 'right', formato: comoNumero },
  { clave: 'cantpersonas', label: 'Personas', align: 'right', formato: comoEntero },
]

export default function Viajes() {
  return (
    <PantallaConjunto
      clave="viajes"
      columnas={columnas}
      ayuda="Traslados de personal cargados en el sistema de campo. Medio viaje (0,5) es normal. El precio se pacta con cada tercero y todavía no se aplica: llega con el maestro de tarifas."
    />
  )
}
