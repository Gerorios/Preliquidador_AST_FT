import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoHoras, comoNumero } from '../formato'

// Lo que la maquinaria del tercero trabajó en nuestras fincas: es lo que se le
// PAGA. Va en el sentido contrario a las Horas de reparación, que son el taller
// arreglándole la máquina.
//
// Las dos medidas se muestran juntas a propósito. Sobre cuál se paga decide la
// Unidad base de la tarifa y no el dato, así que hasta que exista el tarifario
// las dos tienen que estar a la vista: hay tareas que se pagan por hora y otras
// por cantidad (las bins de las manitou).
//
// `unidad` es lo que la tarea mide, no cómo se paga. Son cosas distintas: una
// tarea medida en bins puede pagarse igual por hora.
const columnas = [
  { clave: 'fecha', label: 'Fecha', formato: comoFecha },
  { clave: 'tercero', label: 'Tercero' },
  { clave: 'maquinaria', label: 'Máquina' },
  { clave: 'cliente', label: 'Cliente' },
  { clave: 'finca', label: 'Finca' },
  { clave: 'tarea', label: 'Tarea' },
  { clave: 'planilla', label: 'Planilla' },
  { clave: 'supervisor', label: 'Supervisor' },
  { clave: 'horas_maquina', label: 'Hs máquina', align: 'right', formato: comoHoras },
  { clave: 'unidades', label: 'Cantidad', align: 'right', formato: comoNumero },
  { clave: 'unidad', label: 'Unidad' },
]

export default function HorasServicio() {
  return (
    <PantallaConjunto
      clave="horas-servicio"
      columnas={columnas}
      ayuda="Trabajo de la maquinaria de cada tercero en las fincas: se le PAGA. Sale de tres partes diarios del sistema de campo — cosecha, maquinaria y pulverizadas — y la columna Planilla dice de cuál vino cada fila. Se muestran las dos medidas sobre las que se puede pactar, horas de máquina y cantidad, porque sobre cuál se paga decide la tarifa de cada dueño. Cantidad solo viene en la planilla de maquinaria, y Unidad dice de qué son: bins, tancadas u horas."
    />
  )
}
