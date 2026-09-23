import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CamposDeValor from './CamposDeValor'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import FiltroMultiple from './FiltroMultiple'
import {
  listarBienes, listarTarifas, crearTarifa, crearTarifasEnLote,
  actualizarTarifasEnLote, actualizarTarifa, eliminarTarifa,
} from '../services/terceros'
import { opcionesCascada, pasaFiltros } from '../filtrar'
import { tarifarioPorClave } from '../tarifarios'
import { comoEntero, comoPesos } from '../formato'
import styles from '../pages/Tarifario.module.css'

// Los seguros no se cargan como las otras tarifas. En las demás el liquidador
// sabe de memoria a quién le pone precio; acá son 382 bienes y personas, y el
// nombre tiene que coincidir **exacto** con el del sistema de campo o el seguro
// no se le imputa a nadie. Por eso sale de un padrón y no de tipear.
//
// Lo demás funciona igual que el resto del tarifario: **se filtra y se aplica a
// lo filtrado**. Con 382 pólizas, cargar de a una es el mismo problema que las
// 44 combinaciones de horas de servicio.

// Un bien lleva una póliza; una persona puede llevar dos.
const TIPOS_POR_ORIGEN = {
  colectivo: [{ clave: 'AUTOMOTOR', label: 'Automotor' }],
  maquinaria: [{ clave: 'AUTOMOTOR', label: 'Automotor' }],
  chofer: [
    { clave: 'RELACION_DEPENDENCIA', label: 'Relación de dependencia' },
    { clave: 'ACCIDENTES_PERSONALES', label: 'Accidentes personales' },
  ],
}

const ETIQUETA_ORIGEN = {
  colectivo: 'Colectivo', maquinaria: 'Máquina', chofer: 'Chofer',
}

// El campo del importe se dibuja con el mismo componente que el resto del
// tarifario, no a mano: si no, el mismo dato se ve distinto según la solapa.
// La referencia (patente o CUIL) no entra acá — sale del padrón, no se tipea.
const SOLO_IMPORTE = {
  valores: tarifarioPorClave('seguros').valores.filter(v => v.tipo === 'pesos'),
}

// Por qué se puede filtrar. `estado` no viene del padrón: se arma acá, y es el
// que resuelve la pregunta de todos los días —qué me falta cargar—.
const DIMENSIONES = [
  ['tercero', 'Dueño'],
  ['origenLabel', 'Qué es'],
  ['tipoLabel', 'Tipo de póliza'],
  ['estado', 'Precio'],
]

function Importe({ fila, quincena, onListo }) {
  const [valor, setValor] = useState(null)

  const guardar = useMutation({
    mutationFn: async (importe) => {
      const limpio = String(importe ?? '').trim()
      // Vaciar el importe es decir "a este no se le cobra": se borra la póliza
      // en vez de dejarla en cero, que significaría otra cosa.
      if (limpio === '') {
        if (fila.tarifa) return eliminarTarifa('seguros', fila.tarifa.id)
        return null
      }
      if (fila.tarifa) return actualizarTarifa('seguros', fila.tarifa.id, { importe: limpio })
      return crearTarifa('seguros', quincena, {
        tercero: fila.tercero, tipo_seguro: fila.tipo,
        sujeto: fila.sujeto, referencia: fila.referencia, importe: limpio,
      })
    },
    onSuccess: () => { setValor(null); onListo() },
    onError: err => { toast.error(err.message); setValor(null) },
  })

  if (valor !== null) {
    return (
      <input
        className="input" type="number" step="0.01" autoFocus
        style={{ width: 130, textAlign: 'right' }}
        value={valor}
        onChange={e => setValor(e.target.value)}
        onBlur={() => guardar.mutate(valor)}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter') guardar.mutate(valor)
          if (e.key === 'Escape') setValor(null)
        }}
      />
    )
  }
  return (
    <span className={fila.tarifa ? styles.precio : styles.cualquiera}
          title="Clic para cargar el importe"
          onClick={e => {
            e.stopPropagation()
            setValor(fila.tarifa ? String(fila.tarifa.importe) : '')
          }}>
      {fila.tarifa ? comoPesos(fila.tarifa.importe) : 'sin cargar'}
    </span>
  )
}

