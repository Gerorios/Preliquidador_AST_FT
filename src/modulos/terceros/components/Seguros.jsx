import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import {
  listarBienes, listarTarifas, crearTarifa, actualizarTarifa, eliminarTarifa,
} from '../services/terceros'
import { comoPesos } from '../formato'
import styles from '../pages/Tarifario.module.css'

// Los seguros no se cargan como las otras tarifas. En las demás el liquidador
// sabe de memoria a quién le pone precio; acá son 382 bienes y personas, y el
// nombre tiene que coincidir **exacto** con el del sistema de campo o el seguro
// no se le imputa a nadie. Por eso se elige de una lista en vez de tipear.
//
// Se filtra por dueño porque así llegan las pólizas: de a un tercero por vez.

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

function Importe({ fila, quincena }) {
  const qc = useQueryClient()
  const [valor, setValor] = useState(null)
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['terceros', 'tarifario'] })
    qc.invalidateQueries({ queryKey: ['terceros', 'lineas'] })
  }

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
    onSuccess: () => { setValor(null); invalidar() },
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
        onKeyDown={e => {
          if (e.key === 'Enter') guardar.mutate(valor)
          if (e.key === 'Escape') setValor(null)
        }}
      />
    )
  }
  return (
    <span className={fila.tarifa ? styles.precio : styles.sinPrecio}
          onClick={() => setValor(fila.tarifa ? String(fila.tarifa.importe) : '')}
          title="Clic para cargar el importe">
      {fila.tarifa ? comoPesos(fila.tarifa.importe) : 'sin cargar'}
    </span>
  )
}

export default function Seguros({ quincena }) {
  const [dueno, setDueno] = useState('')

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

  const duenos = useMemo(
    () => [...new Set(padron.map(b => b.tercero).filter(Boolean))].sort(),
    [padron]
  )

  // Cada entrada del padrón se expande en una fila por cada tipo de póliza que
  // le corresponde, y se le pega la tarifa que ya exista.
  const filas = useMemo(() => {
    const porClave = new Map(
      tarifas.map(t => [`${t.tercero}|${t.tipo_seguro}|${t.sujeto}`, t])
    )
    return padron
      .filter(b => b.tercero && (!dueno || b.tercero === dueno))
      .flatMap(b => (TIPOS_POR_ORIGEN[b.origen] ?? []).map(t => ({
        clave: `${b.origen}-${b.id_origen}-${t.clave}`,
        origen: b.origen,
        tercero: b.tercero,
        tipo: t.clave,
        tipoLabel: t.label,
        sujeto: b.nombre,
        referencia: b.patente ?? null,
        detalle: b.detalle,
        tarifa: porClave.get(`${b.tercero}|${t.clave}|${b.nombre}`) ?? null,
      })))
  }, [padron, tarifas, dueno])

  const cargadas = filas.filter(f => f.tarifa).length

  return (
    <>
      <div className={styles.topbar} style={{ marginBottom: 10 }}>
        <select className="input" style={{ width: 260 }} value={dueno}
                onChange={e => setDueno(e.target.value)}>
          <option value="">Todos los dueños ({duenos.length})</option>
          {duenos.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span className={styles.copiarTexto}>
          {cargadas} de {filas.length} con importe cargado
        </span>
      </div>

      {(cargandoPadron || isLoading) && <CargandoContenido texto="Buscando el padrón…" />}

      {!cargandoPadron && !isLoading && (
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
            {filas.map(f => (
              <tr key={f.clave}>
                <td>{f.tercero}</td>
                <td className={styles.cualquiera}>{ETIQUETA_ORIGEN[f.origen]}</td>
                <td>{f.sujeto}</td>
                <td>{f.referencia ?? <span className={styles.cualquiera}>—</span>}</td>
                <td>{f.tipoLabel}</td>
                <td style={{ textAlign: 'right' }}>
                  <Importe fila={f} quincena={quincena} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!cargandoPadron && filas.length === 0 && (
        <div className={styles.vacio}>
          No hay bienes ni choferes para ese dueño en el sistema de campo.
        </div>
      )}
    </>
  )
}
