import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoNumero, comoPatente } from '../formato'

const columnas = [
  { clave: 'fecha_uso', label: 'Fecha', formato: comoFecha },
  { clave: 'colectivo_patente', label: 'Patente', formato: comoPatente },
  { clave: 'colectivo_nombre', label: 'Tercero' },
  { clave: 'vale', label: 'Vale' },
  { clave: 'litros_cargados', label: 'Litros', align: 'right', formato: comoNumero },
  { clave: 'origen_combustible', label: 'Origen' },
  { clave: 'usuario_carga', label: 'Cargó' },
]

export default function Combustible() {
  return (
    <PantallaConjunto
      clave="combustible"
      columnas={columnas}
      ayuda="Cargas de los colectivos, respaldadas por un vale. El número de vale es el que permite cruzarlas contra lo que factura cada estación; esa conciliación llega en una etapa posterior."
    />
  )
}
