import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  obtenerPreciosFaltantes,
  listarGruposPago,
  crearPrecioComun,
  recalcularPrecios,
  listarPreciosComunes,
} from '../../services/preliquidacion'
import styles from './PanelPrecios.module.css'

export default function PanelPrecios({ preliqId, quincena, onCerrar, onPreciosCargados }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState(0)
  const [editandoIdx, setEditandoIdx] = useState(null)
  const [precioInput, setPrecioInput] = useState('')
  const [grupoPagoInput, setGrupoPagoInput] = useState('')
  const [nuevoComun, setNuevoComun] = useState({ tarea_nombre: '', grupo_pago: '', precio: '' })

  const { data: faltantes = [], isLoading, refetch } = useQuery({
    queryKey: ['precios-faltantes', preliqId],
    queryFn: () => obtenerPreciosFaltantes(preliqId),
  })

  const { data: comunes = [] } = useQuery({
    queryKey: ['precios-comunes', quincena],
    queryFn: () => listarPreciosComunes(quincena),
  })

  const { data: gruposPago = [] } = useQuery({
    queryKey: ['grupos-pago'],
    queryFn: listarGruposPago,
    staleTime: Infinity,
  })

  const invalidar = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['precios-comunes', quincena] }),
      qc.invalidateQueries({ queryKey: ['precios-faltantes', preliqId] }),
      qc.invalidateQueries({ queryKey: ['lineas', String(preliqId)] }),
      qc.invalidateQueries({ queryKey: ['stats', String(preliqId)] }),
    ])
    refetch()
    onPreciosCargados?.()
  }

  const { mutate: guardarYAplicar, isPending: guardando } = useMutation({
    mutationFn: async (datos) => {
      await crearPrecioComun(datos)
      await recalcularPrecios(preliqId)
    },
    onSuccess: () => {
      toast.success('Precio guardado y aplicado')
      setEditandoIdx(null)
      setPrecioInput('')
      setGrupoPagoInput('')
      setNuevoComun({ tarea_nombre: '', grupo_pago: '', precio: '' })
      invalidar()
    },
    onError: (err) => toast.error(err.message),
  })

  const handleGuardarFaltante = (f) => {
    if (!precioInput) { toast.error('Ingresá un precio'); return }
    const grupo = grupoPagoInput || f.grupo_pago || ''
    if (!grupo) { toast.error('Seleccioná un grupo de pago'); return }
    guardarYAplicar({
      tarea_nombre: f.tarea_nombre,
      grupo_pago: grupo,
      quincena,
      precio: parseFloat(precioInput),
    })
  }

  const handleGuardarComun = () => {
    if (!nuevoComun.tarea_nombre || !nuevoComun.grupo_pago || !nuevoComun.precio) {
      toast.error('Completá todos los campos')
      return
    }
    guardarYAplicar({ ...nuevoComun, quincena, precio: parseFloat(nuevoComun.precio) })
  }

  // Tareas únicas de los faltantes para el selector del tab común
  const tareasUnicas = [...new Set(faltantes.map(f => f.tarea_nombre))].sort()

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>PRECIOS FALTANTES</div>
          <div className={styles.sub}>{quincena}</div>
        </div>
        <button className={styles.closeBtn} onClick={onCerrar}>✕</button>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${tab === 0 ? styles.tabActive : ''}`}
          onClick={() => setTab(0)}
        >
          Faltantes
          {faltantes.length > 0 && (
            <span className={styles.tabBadge}>{faltantes.length}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${tab === 1 ? styles.tabActive : ''}`}
          onClick={() => setTab(1)}
        >
          Precio común
        </button>
      </div>

      <div className={styles.body}>

        {/* ── Tab Faltantes ── */}
        {tab === 0 && (
          <>
            {isLoading && (
              <div className={styles.centro}>
                <span className="spinner" /> Cargando...
              </div>
            )}

            {!isLoading && faltantes.length === 0 && (
              <div className={styles.ok}>
                ✓ Todos los precios están cargados
              </div>
            )}

            {!isLoading && faltantes.map((f, i) => (
              <div
                key={i}
                className={`${styles.card} ${editandoIdx === i ? styles.cardActivo : ''}`}
              >
                {/* Cabecera de la card */}
                <div
                  className={styles.cardHead}
                  onClick={() => {
                    if (editandoIdx === i) {
                      setEditandoIdx(null)
                    } else {
                      setEditandoIdx(i)
                      setPrecioInput(f.precio_sugerido ? String(f.precio_sugerido) : '')
                      setGrupoPagoInput(f.grupo_pago || '')
                    }
                  }}
                >
                  <div className={styles.cardTarea}>{f.tarea_nombre}</div>
                  <div className={styles.cardMeta}>
                    {f.cliente_nombre} · {f.finca_nombre}
                  </div>
                  {f.grupo_pago && (
                    <span className="badge badge-muted" style={{ fontSize: 9 }}>
                      {f.grupo_pago}
                    </span>
                  )}
                  {f.precio_sugerido && (
                    <div className={styles.sugerido}>
                      Último precio: ${Number(f.precio_sugerido).toLocaleString('es-AR')}
                      <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                        ({f.quincena_sugerida})
                      </span>
                    </div>
                  )}
                  <div className={styles.cardToggle}>
                    {editandoIdx === i ? '▲' : '▼'}
                  </div>
                </div>

                {/* Formulario de precio */}
                {editandoIdx === i && (
                  <div className={styles.cardForm}>
                    {/* Si no tiene grupo_pago, pedir que lo seleccione */}
                    {!f.grupo_pago && (
                      <div>
                        <div className="field-label">Grupo de pago</div>
                        <select
                          className="input"
                          value={grupoPagoInput}
                          onChange={e => setGrupoPagoInput(e.target.value)}
                        >
                          <option value="">— Seleccionar —</option>
                          {gruposPago.map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <div className="field-label">Precio</div>
                      <input
                        className="input input-mono"
                        type="number"
                        placeholder="$0"
                        value={precioInput}
                        onChange={e => setPrecioInput(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className={styles.cardFormBtns}>
                      <button
                        className="btn btn-sm"
                        onClick={() => { setEditandoIdx(null); setPrecioInput('') }}
                      >
                        Cancelar
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleGuardarFaltante(f)}
                        disabled={guardando}
                      >
                        {guardando ? <span className="spinner" /> : 'Guardar y aplicar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* ── Tab Precio común ── */}
        {tab === 1 && (
          <>
            <p className={styles.comunInfo}>
              Aplica a <strong>todas las combinaciones</strong> de esa tarea
              y grupo de pago, sin importar cliente o finca.
            </p>

            <div className={styles.comunForm}>
              <div>
                <div className="field-label">Tarea</div>
                <select
                  className="input"
                  value={nuevoComun.tarea_nombre}
                  onChange={e => setNuevoComun(f => ({ ...f, tarea_nombre: e.target.value }))}
                >
                  <option value="">— Seleccionar —</option>
                  {tareasUnicas.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label">Grupo de pago</div>
                <select
                  className="input"
                  value={nuevoComun.grupo_pago}
                  onChange={e => setNuevoComun(f => ({ ...f, grupo_pago: e.target.value }))}
                >
                  <option value="">— Seleccionar —</option>
                  {gruposPago.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="field-label">Precio</div>
                <input
                  className="input input-mono"
                  type="number"
                  placeholder="$0"
                  value={nuevoComun.precio}
                  onChange={e => setNuevoComun(f => ({ ...f, precio: e.target.value }))}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleGuardarComun}
                disabled={guardando}
              >
                {guardando ? <span className="spinner" /> : 'Guardar y aplicar'}
              </button>
            </div>

            {/* Precios comunes ya cargados */}
            {comunes.length > 0 && (
              <>
                <div className={styles.comunListTitle}>YA CARGADOS ESTA QUINCENA</div>
                {comunes.map(c => (
                  <div key={c.id} className={styles.comunRow}>
                    <div>
                      <div className={styles.comunTarea}>{c.tarea_nombre}</div>
                      <span className="badge badge-muted" style={{ fontSize: 9 }}>
                        {c.grupo_pago}
                      </span>
                    </div>
                    <div className={styles.comunPrecio}>
                      ${Number(c.precio).toLocaleString('es-AR')}
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}