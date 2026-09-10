import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../ui/CargandoContenido'
import Icono from '../ui/iconos'
import { buscarPadron, crearUsuarios } from './adminApi'
import styles from './Administracion.module.css'

const MINIMO = 3
const AYUDA_BUSQUEDA = 'Escribí al menos 3 letras del apellido o 3 dígitos del CUIL'

const ROLES_GLOBALES = [
  { valor: 'usuario', etiqueta: 'Usuario' },
  { valor: 'admin', etiqueta: 'Administrador' },
]

const plural = (n, singular, plural_) => `${n} ${n === 1 ? singular : plural_}`

// Las personas del padrón sin CUIL no son una persona única (el backend las
// agrupa por empresa + legajo), así que la fila necesita su propia clave.
const claveFila = (p) =>
  p.cuil ?? `legajo:${p.empleos?.[0]?.empresa ?? '?'}:${p.empleos?.[0]?.legajo ?? '?'}`

const motivoDeshabilitada = (p) => {
  if (!p.cuil) return 'sin CUIL en el padrón'
  if (p.ya_tiene_usuario) return 'ya tiene usuario'
  return null
}

// Bloque "Dar de alta": se busca en el padrón de empleados (solo lectura), se
// marcan personas y se crean todas con los mismos roles. Nada se tipea a mano:
// la identidad de la persona es su CUIL, y el CUIL es su contraseña inicial.
export default function AltaDesdePadron({ modulos }) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  // Se guarda cuil + nombre para poder mostrar lo marcado incluso después de
  // cambiar la búsqueda: el lote puede salir de varias búsquedas.
  const [seleccion, setSeleccion] = useState([])
  const [rolGlobal, setRolGlobal] = useState('usuario')
  const [rolesModulo, setRolesModulo] = useState({})
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 300)
    return () => clearTimeout(t)
  }, [texto])

  const consulta = texto.trim()
  const cortoParaBuscar = consulta.length < MINIMO
  // Entre la tecla y el disparo del debounce todavía no se buscó lo que se ve
  // escrito: sin esto, esos 300 ms muestran "ninguna persona coincide".
  const esperandoBusqueda = consulta !== q

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['admin-padron', q],
    queryFn: () => buscarPadron(q),
    enabled: q.length >= MINIMO,
  })

  const personas = data?.personas ?? []
  const total = data?.total ?? 0

  const marcados = useMemo(() => seleccion.map(p => p.cuil), [seleccion])

  const alternar = (persona) => {
    setSeleccion(prev => prev.some(p => p.cuil === persona.cuil)
      ? prev.filter(p => p.cuil !== persona.cuil)
      : [...prev, { cuil: persona.cuil, apellido_nombre: persona.apellido_nombre }])
  }

  const rolesDelLote = () =>
    Object.fromEntries(Object.entries(rolesModulo).filter(([, rol]) => rol))

  const mutCrear = useMutation({
    mutationFn: () => crearUsuarios(marcados, rolGlobal, rolesDelLote()),
    onSuccess: (respuesta) => {
      setResultado(respuesta)
      setSeleccion([])
      qc.invalidateQueries({ queryKey: ['admin-usuarios'] })
      // El padrón marca quién ya tiene usuario: hay que volver a pedirlo.
      qc.invalidateQueries({ queryKey: ['admin-padron'] })
      const creados = respuesta.creados?.length ?? 0
      if (creados > 0) toast.success(`Se creó el usuario de ${plural(creados, 'persona', 'personas')}`)
      else toast.error('No se creó ningún usuario: mirá el detalle')
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <section className={`card ${styles.bloque}`}>
      <header className={styles.encabezado}>
        <h2 className={styles.titulo}>
          <Icono nombre="administracion" size={16} /> Dar de alta
        </h2>
        <span className={styles.subtitulo}>
          Las personas salen del padrón de empleados: buscalas y marcalas.
        </span>
      </header>

      <input
        className={`input ${styles.buscadorPadron}`}
        placeholder="Apellido, nombre o CUIL…"
        value={texto}
        onChange={e => setTexto(e.target.value)}
      />

      {cortoParaBuscar ? (
        <div className={styles.vacio}>{AYUDA_BUSQUEDA}</div>
      ) : isError && !esperandoBusqueda ? (
        <div className={styles.error}>No se pudo buscar en el padrón: {error.message}</div>
      ) : (isFetching || esperandoBusqueda) && personas.length === 0 ? (
        <CargandoContenido texto="Buscando en el padrón…" />
      ) : personas.length === 0 ? (
        <div className={styles.vacio}>Ninguna persona del padrón coincide con la búsqueda.</div>
      ) : (
        <>
          <div className={`table-wrap ${styles.tablaWrap}`}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th className={styles.columnaCasilla} />
                  <th>APELLIDO Y NOMBRE</th>
                  <th>CUIL</th>
                  <th>EMPLEOS</th>
                  <th>ESTADO</th>
                </tr>
              </thead>
              <tbody>
                {personas.map(p => {
                  const motivo = motivoDeshabilitada(p)
                  const marcada = !motivo && marcados.includes(p.cuil)
                  return (
                    <tr
                      key={claveFila(p)}
                      className={[
                        motivo ? styles.filaDeshabilitada : styles.filaMarcable,
                        marcada ? styles.filaMarcada : '',
                      ].join(' ')}
                      onClick={() => !motivo && alternar(p)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className={styles.casilla}
                          aria-label={`Marcar a ${p.apellido_nombre}`}
                          title={motivo ?? 'Marcar para el alta'}
                          checked={marcada}
                          disabled={!!motivo}
                          onChange={() => alternar(p)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td>{p.apellido_nombre}</td>
                      <td className="mono">{p.cuil ?? '—'}</td>
                      <td className={styles.empleos}>
                        {(p.empleos ?? []).map((e, i) => (
                          <span key={`${e.empresa}-${e.legajo}-${i}`} className="badge badge-muted">
                            {e.empresa} · {e.legajo}
                          </span>
                        ))}
                      </td>
                      <td>
                        {motivo
                          ? <span className="badge badge-warn">{motivo}</span>
                          : <span className={styles.guion}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > personas.length && (
            <div className={styles.nota}>
              Se muestran las primeras {personas.length} de {total} coincidencias. Afiná la
              búsqueda para ver el resto.
            </div>
          )}
        </>
      )}

      <hr className="divider" />

      <div className={styles.roles}>
        <div className={styles.campo}>
          <div className="field-label">Rol en el sistema</div>
          <select
            className={`input ${styles.selectRol}`}
            value={rolGlobal}
            onChange={e => setRolGlobal(e.target.value)}
          >
            {ROLES_GLOBALES.map(r => (
              <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
            ))}
          </select>
        </div>

        {modulos.map(m => (
          <div key={m.clave} className={styles.campo}>
            <div className="field-label">{m.nombre}</div>
            <select
              className={`input ${styles.selectRol}`}
              value={rolesModulo[m.clave] ?? ''}
              onChange={e => setRolesModulo(prev => ({ ...prev, [m.clave]: e.target.value }))}
            >
              <option value="">— Sin acceso —</option>
              {Object.entries(m.etiquetas_rol ?? {}).map(([rol, etiqueta]) => (
                <option key={rol} value={rol}>{etiqueta}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className={styles.piePadron}>
        <div className={styles.marcadas}>
          {seleccion.length === 0 ? (
            <span className={styles.nota}>Marcá al menos una persona para darla de alta.</span>
          ) : (
            <>
              <span className={styles.nota}>{plural(seleccion.length, 'marcada', 'marcadas')}:</span>
              {seleccion.map(p => (
                <button
                  key={p.cuil}
                  type="button"
                  className={styles.chipMarcada}
                  title="Quitar del lote"
                  onClick={() => setSeleccion(prev => prev.filter(x => x.cuil !== p.cuil))}
                >
                  {p.apellido_nombre} <Icono nombre="cerrar" size={11} />
                </button>
              ))}
            </>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={seleccion.length === 0 || mutCrear.isPending}
          onClick={() => mutCrear.mutate()}
        >
          {mutCrear.isPending
            ? <><span className="spinner" /> Creando…</>
            : `Crear ${plural(seleccion.length, 'usuario', 'usuarios')}`}
        </button>
      </div>

      {resultado && (
        <div className={styles.resultado}>
          <div className={styles.encabezado}>
            <h3 className={styles.titulo}>Resultado del alta</h3>
            <button type="button" className="btn btn-sm" onClick={() => setResultado(null)}>
              Cerrar
            </button>
          </div>

          {resultado.creados?.length > 0 && (
            <>
              <div className={styles.leyenda}>
                {plural(resultado.creados.length, 'usuario creado', 'usuarios creados')} —
                <strong> usuario y contraseña: el CUIL</strong>. Es lo único que hay que decirle a
                la persona.
              </div>
              <div className={`table-wrap ${styles.tablaWrap}`}>
                <table className={styles.tabla}>
                  <thead>
                    <tr><th>NOMBRE</th><th>IDENTIFICADOR (CUIL)</th></tr>
                  </thead>
                  <tbody>
                    {resultado.creados.map(c => (
                      <tr key={c.id}>
                        <td>{c.nombre}</td>
                        <td className="mono">{c.cuil}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {resultado.omitidos?.length > 0 && (
            <>
              <div className={styles.leyenda}>
                {plural(resultado.omitidos.length, 'persona omitida', 'personas omitidas')}:
              </div>
              <div className={`table-wrap ${styles.tablaWrap}`}>
                <table className={styles.tabla}>
                  <thead>
                    <tr><th>CUIL</th><th>MOTIVO</th></tr>
                  </thead>
                  <tbody>
                    {resultado.omitidos.map((o, i) => (
                      <tr key={`${o.cuil}-${i}`}>
                        <td className="mono">{o.cuil ?? '—'}</td>
                        <td>{o.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
