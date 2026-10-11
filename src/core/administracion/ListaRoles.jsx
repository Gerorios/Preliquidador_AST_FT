import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../ui/CargandoContenido'
import Icono from '../ui/iconos'
import { actualizarRol, borrarRol, crearRol, listarRoles } from './adminApi'
import { SIN_ACCESO, permisosIguales } from './roles'
import EditorRol from './EditorRol'
import styles from './Administracion.module.css'

const NUEVO = 'nuevo'
const VACIO = { nombre: '', permisos: {} }

const cuantasPersonas = (n) => (n === 0 ? 'Nadie lo tiene' : n === 1 ? '1 persona' : `${n} personas`)

// Los permisos de un rol, sólo de los módulos y pantallas del catálogo y sin
// las pantallas en "sin acceso". Es lo que muestra el editor y lo único que se
// manda: el catálogo trae sólo módulos activos, y el backend conserva los
// permisos de los inactivos al editar (plan, sección 9).
const delCatalogo = (permisos, catalogo) => {
  const limpio = {}
  for (const m of catalogo) {
    const delModulo = {}
    for (const p of m.pantallas ?? []) {
      const nivel = permisos?.[m.clave]?.[p.clave]
      if (nivel && nivel !== SIN_ACCESO) delModulo[p.clave] = nivel
    }
    if (Object.keys(delModulo).length) limpio[m.clave] = delModulo
  }
  return limpio
}

