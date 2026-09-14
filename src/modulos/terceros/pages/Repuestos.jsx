import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoNumero, comoPesos } from '../formato'

// Las dos fechas van juntas a propósito: hoy se imputa por la del movimiento y
// la correcta es la de la descarga. Verlas al lado es lo que deja ver el desvío
// antes de que el cambio de criterio mueva plata de quincena.
const columnas = [
  { clave: 'fecha', label: 'Fecha mov.', formato: comoFecha },
  { clave: 'fecha_descarga', label: 'Fecha descarga', formato: comoFecha },
  { clave: 'maquina', label: 'Máquina' },
  { clave: 'rubro', label: 'Rubro' },
  { clave: 'repuesto', label: 'Repuesto' },
  { clave: 'cantidad', label: 'Cantidad', align: 'right', formato: comoNumero },
  { clave: 'precargas', label: 'Precio', align: 'right', formato: comoPesos },
  { clave: 'monto_total', label: 'Importe', align: 'right', formato: comoPesos },
  { clave: 'nombreprove', label: 'Proveedor' },
]

export default function Repuestos() {
  return (
    <PantallaConjunto
      clave="repuestos"
      columnas={columnas}
      ayuda="Salidas del taller hacia maquinaria de terceros. Se muestran las dos fechas: hoy la quincena se decide por la del movimiento, y la correcta es la de la descarga a la maquinaria. Donde no coinciden, el cambio de criterio va a mover esa línea de quincena."
    />
  )
}
