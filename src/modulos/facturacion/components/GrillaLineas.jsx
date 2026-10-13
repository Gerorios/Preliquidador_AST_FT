import SelectorTarea from './SelectorTarea'
import Icono from '../../../core/ui/iconos'
import { leerNumero, importeDeLinea, formatoPesos } from '../numeros'
import { avisoDeLinea, totalFirmado } from '../lineas'
import { UNIDADES, ETIQUETAS } from '../unidades'
import { aTextoArgentino, filaEstaVacia, textoFecha } from '../formulario'
import styles from './GrillaLineas.module.css'

// Las Líneas de un Comprobante como una planilla (plan E2, FA6): una fila por
// Línea, en el orden de los campos del PDF, para cargarlas con Tab sin soltar
// el teclado: fecha, tarea, unidad, finca, cantidad, precio, y el botón de
// quitar; después de la última fila, "Agregar línea". El importe lo calcula la
// pantalla mientras se tipea (el que vale es el del backend) y el total va al
// pie, con signo: en una Nota de crédito resta.
//
// Con `soloLectura` muestra las Líneas guardadas (`lineas` del detalle) como
// texto, con el importe guardado: en un histórico es el de la planilla, que no
// siempre es cantidad por precio.

// "1234.56" a negativo en una Nota de crédito; el backend lo manda positivo.
function conSigno(importe, tipo) {
  if (importe == null) return null
  return tipo === 'nota_credito' ? `-${importe}` : importe
}

function importeDeFila(fila) {
  const cantidad = leerNumero(fila.cantidad)
  const precio = leerNumero(fila.precio_unitario)
  return cantidad != null && precio != null ? importeDeLinea(cantidad, precio) : null
}

const COLUMNAS = (
  <colgroup>
    <col className={styles.colNumero} />
    <col className={styles.colFecha} />
    <col className={styles.colTarea} />
    <col className={styles.colUnidad} />
    <col className={styles.colFinca} />
    <col className={styles.colCantidad} />
    <col className={styles.colPrecio} />
    <col className={styles.colImporte} />
    <col className={styles.colQuitar} />
  </colgroup>
)

const ENCABEZADO = (
  <thead>
    <tr>
      <th scope="col" className={styles.numeroFila}><span className={styles.oculto}>Línea</span>#</th>
      <th scope="col">Fecha</th>
      <th scope="col">Tarea</th>
      <th scope="col">Unidad</th>
      <th scope="col">Finca</th>
      <th scope="col" className={styles.numerica}>Cantidad</th>
      <th scope="col" className={styles.numerica}>Precio unitario</th>
      <th scope="col" className={styles.numerica}>Importe</th>
      <th scope="col"><span className={styles.oculto}>Quitar</span></th>
    </tr>
  </thead>
)

function Pie({ tipo, importes, cantidad }) {
  return (
    <tfoot>
      <tr className={styles.pie}>
        <td colSpan={7} className={styles.pieEtiqueta}>
          Total{tipo === 'nota_credito' ? ' de la Nota de crédito' : ''}
          <span className={styles.pieCuenta}>
            {cantidad} {cantidad === 1 ? 'línea' : 'líneas'}
          </span>
        </td>
        <td className={`${styles.numerica} ${styles.pieTotal}`}>
          {formatoPesos(totalFirmado(tipo, importes))}
        </td>
        <td />
      </tr>
    </tfoot>
  )
}

