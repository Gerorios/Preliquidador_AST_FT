import PantallaConjunto from '../components/PantallaConjunto'
import { comoFecha, comoHoras, comoNumero } from '../formato'

// Lo que la maquinaria del tercero trabajó en nuestras fincas: es lo que se le
// PAGA. Va en el sentido contrario a las Horas de reparación, que son el taller
// arreglándole la máquina.
//
// Las tres medidas se muestran juntas a propósito. Sobre cuál se paga decide la
// Unidad base de la tarifa y no el dato, así que hasta que exista el tarifario
// las tres tienen que estar a la vista: entre hora de jornal y hora de máquina
// hay 4.177 horas de diferencia en 2026, y hay tareas que se miden en bins.
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
  { clave: 'horas_jornal', label: 'Hs jornal', align: 'right', formato: comoHoras },
  { clave: 'horas_maquina', label: 'Hs máquina', align: 'right', formato: comoHoras },
  { clave: 'unidades', label: 'Cantidad', align: 'right', formato: comoNumero },
  { clave: 'unidad', label: 'Unidad' },
]

export default function HorasServicio() {
  return (
    <PantallaConjunto
      clave="horas-servicio"
      columnas={columnas}
      ayuda="Trabajo de la maquinaria de cada tercero en las fincas: se le PAGA. Sale de tres partes diarios del sistema de campo — cosecha, maquinaria y pulverizadas — y la columna Planilla dice de cuál vino cada fila. Se muestran las tres medidas posibles (horas de jornal, horas de máquina y cantidad) porque sobre cuál se paga decide la tarifa de cada dueño, no el dato. Cantidad solo viene en la planilla de maquinaria, y Unidad dice de qué son: bins, tancadas u horas."
    />
  )
}
