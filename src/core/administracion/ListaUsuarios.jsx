import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../ui/CargandoContenido'
import Icono from '../ui/iconos'
import {
  ROLES_GLOBALES, actualizarRolesDeUsuario, actualizarUsuario, listarRoles, listarUsuarios,
  resetearPassword,
} from './adminApi'
import { quedaSinAcceso } from './roles'
import styles from './Administracion.module.css'

// Con lo que la persona entra al sistema: el CUIL si vino del padrón, el mail
// para los usuarios anteriores al PR 5, que se crearon a mano.
const identificador = (u) => u.cuil ?? u.email

const AVISO_SIN_ACCESO = 'no va a poder entrar hasta que le asignes un rol.'

// Bloque "Usuarios": la lista completa, con el tipo de usuario (la marca
// global de admin), sus roles y las acciones de una fila. No hay borrado a
// propósito — hay auditoría apuntando a `usuarios`, así que a quien se va se
// lo desactiva.
//
// Los roles se cambian en una fila de detalle con casillas, como el reset de
// contraseña a mano: se guardan recién al tocar Guardar, todos juntos.
export default function ListaUsuarios() {
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState('')
  // Resultado del último reseteo, para mostrar la contraseña una sola vez.
  const [passwordNueva, setPasswordNueva] = useState(null)
  // Id del usuario sin CUIL al que se le está tipeando una contraseña a mano.
  const [resetManual, setResetManual] = useState(null)
  const [passwordManual, setPasswordManual] = useState('')
  // Fila de detalle de roles abierta: { id, roles: [ids marcados] }. Una sola
  // a la vez; abrir otra descarta lo marcado en la anterior.
  const [cambioRoles, setCambioRoles] = useState(null)
  // Qué filas tienen un pedido en el aire, como claves 'accion:id'. Hace falta
  // llevarlo aparte porque cada mutación es una sola instancia para toda
  // la tabla, y `mutacion.variables` solo recuerda la última invocación: sin
  // esto, tocar la fila B rehabilitaría la fila A con su pedido todavía sin
  // responder. Se guardan repetidos y se saca de a uno, para que dos pedidos
  // encimados sobre la misma fila la liberen recién con el último.
  const [enVuelo, setEnVuelo] = useState([])

  const { data: usuarios = [], isLoading, isError, error } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: listarUsuarios,
  })

  // Los roles que existen, para las casillas de la fila de detalle. Es la
  // misma consulta que la solapa Roles y el alta.
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: listarRoles })

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(u =>
      (u.nombre ?? '').toLowerCase().includes(q) ||
      String(identificador(u) ?? '').toLowerCase().includes(q)
    )
  }, [usuarios, filtro])

  // La solapa Roles muestra quién tiene cada rol (y si está inactiva): todo
  // cambio de una persona la afecta también.
  const refrescar = () => Promise.all([
    qc.invalidateQueries({ queryKey: ['admin-usuarios'] }),
    qc.invalidateQueries({ queryKey: ['admin-roles'] }),
  ])

  const tomar = (accion, id) => setEnVuelo(prev => [...prev, `${accion}:${id}`])
  const soltar = (accion, id) => setEnVuelo(prev => {
    const i = prev.indexOf(`${accion}:${id}`)
    return i === -1 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)]
  })

  // Deshabilita los controles de UNA fila mientras su propio pedido está en vuelo.
  const ocupada = (accion, id) => enVuelo.includes(`${accion}:${id}`)

  const mutUsuario = useMutation({
    mutationFn: ({ id, cambio }) => actualizarUsuario(id, cambio),
    onMutate: ({ id }) => tomar('usuario', id),
    onSettled: (_data, _error, { id }) => soltar('usuario', id),
    onSuccess: (_data, { advertirSinAcceso }) => {
      toast.success('Usuario actualizado')
      // Dejar de ser administrador sin tener roles es quedarse afuera.
      if (advertirSinAcceso) toast(`Ya no es administrador y no tiene roles: ${AVISO_SIN_ACCESO}`)
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  const mutRoles = useMutation({
    mutationFn: ({ id, roles: ids }) => actualizarRolesDeUsuario(id, ids),
    onMutate: ({ id }) => tomar('roles', id),
    onSettled: (_data, _error, { id }) => soltar('roles', id),
    onSuccess: async (_data, { id, advertirSinAcceso }) => {
      // Se espera la lista nueva antes de cerrar la fila: el overlay sigue
      // hasta que las etiquetas muestran lo guardado.
      await refrescar()
      setCambioRoles(actual => (actual?.id === id ? null : actual))
      toast.success('Roles actualizados')
      // Sacarle todos los roles es legítimo, pero no puede pasar en silencio:
      // sin roles no entra (el Login no la deja pasar sin tarjetas).
      if (advertirSinAcceso) toast(`Esta persona se quedó sin roles: ${AVISO_SIN_ACCESO}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const mutPassword = useMutation({
    mutationFn: ({ id, password }) => resetearPassword(id, password),
    onMutate: ({ id }) => tomar('password', id),
    onSettled: (_data, _error, { id }) => soltar('password', id),
    onSuccess: (data, variables) => {
      setPasswordNueva({ id: variables.id, nombre: variables.nombre, password: data.password })
      // El cuadro de contraseña a mano se cierra solo si es el de este usuario:
      // si hay otro abierto con algo tipeado, no se le pisa lo escrito.
      if (resetManual === variables.id) {
        setResetManual(null)
        setPasswordManual('')
      }
      toast.success('Contraseña reseteada')
    },
    onError: (e) => toast.error(e.message),
  })

  const cambiarRolGlobal = (usuario, rol) => {
    const advertirSinAcceso = quedaSinAcceso({ rol }, usuario.roles)
    // Un administrador no tiene botón "Cambiar": si tenía la fila abierta, se cierra.
    if (rol === 'admin') setCambioRoles(actual => (actual?.id === usuario.id ? null : actual))
    mutUsuario.mutate({ id: usuario.id, cambio: { rol }, advertirSinAcceso })
  }

  const abrirCambioRoles = (usuario) =>
    setCambioRoles({ id: usuario.id, roles: (usuario.roles ?? []).map(r => r.id) })

  const alternarRol = (rolId) => setCambioRoles(actual => ({
    ...actual,
    roles: actual.roles.includes(rolId)
      ? actual.roles.filter(id => id !== rolId)
      : [...actual.roles, rolId],
  }))

  // `actualizarRolesDeUsuario` reemplaza la lista entera: se mandan los
  // marcados que siguen existiendo, en el orden de la lista de roles.
  const guardarRoles = (usuario) => {
    const ids = (roles.data ?? []).map(r => r.id).filter(id => cambioRoles.roles.includes(id))
    mutRoles.mutate({ id: usuario.id, roles: ids, advertirSinAcceso: quedaSinAcceso(usuario, ids) })
  }

  const pedirReset = (usuario) => {
    // Sin CUIL no hay contraseña de dónde derivarla: el backend la exige.
    if (!usuario.cuil) {
      setPasswordNueva(null)
      setPasswordManual('')
      setResetManual(usuario.id)
      return
    }
    mutPassword.mutate({ id: usuario.id, nombre: usuario.nombre, password: null })
  }

  const confirmarResetManual = (usuario) => {
    const password = passwordManual.trim()
    if (!password) {
      toast.error('Escribí la contraseña nueva')
      return
    }
    mutPassword.mutate({ id: usuario.id, nombre: usuario.nombre, password })
  }

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto)
      toast.success('Copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar: anotala a mano')
    }
  }

  // Nombre, identificador, tipo de usuario, roles, estado y acciones.
  const columnas = 6

  return (
    <section className={`card ${styles.bloque}`}>
      <header className={styles.encabezado}>
        <h2 className={styles.titulo}>
          <Icono nombre="usuarios" size={16} /> Usuarios
        </h2>
        <input
          className={`input ${styles.buscador}`}
          placeholder="Filtrar por nombre, CUIL o mail…"
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <span className={styles.contador}>
          {visibles.length === usuarios.length
            ? `${usuarios.length} usuario(s)`
            : `${visibles.length} de ${usuarios.length} usuario(s)`}
        </span>
      </header>

      {isLoading ? (
        <CargandoContenido texto="Cargando usuarios…" />
      ) : isError ? (
        <div className={styles.error} role="alert">No se pudo cargar la lista de usuarios: {error.message}</div>
      ) : visibles.length === 0 ? (
        <div className={styles.vacio}>
          {usuarios.length === 0 ? 'Todavía no hay usuarios.' : 'Ningún usuario coincide con el filtro.'}
        </div>
      ) : (
        <div className={`table-wrap ${styles.tablaWrap}`}>
          <table className={styles.tabla}>
            <thead>
              <tr>
                <th>NOMBRE</th>
                <th>IDENTIFICADOR</th>
                <th>TIPO DE USUARIO</th>
                <th>ROLES</th>
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(u => {
                const esAdmin = u.rol === 'admin'
                const susRoles = u.roles ?? []
                const editandoRoles = cambioRoles?.id === u.id
                return [
                  <tr key={u.id} className={u.activo ? '' : styles.filaInactiva}>
                    <td>{u.nombre}</td>
                    <td className="mono">{identificador(u)}</td>
                    <td>
                      <select
                        className={`input ${styles.selectRol}`}
                        aria-label={`Tipo de usuario de ${u.nombre}`}
                        value={u.rol}
                        disabled={ocupada('usuario', u.id)}
                        onChange={e => cambiarRolGlobal(u, e.target.value)}
                      >
                        {ROLES_GLOBALES.map(r => (
                          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <div className={styles.celdaRoles}>
                        {esAdmin ? (
                          <span className={styles.veTodo}>Ve todo</span>
                        ) : susRoles.length === 0 ? (
                          <span className="badge badge-warn">Sin roles: no puede entrar</span>
                        ) : (
                          susRoles.map(r => (
                            <span key={r.id} className="badge badge-info">{r.nombre}</span>
                          ))
                        )}
                        {/* Un administrador ve todo: sus roles no cuentan
                            mientras tenga esa marca. */}
                        {!esAdmin && (
                          <button
                            type="button"
                            className={`btn btn-sm ${styles.botonCambiar}`}
                            aria-expanded={editandoRoles}
                            aria-label={`Cambiar los roles de ${u.nombre}`}
                            disabled={ocupada('roles', u.id)}
                            onClick={() => (editandoRoles ? setCambioRoles(null) : abrirCambioRoles(u))}
                          >
                            Cambiar
                          </button>
                        )}
                      </div>
                    </td>

                    <td>
                      <span className={`badge ${u.activo ? 'badge-green' : 'badge-muted'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>

                    <td>
                      <div className={styles.acciones}>
                        <button
                          type="button"
                          className={`btn btn-sm ${u.activo ? 'btn-danger' : 'btn-primary'}`}
                          disabled={ocupada('usuario', u.id)}
                          onClick={() => mutUsuario.mutate({ id: u.id, cambio: { activo: !u.activo } })}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={ocupada('password', u.id)}
                          onClick={() => pedirReset(u)}
                        >
                          Resetear contraseña
                        </button>
                      </div>
                    </td>
                  </tr>,

                  editandoRoles && (
                    <tr key={`${u.id}-roles`} className={styles.filaDetalle}>
                      <td colSpan={columnas}>
                        <FilaCambioRoles
                          usuario={u}
                          roles={roles}
                          marcados={cambioRoles.roles}
                          ocupada={ocupada('roles', u.id)}
                          onAlternar={alternarRol}
                          onGuardar={() => guardarRoles(u)}
                          onCancelar={() => setCambioRoles(null)}
                        />
                      </td>
                    </tr>
                  ),

                  resetManual === u.id && (
                    <tr key={`${u.id}-manual`} className={styles.filaDetalle}>
                      <td colSpan={columnas}>
                        <div className={styles.cajaPassword}>
                          <span>
                            <strong>{u.nombre}</strong> entra con mail, no con CUIL: escribí la
                            contraseña nueva que le vas a pasar.
                          </span>
                          <input
                            className={`input input-mono ${styles.inputPassword}`}
                            placeholder="Contraseña nueva"
                            value={passwordManual}
                            onChange={e => setPasswordManual(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            disabled={ocupada('password', u.id)}
                            onClick={() => confirmarResetManual(u)}
                          >
                            Resetear
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => { setResetManual(null); setPasswordManual('') }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ),

                  passwordNueva?.id === u.id && (
                    <tr key={`${u.id}-password`} className={styles.filaDetalle}>
                      <td colSpan={columnas}>
                        <div className={styles.cajaPassword}>
                          <span>
                            Contraseña nueva de <strong>{passwordNueva.nombre}</strong>:
                          </span>
                          <code className={styles.passwordValor}>{passwordNueva.password}</code>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => copiar(passwordNueva.password)}
                          >
                            <Icono nombre="copiar" size={13} /> Copiar
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => setPasswordNueva(null)}
                          >
                            Listo
                          </button>
                          <span className={styles.aviso}>
                            Se muestra una sola vez: pasásela antes de cerrar este aviso.
                          </span>
                        </div>
                      </td>
                    </tr>
                  ),
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// Fila de detalle de "Cambiar": una casilla por rol que existe, y Guardar o
// Cancelar. Nada se guarda hasta tocar Guardar.
function FilaCambioRoles({ usuario, roles, marcados, ocupada, onAlternar, onGuardar, onCancelar }) {
  const lista = roles.data ?? []
  const actuales = (usuario.roles ?? []).map(r => r.id)
  const sinCambios = actuales.length === marcados.length && actuales.every(id => marcados.includes(id))
  const sinAcceso = quedaSinAcceso(usuario, marcados)

  if (roles.isLoading) {
    return (
      <div className={styles.cajaRoles}>
        <span className={styles.cargandoRoles}><span className="spinner" /> Cargando roles…</span>
      </div>
    )
  }
  if (roles.isError) {
    return (
      <div className={styles.cajaRoles}>
        <div className={styles.error} role="alert">
          No se pudieron cargar los roles: {roles.error.message}
        </div>
        <div className={styles.pieRoles}>
          <button type="button" className="btn btn-sm" onClick={onCancelar}>Cerrar</button>
        </div>
      </div>
    )
  }

  return (
    <fieldset className={styles.cajaRoles} disabled={ocupada}>
      <legend className={styles.leyendaRoles}>
        Roles de <strong>{usuario.nombre}</strong>
      </legend>

      {lista.length === 0 ? (
        <span className={styles.nota}>Todavía no hay roles: armalos en la solapa Roles.</span>
      ) : (
        <div className={styles.casillasRoles}>
          {lista.map(r => (
            <label key={r.id} className={styles.opcionRol}>
              <input
                type="checkbox"
                className={styles.casilla}
                checked={marcados.includes(r.id)}
                onChange={() => onAlternar(r.id)}
              />
              {r.nombre}
            </label>
          ))}
        </div>
      )}

      <div className={styles.pieRoles}>
        <button
          type="button"
          className="btn btn-sm btn-primary"
          disabled={sinCambios}
          onClick={onGuardar}
        >
          Guardar
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancelar}>
          Cancelar
        </button>
        {sinAcceso && (
          <span className={styles.avisoSinAcceso}>
            Sin ningún rol, {usuario.nombre} {AVISO_SIN_ACCESO}
          </span>
        )}
      </div>
    </fieldset>
  )
}
