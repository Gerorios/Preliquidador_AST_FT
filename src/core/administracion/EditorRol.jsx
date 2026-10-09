import { useState } from 'react'
import {
  SIN_ACCESO, motivoParaNoBorrar, motivoParaNoGuardar, nivelesDe, textoConfirmacion,
} from './roles'
import styles from './Administracion.module.css'

const ETIQUETA_NIVEL = { [SIN_ACCESO]: 'Sin acceso', ver: 'Ver', editar: 'Editar' }

// Editor de un rol: el nombre, una fila por pantalla de cada módulo activo con
// Sin acceso / Ver / Editar, y quiénes lo tienen. No guarda nada por su cuenta:
// el borrador vive en `ListaRoles`, que sabe si hay cambios sin guardar.
//
// Se monta de nuevo (key) al cambiar de rol: las confirmaciones y el motivo
// que no deja guardar arrancan cerrados en cada rol.
//
// - `rol`: el rol guardado (con `personas`), o null si es uno nuevo.
// - `valor`: { nombre, permisos } que se está editando.
export default function EditorRol({
  catalogo, roles, rol, valor, sucio, onCambiar, onGuardar, onDescartar, onBorrar,
}) {
  // Se intentó guardar con algo que el backend rechazaría: desde ahí el motivo
  // se muestra y se actualiza mientras se corrige.
  const [intento, setIntento] = useState(false)
  const [confirmando, setConfirmando] = useState(null) // null | 'guardar' | 'borrar'

  const esNuevo = !rol
  const personas = rol?.personas ?? []
  const motivo = motivoParaNoGuardar({ id: rol?.id, ...valor }, catalogo, roles)
  const motivoBorrar = rol ? motivoParaNoBorrar(rol) : null

  const cambiar = (cambio) => {
    setConfirmando(null)
    onCambiar({ ...valor, ...cambio })
  }

  const ponerNivel = (modulo, pantalla, nivel) => {
    const delModulo = { ...(valor.permisos[modulo] ?? {}) }
    if (nivel === SIN_ACCESO) delete delModulo[pantalla]
    else delModulo[pantalla] = nivel
    cambiar({ permisos: { ...valor.permisos, [modulo]: delModulo } })
  }

  const pedirGuardar = () => {
    if (motivo) {
      setIntento(true)
      return
    }
    if (personas.length) {
      setConfirmando('guardar')
      return
    }
    onGuardar()
  }

  const confirmar = () => {
    const accion = confirmando
    setConfirmando(null)
    if (accion === 'guardar') onGuardar()
    else if (accion === 'borrar') onBorrar()
  }

  const nombreVisible = valor.nombre.trim() || 'Rol nuevo'

  return (
    <section className={styles.editor} aria-label={`Editar ${nombreVisible}`}>
      <div className={styles.campoNombre}>
        <label className="field-label" htmlFor="rol-nombre">Nombre del rol</label>
        <input
          id="rol-nombre"
          className="input"
          placeholder="Por ejemplo: Preliquidador"
          value={valor.nombre}
          onChange={e => cambiar({ nombre: e.target.value })}
        />
      </div>

      {catalogo.length === 0 ? (
        <div className={styles.vacio}>No hay módulos activos: no hay pantallas para dar.</div>
      ) : (
        catalogo.map(m => (
          <fieldset key={m.clave} className={styles.moduloPermisos}>
            <legend className={styles.moduloTitulo}>{m.nombre}</legend>
            {(m.pantallas ?? []).map(p => {
              const nivel = valor.permisos[m.clave]?.[p.clave] ?? SIN_ACCESO
              const idNombre = `pantalla-${m.clave}-${p.clave}`
              const requeridas = (p.requiere ?? [])
                .map(clave => m.pantallas.find(x => x.clave === clave)?.nombre ?? clave)
              return (
                <div key={p.clave} className={styles.filaPantalla}>
                  <div className={styles.nombrePantalla}>
                    <span id={idNombre}>{p.nombre}</span>
                    {requeridas.length > 0 && (
                      <span className={styles.ayudaPantalla}>
                        Necesita al menos Ver en {requeridas.join(' y ')}.
                      </span>
                    )}
                    {p.editable === false && (
                      <span className={styles.ayudaPantalla}>Esta pantalla sólo se puede ver.</span>
                    )}
                  </div>
                  <div className={styles.segmentado} role="group" aria-labelledby={idNombre}>
                    {nivelesDe(p).map(n => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={nivel === n}
                        className={nivel === n
                          ? (n === SIN_ACCESO ? styles.segmentoSinAcceso : styles.segmentoActivo)
                          : undefined}
                        onClick={() => ponerNivel(m.clave, p.clave, n)}
                      >
                        {ETIQUETA_NIVEL[n]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </fieldset>
        ))
      )}

      <div className={styles.personas}>
        <h3 className={styles.personasTitulo}>
          Quiénes lo tienen{personas.length > 0 ? ` (${personas.length})` : ''}
        </h3>
        {esNuevo ? (
          <span className={styles.nota}>
            Después de crearlo, se asigna a cada persona en la solapa Usuarios.
          </span>
        ) : personas.length === 0 ? (
          <span className={styles.nota}>
            Nadie lo tiene todavía. Se asigna a cada persona en la solapa Usuarios.
          </span>
        ) : (
          <ul className={styles.listaPersonas}>
            {personas.map(p => (
              <li key={p.id} className={p.activo === false ? styles.personaInactiva : styles.persona}>
                {p.nombre}{p.activo === false ? ' (inactiva)' : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      {intento && motivo && (
        <div className={styles.error} role="alert">No se puede guardar: {motivo}</div>
      )}

      {confirmando === 'guardar' && (
        <div className={styles.confirmacion} role="alert">
          <span>{textoConfirmacion(personas)}</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={confirmar}>
            Sí, guardar
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setConfirmando(null)}>
            Cancelar
          </button>
        </div>
      )}

      {confirmando === 'borrar' && (
        <div className={styles.confirmacion} role="alert">
          <span>¿Borrar el rol <strong>{rol.nombre}</strong>? No se puede deshacer.</span>
          <button type="button" className="btn btn-sm btn-danger" onClick={confirmar}>
            Sí, borrar
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setConfirmando(null)}>
            Cancelar
          </button>
        </div>
      )}

      <div className={styles.pieEditor}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!sucio || confirmando !== null}
          onClick={pedirGuardar}
        >
          {esNuevo ? 'Crear rol' : 'Guardar'}
        </button>
        {(sucio || esNuevo) && (
          <button
            type="button"
            className="btn"
            disabled={confirmando !== null}
            onClick={onDescartar}
          >
            {esNuevo ? 'Cancelar' : 'Descartar cambios'}
          </button>
        )}

        {!esNuevo && (
          <div className={styles.zonaBorrar}>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!!motivoBorrar || confirmando !== null}
              aria-describedby={motivoBorrar ? 'motivo-no-borrar' : undefined}
              onClick={() => setConfirmando('borrar')}
            >
              Borrar rol
            </button>
            {motivoBorrar && (
              <span id="motivo-no-borrar" className={styles.motivoBorrar}>{motivoBorrar}</span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