// Solapa "Roles": la lista de roles a la izquierda y el editor del elegido a
// la derecha. El borrador vive acá para poder avisar de cambios sin guardar
// antes de cambiar de rol o empezar uno nuevo.
//
// `catalogo` es la consulta de `GET /api/auth/modulos` (Administracion.jsx).
export default function ListaRoles({ catalogo }) {
  const qc = useQueryClient()
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: listarRoles })

  // Rol elegido: un id, NUEVO, o null (el primero de la lista).
  const [elegido, setElegido] = useState(null)
  // Lo editado del rol elegido: { clave, nombre, permisos }. Si su clave no es
  // la del rol a la vista, no cuenta: el editor muestra lo guardado.
  const [borrador, setBorrador] = useState(null)
  // A dónde se quiso ir con cambios sin guardar: espera que se confirme.
  const [pendiente, setPendiente] = useState(null)

  const lista = roles.data ?? []
  const modulos = catalogo.data ?? []

  // Si el rol elegido ya no existe (se borró), se vuelve al primero.
  const clave = elegido === NUEVO
    ? NUEVO
    : lista.some(r => r.id === elegido) ? elegido : (lista[0]?.id ?? null)
  const rol = clave === NUEVO ? null : (lista.find(r => r.id === clave) ?? null)

  const guardado = clave === NUEVO
    ? VACIO
    : rol ? { nombre: rol.nombre, permisos: delCatalogo(rol.permisos, modulos) } : null
  const valor = borrador?.clave === clave ? borrador : guardado
  const sucio = !!guardado && (
    valor.nombre.trim() !== guardado.nombre.trim() || !permisosIguales(valor.permisos, guardado.permisos)
  )

  const ir = (destino) => {
    setElegido(destino)
    setBorrador(null)
    setPendiente(null)
  }

  const pedirIr = (destino) => {
    if (destino === clave) return
    if (sucio) setPendiente(destino)
    else ir(destino)
  }

  const recargar = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-roles'] }),
    // Las etiquetas de la solapa Usuarios muestran el nombre de cada rol.
    qc.invalidateQueries({ queryKey: ['admin-usuarios'] }),
  ])

  const mutGuardar = useMutation({
    mutationFn: ({ id, datos }) => (id ? actualizarRol(id, datos) : crearRol(datos)),
    // Se espera la lista nueva antes de soltar el overlay, para que el editor
    // pase a mostrar lo guardado sin un instante con lo viejo.
    onSuccess: async (respuesta, { id, datos }) => {
      await recargar()
      const enLista = qc.getQueryData(['admin-roles']) ?? []
      const destino = id ?? respuesta?.id ?? enLista.find(r => r.nombre === datos.nombre)?.id ?? null
      ir(destino)
      toast.success(id ? 'Rol guardado' : 'Rol creado')
    },
    onError: (e) => toast.error(e.message),
  })

  const mutBorrar = useMutation({
    mutationFn: (id) => borrarRol(id),
    onSuccess: async () => {
      await recargar()
      ir(null)
      toast.success('Rol borrado')
    },
    onError: (e) => toast.error(e.message),
  })

  const guardar = () => mutGuardar.mutate({
    id: rol?.id ?? null,
    datos: { nombre: valor.nombre.trim(), permisos: delCatalogo(valor.permisos, modulos) },
  })

  const nombrePendiente = (valor?.nombre ?? '').trim() || 'el rol nuevo'

  const cargando = roles.isLoading || catalogo.isLoading
  const error = roles.isError
    ? `No se pudieron cargar los roles: ${roles.error.message}`
    : catalogo.isError
      ? `No se pudieron cargar los módulos del sistema: ${catalogo.error.message}`
      : null

  return (
    <section className={`card ${styles.bloque}`}>
      <header className={styles.encabezado}>
        <h2 className={styles.titulo}>
          <Icono nombre="llave" size={16} /> Roles
        </h2>
        <span className={styles.subtitulo}>
          Cada rol da Ver o Editar en algunas pantallas. Una persona puede tener varios, y se suman.
        </span>
      </header>

      {cargando ? (
        <CargandoContenido texto="Cargando roles…" />
      ) : error ? (
        <div className={styles.error} role="alert">{error}</div>
      ) : (
        <div className={styles.rolesLayout}>
          <nav className={styles.listaRoles} aria-label="Roles">
            <button
              type="button"
              className={`btn btn-primary ${styles.botonNuevoRol}`}
              disabled={clave === NUEVO}
              onClick={() => pedirIr(NUEVO)}
            >
              Nuevo rol
            </button>

            {(lista.length > 0 || clave === NUEVO) && (
              <ul className={styles.itemsRoles}>
                {clave === NUEVO && (
                  <li>
                    <div className={`${styles.itemRol} ${styles.itemRolActivo}`} aria-current="true">
                      <span className={styles.nombreRol}>{valor.nombre.trim() || 'Rol nuevo'}</span>
                      <span className={styles.cuentaPersonas}>sin crear</span>
                    </div>
                  </li>
                )}
                {lista.map(r => {
                  const activo = r.id === clave
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`${styles.itemRol} ${activo ? styles.itemRolActivo : ''}`}
                        aria-current={activo ? 'true' : undefined}
                        onClick={() => pedirIr(r.id)}
                      >
                        <span className={styles.nombreRol}>{r.nombre}</span>
                        <span className={styles.cuentaPersonas}>
                          {activo && sucio ? 'sin guardar' : cuantasPersonas(r.personas?.length ?? 0)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </nav>

          <div className={styles.columnaEditor}>
            {pendiente !== null && (
              <div className={styles.confirmacion} role="alert">
                <span>
                  Hay cambios sin guardar en <strong>{nombrePendiente}</strong>. Si seguís, se pierden.
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => ir(pendiente)}>
                  Descartar y seguir
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setPendiente(null)}>
                  Seguir editando
                </button>
              </div>
            )}

            {clave === null ? (
              <div className={styles.vacio}>
                Todavía no hay roles. Tocá <strong>Nuevo rol</strong> para armar el primero.
              </div>
            ) : (
              <EditorRol
                key={clave}
                catalogo={modulos}
                roles={lista}
                rol={rol}
                valor={valor}
                sucio={sucio}
                onCambiar={(nuevo) => { setPendiente(null); setBorrador({ ...nuevo, clave }) }}
                onGuardar={guardar}
                onDescartar={() => ir(clave === NUEVO ? null : clave)}
                onBorrar={() => mutBorrar.mutate(rol.id)}
              />
            )}
          </div>
        </div>
      )}
    </section>
  )
}