function Lectura({ lineas, tipo }) {
  const ordenadas = [...lineas].sort((a, b) => a.orden - b.orden)
  return (
    <div className={styles.grilla}>
      <table className={styles.tabla}>
        {COLUMNAS}
        {ENCABEZADO}
        <tbody>
          {ordenadas.map((l, i) => (
            <tr key={l.id} className={styles.fila}>
              <td className={styles.numeroFila}>{i + 1}</td>
              <td className={styles.dato}>{textoFecha(l.fecha)}</td>
              <td className={styles.dato}>{l.tarea_nombre}</td>
              <td className={styles.dato}>{ETIQUETAS[l.unidad] ?? l.unidad}</td>
              <td className={styles.dato}>
                {l.finca_nombre ?? <span className={styles.apagado}>Sin finca</span>}
              </td>
              <td className={`${styles.dato} ${styles.numerica}`}>{aTextoArgentino(l.cantidad)}</td>
              <td className={`${styles.dato} ${styles.numerica}`}>{aTextoArgentino(l.precio_unitario)}</td>
              <td className={`${styles.dato} ${styles.numerica}`}>{formatoPesos(conSigno(l.importe, tipo))}</td>
              <td />
            </tr>
          ))}
        </tbody>
        <Pie tipo={tipo} importes={ordenadas.map(l => l.importe)} cantidad={ordenadas.length} />
      </table>
    </div>
  )
}

// Las opciones de finca: las del Cliente y, si la fila tiene una que ya no
// está (dada de baja en el campo), esa también, con su nombre guardado.
function OpcionesFinca({ fila, fincas, estadoFincas }) {
  if (estadoFincas === 'sin_cliente') return <option value="">Elegí el Cliente primero</option>
  if (estadoFincas === 'cargando') return <option value="">Cargando fincas…</option>
  if (estadoFincas === 'error') return <option value="">No se pudieron leer las fincas</option>
  const falta = fila.finca_id != null && !fincas.some(f => f.id === fila.finca_id)
  return (
    <>
      <option value="">Sin finca</option>
      {falta && <option value={fila.finca_id}>{fila.finca_nombre} (ya no figura en el campo)</option>}
      {fincas.map(f => <option key={f.id} value={f.id}>{f.nombre}</option>)}
    </>
  )
}

/**
 * - `filas`: el estado de la pantalla (formulario.js); `tipo`, el del Comprobante.
 * - `tareas` (lista) y `tareasPorId` (Map), de GET /tareas.
 * - `fincas` y `estadoFincas` ('sin_cliente' | 'cargando' | 'error' | 'ok').
 * - `errores`: { clave: { campo: mensaje } }, propios o de la API.
 * - `onCambiar(clave, cambios)`, `onElegirTarea(clave, tarea)`, `onAgregar()`,
 *   `onQuitar(clave)`.
 */