export default function Seguros({ quincena }) {
  const [filtros, setFiltros] = useState({})
  const [valores, setValores] = useState({})
  const importe = valores.importe ?? ''
  const qc = useQueryClient()

  const { data: padron = [], isLoading: cargandoPadron } = useQuery({
    queryKey: ['terceros', 'bienes'],
    queryFn: listarBienes,
    staleTime: 60 * 60 * 1000,   // es un padrón, no cambia dentro de una sesión
  })

  const { data: tarifas = [], isLoading } = useQuery({
    queryKey: ['terceros', 'tarifario', 'seguros', quincena],
    queryFn: () => listarTarifas('seguros', quincena),
    enabled: !!quincena,
  })

  const invalidar = () => {
    setValores({})
    qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'liquidaciones'] })
  }

  // Cada entrada del padrón se expande en una fila por cada tipo de póliza que
  // le corresponde, y se le pega la tarifa que ya exista.
  const filas = useMemo(() => {
    const porClave = new Map(
      tarifas.map(t => [`${t.tercero}|${t.tipo_seguro}|${t.sujeto}`, t])
    )
    return padron
      .filter(b => b.tercero)
      .flatMap(b => (TIPOS_POR_ORIGEN[b.origen] ?? []).map(t => {
        const tarifa = porClave.get(`${b.tercero}|${t.clave}|${b.nombre}`) ?? null
        return {
          clave: `${b.origen}-${b.id_origen}-${t.clave}`,
          origen: b.origen,
          origenLabel: ETIQUETA_ORIGEN[b.origen],
          tercero: b.tercero,
          tipo: t.clave,
          tipoLabel: t.label,
          sujeto: b.nombre,
          referencia: b.patente ?? null,
          tarifa,
          estado: tarifa ? 'Con precio' : 'Sin precio',
        }
      }))
  }, [padron, tarifas])

  const claves = useMemo(() => DIMENSIONES.map(([c]) => c), [])
  const opciones = useMemo(
    () => opcionesCascada(filas, claves, filtros), [filas, claves, filtros])
  const visibles = useMemo(
    () => filas.filter(f => pasaFiltros(f, claves, filtros)), [filas, claves, filtros])

  const hayFiltro = Object.values(filtros).some(s => s?.size)
  const conPrecio = visibles.filter(f => f.tarifa).length

  // El mismo importe para todo lo filtrado. Las que ya lo tienen se actualizan
  // y las que no, se crean: para el liquidador es el mismo gesto, y separarlo
  // en dos botones lo obligaría a saber cuál es cuál antes de apretar.
  const aplicar = useMutation({
    mutationFn: async () => {
      const nuevas = visibles.filter(f => !f.tarifa)
      const existentes = visibles.filter(f => f.tarifa)
      const partes = []
      if (nuevas.length) {
        partes.push(await crearTarifasEnLote('seguros', quincena, nuevas.map(f => ({
          tercero: f.tercero, tipo_seguro: f.tipo,
          sujeto: f.sujeto, referencia: f.referencia, importe,
        }))))
      }
      if (existentes.length) {
        partes.push(await actualizarTarifasEnLote(
          'seguros', existentes.map(f => f.tarifa.id), { importe }))
      }
      return partes.reduce(
        (a, r) => ({ cargadas: a.cargadas + r.cargadas,
                     rechazadas: [...a.rechazadas, ...r.rechazadas] }),
        { cargadas: 0, rechazadas: [] })
    },
    onSuccess: (d) => {
      toast.success(`${comoEntero(d.cargadas)} póliza(s) con importe`)
      if (d.rechazadas.length) {
        toast.error(`${comoEntero(d.rechazadas.length)} no entraron: ${d.rechazadas[0]}`)
      }
      invalidar()
    },
    onError: err => toast.error(err.message),
  })

  if (cargandoPadron || isLoading) {
    return <CargandoContenido texto="Buscando el padrón…" />
  }

  return (
    <>
      <div className={styles.filtros}>
        {DIMENSIONES.filter(([c]) => opciones[c]).map(([clave, label]) => (
          <FiltroMultiple
            key={clave} label={label} valores={opciones[clave]}
            seleccion={filtros[clave] ?? new Set()}
            onCambiar={sel => setFiltros(f => ({ ...f, [clave]: sel }))}
          />
        ))}
        {hayFiltro && (
          <button className={styles.limpiar} onClick={() => setFiltros({})}>
            Limpiar filtros
          </button>
        )}
        <span className={styles.cuentaFiltro}>
          {comoEntero(conPrecio)} de {comoEntero(visibles.length)} con importe
        </span>
      </div>

      <div className={styles.nuevaCaja}>
        <span className={styles.nuevaTitulo}>Cargar tarifa</span>
        <CamposDeValor tarifario={SOLO_IMPORTE} valores={valores}
                       onCambiar={setValores}
                       onEnter={() => {
                         if (visibles.length && importe) aplicar.mutate()
                       }} />
        <button className="btn btn-primary btn-sm"
                disabled={!visibles.length || !importe || aplicar.isPending}
                onClick={() => aplicar.mutate()}>
          {aplicar.isPending ? 'Cargando…' : `Aplicar (${comoEntero(visibles.length)})`}
        </button>
        <span className={styles.nuevaNota}>
          Vaciar el importe de una fila borra la póliza: cero significa que no se le cobra
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th>Dueño</th>
            <th>Qué es</th>
            <th>Máquina o chofer</th>
            <th>Patente o CUIL</th>
            <th>Tipo de póliza</th>
            <th style={{ textAlign: 'right' }}>Importe</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map(f => (
            <tr key={f.clave}>
              <td>{f.tercero}</td>
              <td className={styles.cualquiera}>{f.origenLabel}</td>
              <td>{f.sujeto}</td>
              <td>{f.referencia ?? <span className={styles.cualquiera}>—</span>}</td>
              <td>{f.tipoLabel}</td>
              <td style={{ textAlign: 'right' }}>
                <Importe fila={f} quincena={quincena} onListo={invalidar} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {visibles.length === 0 && (
        <div className={styles.vacio}>
          Ninguna póliza coincide con esos filtros.
        </div>
      )}
    </>
  )
}
