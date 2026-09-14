import {
  listarViajes, listarCombustible, listarRepuestos, obtenerHorasTaller,
} from './services/terceros'
import { comoEntero, comoHoras, comoNumero, comoPesos } from './formato'

// Los cuatro conjuntos de la quincena, declarados una sola vez.
//
// La clave de caché vive acá y no en cada pantalla por una razón concreta: la
// portada y la pantalla del conjunto piden lo mismo, y si cada una armara su
// clave, React Query las trataría como dos consultas distintas y pediría los
// datos dos veces. Con las horas de taller eso significaba bajar el Sheet de
// 1,3 MB dos veces por pantalla.
//
// `filas` existe porque /horas-taller no devuelve una lista sino
// { horas, estados }: las dos cosas salen de la misma lectura del Sheet.

export const claveQuery = (clave, quincena) => ['terceros', clave, quincena]

export const CONJUNTOS = [
  {
    clave: 'viajes',
    titulo: 'Viajes',
    unidad: 'viajes',
    traer: listarViajes,
    filas: (data) => data,
    campo: 'cantidadviajes',
    formato: comoNumero,
  },
  {
    clave: 'combustible',
    titulo: 'Combustible',
    unidad: 'litros',
    traer: listarCombustible,
    filas: (data) => data,
    campo: 'litros_cargados',
    formato: comoEntero,
  },
  {
    clave: 'repuestos',
    titulo: 'Repuestos',
    unidad: 'pesos',
    traer: listarRepuestos,
    filas: (data) => data,
    campo: 'monto_total',
    formato: comoPesos,
  },
  {
    clave: 'horas-taller',
    titulo: 'Horas de taller',
    unidad: 'horas',
    traer: obtenerHorasTaller,
    filas: (data) => data?.horas ?? [],
    campo: 'horas_total',
    formato: comoHoras,
  },
]

export const conjuntoPorClave = (clave) => CONJUNTOS.find(c => c.clave === clave)