export default function GrillaLineas({
  soloLectura, lineas, filas, tipo, tareas, tareasPorId, fincas, estadoFincas,
  errores, onCambiar, onElegirTarea, onAgregar, onQuitar,
}) {
  if (soloLectura) return <Lectura lineas={lineas} tipo={tipo} />

  const importes = filas.map(importeDeFila)

  return (
    <div className={styles.grilla}>
      <table className={styles.tabla}>
        {COLUMNAS}
        {ENCABEZADO}
        <tbody>
          {filas.length === 0 && (
            <tr className={styles.fila}>
              <td colSpan={9} className={styles.vacia}>
                Sin líneas. Tocá <strong>Agregar línea</strong> para cargar la primera.
              </td>
            </tr>
          )}
          {filas.map((fila, i) => {
            const n = i + 1
            const id = campo => `linea-${fila.clave}-${campo}`
            const errs = errores[fila.clave] ?? {}
            const aviso = avisoDeLinea(tareasPorId.get(fila.tarea_id))
            const mensajes = Object.values(errs)
            const hayMensajes = mensajes.length > 0 || aviso
            const idMensajes = id('mensajes')
            // Cada campo con error apunta a los mensajes de su fila.
            const propsCampo = campo => ({
              id: id(campo),
              'aria-invalid': errs[campo] ? true : undefined,
              'aria-describedby': hayMensajes ? idMensajes : undefined,
            })
            const importe = conSigno(importes[i], tipo)
            return [
              <tr key={fila.clave} className={`${styles.fila} ${hayMensajes ? styles.filaConMensajes : ''}`}>
                <td className={styles.numeroFila}>{n}</td>
                <td>
                  <input
                    {...propsCampo('fecha')}
                    type="date"
                    className={`input ${styles.campo}`}
                    aria-label={`Fecha de la línea ${n}`}
                    value={fila.fecha}
                    onChange={e => onCambiar(fila.clave, { fecha: e.target.value })}
                  />
                </td>
                <td>
                  <SelectorTarea
                    id={id('tarea_id')}
                    etiqueta={`Tarea de la línea ${n}`}
                    tareas={tareas}
                    valor={fila}
                    invalido={!!errs.tarea_id}
                    describedBy={hayMensajes ? idMensajes : undefined}
                    onElegir={tarea => onElegirTarea(fila.clave, tarea)}
                  />
                </td>
                <td>
                  <select
                    {...propsCampo('unidad')}
                    className={`input ${styles.campo}`}
                    aria-label={`Unidad de la línea ${n}`}
                    value={fila.unidad}
                    onChange={e => onCambiar(fila.clave, { unidad: e.target.value, unidadTocada: true })}
                  >
                    <option value="">Elegí…</option>
                    {UNIDADES.map(u => <option key={u} value={u}>{ETIQUETAS[u]}</option>)}
                  </select>
                </td>
                <td>
                  <select
                    {...propsCampo('finca_id')}
                    className={`input ${styles.campo}`}
                    aria-label={`Finca de la línea ${n} (opcional)`}
                    value={fila.finca_id ?? ''}
                    disabled={estadoFincas !== 'ok'}
                    onChange={e => {
                      const valor = e.target.value
                      const finca = (fincas ?? []).find(f => String(f.id) === valor)
                      // Volver a elegir la finca guardada que ya no figura no cambia nada.
                      if (finca) onCambiar(fila.clave, { finca_id: finca.id, finca_nombre: finca.nombre })
                      else if (!valor) onCambiar(fila.clave, { finca_id: null, finca_nombre: null })
                    }}
                  >
                    <OpcionesFinca fila={fila} fincas={fincas ?? []} estadoFincas={estadoFincas} />
                  </select>
                </td>
                <td>
                  <input
                    {...propsCampo('cantidad')}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={`input ${styles.campo} ${styles.campoNumero}`}
                    aria-label={`Cantidad de la línea ${n}`}
                    value={fila.cantidad}
                    onChange={e => onCambiar(fila.clave, { cantidad: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    {...propsCampo('precio_unitario')}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className={`input ${styles.campo} ${styles.campoNumero}`}
                    aria-label={`Precio unitario de la línea ${n}`}
                    value={fila.precio_unitario}
                    onChange={e => onCambiar(fila.clave, { precio_unitario: e.target.value })}
                  />
                </td>
                <td className={`${styles.numerica} ${styles.importe} ${errs.importe ? styles.importeInvalido : ''}`}>
                  {importe == null ? <span className={styles.apagado}>—</span> : formatoPesos(importe)}
                </td>
                <td className={styles.celdaQuitar}>
                  <button
                    id={id('quitar')}
                    type="button"
                    className={styles.quitar}
                    aria-label={`Quitar la línea ${n}`}
                    title="Quitar la línea"
                    onClick={() => onQuitar(fila.clave)}
                  >
                    <Icono nombre="cerrar" size={15} />
                  </button>
                </td>
              </tr>,
              hayMensajes && (
                <tr key={`${fila.clave}-mensajes`} className={styles.filaMensajes}>
                  <td />
                  <td colSpan={8}>
                    <ul id={idMensajes} className={styles.mensajes}>
                      {Object.entries(errs).map(([campo, m]) => (
                        <li key={campo} className={styles.mensajeError}>
                          <Icono nombre="alerta" size={13} enTexto className={styles.iconoError} />
                          {m}
                        </li>
                      ))}
                      {aviso && (
                        <li className={styles.mensajeAviso}>
                          <span className="badge badge-warn">No facturable</span>
                          {aviso} Se registra igual.
                        </li>
                      )}
                    </ul>
                  </td>
                </tr>
              ),
            ]
          })}
        </tbody>
        <Pie tipo={tipo} importes={importes} cantidad={filas.filter(f => !filaEstaVacia(f)).length} />
      </table>
      <div className={styles.agregar}>
        <button id="grilla-agregar" type="button" className="btn" onClick={onAgregar}>
          Agregar línea
        </button>
      </div>
    </div>
  )
}
