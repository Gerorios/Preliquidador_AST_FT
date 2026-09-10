import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../ui/CargandoContenido'
import Icono from '../ui/iconos'
import {
  ROLES_GLOBALES, actualizarModulos, actualizarUsuario, listarUsuarios, resetearPassword,
} from './adminApi'
import styles from './Administracion.module.css'

// Con lo que la persona entra al sistema: el CUIL si vino del padrón, el mail
// para los usuarios anteriores al PR 5, que se crearon a mano.
const identificador = (u) => u.cuil ?? u.email

// Bloque "Usuarios": la lista completa, con el rol global, los accesos por
// módulo y las acciones de una fila. No hay borrado a propósito — hay
// auditoría apuntando a `usuarios`, así que a quien se va se lo desactiva.
export default function ListaUsuarios({ modulos }) {
  const qc = useQueryClient()
  const [filtro, setFiltro] = useState('')
  // Resultado del último reseteo, para mostrar la contraseña una sola vez.
  const [passwordNueva, setPasswordNueva] = useState(null)
  // Id del usuario sin CUIL al que se le está tipeando una contraseña a mano.
  const [resetManual, setResetManual] = useState(null)
  const [passwordManual, setPasswordManual] = useState('')
  // Qué filas tienen un pedido en el aire, como claves 'accion:id'. Hace falta
  // llevarlo aparte porque las tres mutaciones son una sola instancia para toda
  // la tabla, y `mutacion.variables` solo recuerda la última invocación: sin
  // esto, tocar la fila B rehabilitaría la fila A con su pedido todavía sin
  // responder. Se guardan repetidos y se saca de a uno, para que dos pedidos
  // encimados sobre la misma fila la liberen recién con el último.
  const [enVuelo, setEnVuelo] = useState([])

  const { data: usuarios = [], isLoading, isError, error } = useQuery({
    queryKey: ['admin-usuarios'],
    queryFn: listarUsuarios,
  })

  const clavesActivas = useMemo(() => modulos.map(m => m.clave), [modulos])

  // Un usuario puede tener asignado un módulo que hoy está inactivo (y por eso
  // no viene en `modulos`). Se muestra, sin selector, para que el acceso no
  // quede invisible.
  const hayAccesosInactivos = useMemo(
    () => usuarios.some(u => Object.keys(u.modulos ?? {}).some(c => !clavesActivas.includes(c))),
    [usuarios, clavesActivas]
  )

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    if (!q) return usuarios
    return usuarios.filter(u =>
      (u.nombre ?? '').toLowerCase().includes(q) ||
      String(identificador(u) ?? '').toLowerCase().includes(q)
    )
  }, [usuarios, filtro])

  const refrescar = () => qc.invalidateQueries({ queryKey: ['admin-usuarios'] })

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
    onSuccess: () => {
      toast.success('Usuario actualizado')
      refrescar()
    },
    onError: (e) => toast.error(e.message),
  })

  const mutModulos = useMutation({
    mutationFn: ({ id, mapa }) => actualizarModulos(id, mapa),
    onMutate: ({ id }) => tomar('modulos', id),
    onSettled: (_data, _error, { id }) => soltar('modulos', id),
    onSuccess: (_data, { advertirSinAcceso }) => {
      toast.success('Accesos actualizados')
      // Quitar accesos es legítimo, pero que un usuario no-admin quede sin
      // ningún módulo no puede pasar en silencio: sin módulos no puede
      // entrar (Login lo rechaza por falta de módulos asignados).
      if (advertirSinAcceso) {
        toast('Este usuario se quedó sin acceso a ningún módulo: no va a poder entrar hasta que le asignes uno.')
      }
      refrescar()
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

  // `actualizarModulos` reemplaza el mapa completo, así que se parte del mapa
  // que el usuario ya tiene: cambiar un módulo no puede borrarle los otros
  // (incluidos los de módulos hoy inactivos, que no tienen selector).
  const cambiarModulo = (usuario, clave, rol) => {
    const mapa = { ...(usuario.modulos ?? {}) }
    if (rol) mapa[clave] = rol
    else delete mapa[clave]
    const advertirSinAcceso = usuario.rol !== 'admin' && Object.keys(mapa).length === 0
    mutModulos.mutate({ id: usuario.id, mapa, advertirSinAcceso })
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

  // Columnas fijas (nombre, identificador, rol, estado, acciones) + una por
  // módulo activo + la de accesos inactivos si hace falta.
  const columnas = 5 + modulos.length + (hayAccesosInactivos ? 1 : 0)

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
        <div className={styles.error}>No se pudo cargar la lista de usuarios: {error.message}</div>
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
                <th>ROL EN EL SISTEMA</th>
                {modulos.map(m => <th key={m.clave}>{m.nombre.toUpperCase()}</th>)}
                {hayAccesosInactivos && <th>OTROS ACCESOS</th>}
                <th>ESTADO</th>
                <th>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(u => {
                const asignados = u.modulos ?? {}
                const inactivos = Object.entries(asignados)
                  .filter(([clave]) => !clavesActivas.includes(clave))
                return [
                  <tr key={u.id} className={u.activo ? '' : styles.filaInactiva}>
                    <td>{u.nombre}</td>
                    <td className="mono">{identificador(u)}</td>
                    <td>
                      <select
                        className={`input ${styles.selectRol}`}
                        value={u.rol}
                        disabled={ocupada('usuario', u.id)}
                        onChange={e => mutUsuario.mutate({ id: u.id, cambio: { rol: e.target.value } })}
                      >
                        {ROLES_GLOBALES.map(r => (
                          <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
                        ))}
                      </select>
                    </td>

                    {modulos.map(m => (
                      <td key={m.clave}>
                        <select
                          className={`input ${styles.selectRol}`}
                          value={asignados[m.clave] ?? ''}
                          disabled={ocupada('modulos', u.id)}
                          onChange={e => cambiarModulo(u, m.clave, e.target.value)}
                        >
                          <option value="">— Sin acceso —</option>
                          {Object.entries(m.etiquetas_rol ?? {}).map(([rol, etiqueta]) => (
                            <option key={rol} value={rol}>{etiqueta}</option>
                          ))}
                        </select>
                      </td>
                    ))}

                    {hayAccesosInactivos && (
                      <td>
                        {inactivos.length === 0 ? (
                          <span className={styles.guion}>—</span>
                        ) : (
                          inactivos.map(([clave, rol]) => (
                            <span
                              key={clave}
                              className="badge badge-muted"
                              title="El módulo está inactivo: el acceso se conserva, pero no se edita desde acá"
                            >
                              {clave}: {rol}
                            </span>
                          ))
                        )}
                      </td>
                    )}

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
