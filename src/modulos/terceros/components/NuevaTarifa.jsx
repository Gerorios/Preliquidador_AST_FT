import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CamposDeValor, { completo } from './CamposDeValor'
import FiltroMultiple from './FiltroMultiple'
import { crearTarifasEnLote } from '../services/terceros'
import { opcionesCascada } from '../filtrar'
import { comoEntero } from '../formato'
import styles from '../pages/Tarifario.module.css'

// Cargar reglas nuevas, con las dimensiones elegidas de lo que la quincena
// tiene y no tipeadas.
//
// Tipearlas era el error caro: un nombre tiene que coincidir **exacto** con el
// del sistema de campo o la regla no alcanza a nada, y eso no se ve hasta que
// el recibo sale mal. Acá se elige de lo que existe.
//
// Cada dimensión admite varios valores y lo que sale es una regla por
// combinación. Dos lecturas distintas, y la diferencia no es cosmética:
//
//   - **Nada tildado** = «cualquiera». Una sola regla, con la dimensión vacía,
//     que alcanza también a lo que aparezca mañana.
//   - **Tildados** —aunque sean todos— = una regla por cada uno, al mismo
//     precio. Lo que aparezca mañana NO queda alcanzado.
//
// Tildar "todos los capataces" y dejar "cualquier capataz" no son lo mismo: si
// la semana que viene entra un capataz nuevo a esa finca, con la regla general
// cobra ese precio sin que nadie lo haya pactado.

const productoCartesiano = (listas) =>
  listas.reduce((acum, lista) => acum.flatMap(x => lista.map(v => [...x, v])), [[]])

export default function NuevaTarifa({ tipo, tarifario, quincena, combinaciones }) {
  const [dims, setDims] = useState({})
  const [valores, setValores] = useState({})
  const qc = useQueryClient()

  const claves = useMemo(
    () => tarifario.dimensiones.map(d => d.clave), [tarifario])

  // Con mínimo 1: al cargar hace falta poder elegir un valor aunque sea el
  // único, que es distinto de filtrar —ahí uno solo no acota nada—.
  const opciones = useMemo(
    () => opcionesCascada(combinaciones, claves, dims, 1),
    [combinaciones, claves, dims])

  // Una regla por combinación de lo tildado. Sin nada tildado, la dimensión va
  // vacía, que es como se dice "cualquiera".
  const reglas = useMemo(() => {
    const listas = tarifario.dimensiones.map(d => {
      const elegidos = dims[d.clave]
      return elegidos?.size ? [...elegidos] : ['']
    })
    return productoCartesiano(listas).map(fila => Object.fromEntries(
      tarifario.dimensiones.map((d, i) => [d.clave, fila[i]])))
  }, [dims, tarifario])

  const faltanObligatorias = tarifario.dimensiones.some(
    d => d.obligatoria && !dims[d.clave]?.size)
  const listo = !faltanObligatorias && completo(tarifario, valores)

  const crear = useMutation({
    mutationFn: () => crearTarifasEnLote(tipo, quincena,
      reglas.map(r => ({ ...r, ...valores }))),
    onSuccess: (d) => {
      toast.success(`${comoEntero(d.cargadas)} regla(s) cargada(s)`)
      if (d.rechazadas.length) {
        toast.error(`${comoEntero(d.rechazadas.length)} no entraron: ${d.rechazadas[0]}`)
      }
      setDims({})
      setValores({})
      qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
      qc.invalidateQueries({ queryKey: ['terceros', 'liquidaciones'] })
    },
    onError: err => toast.error(err.message),
  })

  return (
    <div className={styles.nuevaCaja}>
      <span className={styles.nuevaTitulo}>Cargar tarifa</span>

      {tarifario.dimensiones.map(d => (
        <FiltroMultiple
          key={d.clave}
          label={d.obligatoria ? `${d.label} *` : d.label}
          valores={opciones[d.clave] ?? []}
          seleccion={dims[d.clave] ?? new Set()}
          todosTilda
          etiquetaVacio="cualquiera"
          onCambiar={sel => setDims(x => ({ ...x, [d.clave]: sel }))}
        />
      ))}

      <CamposDeValor tarifario={tarifario} valores={valores}
                     onCambiar={setValores}
                     onEnter={() => { if (listo) crear.mutate() }} />

      <button className="btn btn-primary btn-sm" disabled={!listo || crear.isPending}
              onClick={() => crear.mutate()}>
        {crear.isPending ? 'Cargando…'
          : reglas.length > 1 ? `Cargar ${comoEntero(reglas.length)} reglas` : 'Cargar'}
      </button>

      <span className={styles.nuevaNota}>
        {faltanObligatorias
          ? 'Elegí lo marcado con *'
          : reglas.length > 1
            ? `Se van a crear ${comoEntero(reglas.length)} reglas, una por combinación`
            : 'Lo que dejes sin elegir alcanza a todos'}
      </span>
    </div>
  )
}
