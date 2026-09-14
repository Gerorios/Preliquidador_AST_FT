import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoHoras } from '../formato'

const columnas = [
  { clave: 'fecha', label: 'Fecha', formato: comoFecha },
  { clave: 'tercero', label: 'Tercero' },
  { clave: 'maquina', label: 'Máquina' },
  { clave: 'rubro', label: 'Rubro' },
  { clave: 'sub_rubro', label: 'Trabajo' },
  { clave: 'lugar', label: 'Lugar' },
  { clave: 'estado', label: 'Estado' },
  { clave: 'horas', label: 'Horas', align: 'right', formato: comoHoras },
  { clave: 'horas_preparacion', label: 'Prep.', align: 'right', formato: comoHoras },
  { clave: 'horas_traslado', label: 'Traslado', align: 'right', formato: comoHoras },
  { clave: 'horas_total', label: 'Total', align: 'right', formato: comoHoras },
]

export default function HorasTaller() {
  return (
    <PantallaConjunto
      clave="horas-taller"
      columnas={columnas}
      ayuda="Mano de obra del taller aplicada a máquinas de terceros. Solo se cobran las aprobadas: una pendiente espera a que el taller la apruebe y entra en la quincena que esté abierta. Las rechazadas no aparecen acá; se cuentan en la portada del módulo."
    />
  )
}
