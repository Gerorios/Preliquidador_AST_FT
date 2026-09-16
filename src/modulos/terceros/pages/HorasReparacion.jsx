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

export default function HorasReparacion() {
  return (
    <PantallaConjunto
      clave="horas-reparacion"
      columnas={columnas}
      ayuda="Mano de obra del taller de la empresa aplicada a máquinas de terceros: se le DESCUENTA al dueño. No confundir con las Horas de servicio, que son su máquina trabajando para nosotros. Solo se cobran las aprobadas: una pendiente espera, y entra en la quincena que esté abierta cuando se apruebe. Las rechazadas no aparecen acá; se cuentan en la portada."
    />
  )
}
