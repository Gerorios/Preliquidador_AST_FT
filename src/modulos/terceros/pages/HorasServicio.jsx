import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoHoras } from '../formato'

// Lo que la maquinaria del tercero trabajó en nuestras fincas: es lo que se le
// PAGA. Va en el sentido contrario a las Horas de reparación, que son el taller
// arreglándole la máquina.
//
// Las dos horas se muestran juntas a propósito. Cuál se paga lo decide la
// Unidad base de la tarifa y no el dato, así que hasta que exista el tarifario
// las dos tienen que estar a la vista: en 2026 se llevan 4.177 horas.
const columnas = [
  { clave: 'fecha', label: 'Fecha', formato: comoFecha },
  { clave: 'tercero', label: 'Tercero' },
  { clave: 'maquinaria', label: 'Máquina' },
  { clave: 'cliente', label: 'Cliente' },
  { clave: 'finca', label: 'Finca' },
  { clave: 'tarea', label: 'Tarea' },
  { clave: 'planilla', label: 'Planilla' },
  { clave: 'supervisor', label: 'Supervisor' },
  { clave: 'horas_jornal', label: 'Hs jornal', align: 'right', formato: comoHoras },
  { clave: 'horas_maquina', label: 'Hs máquina', align: 'right', formato: comoHoras },
]

export default function HorasServicio() {
  return (
    <PantallaConjunto
      clave="horas-servicio"
      columnas={columnas}
      ayuda="Horas que la maquinaria de cada tercero trabajó en las fincas: se le PAGAN. Salen de tres partes diarios del sistema de campo — cosecha, maquinaria y pulverizadas — y por eso la columna Planilla dice de cuál vino cada fila. Las dos columnas de horas están porque cuál se paga lo define la tarifa de cada dueño, no el dato."
    />
  )
}
