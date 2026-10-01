import { useEffect, useId } from 'react'
import { UNIDADES, TIPOS } from '../pages/conceptosConstantes'
import styles from './DialogoOpcionExtra.module.css'

// ─── DialogoOpcionExtra: los dos 409 de "agregar por código" (ADR-0015) ─────
//
// `detalle` es el detail del 409:
// - tipo 'elegir_opcion': el código tiene varias opciones (precio, unidad,
//   tipo) en la quincena. Se muestra una por botón, sin tareas, y el tipo sólo
//   si `mostrar_tipo`. La opción vuelve tal como vino (el precio es un texto
//   con 4 decimales y no se reformatea al mandarlo).
// - tipo 'codigo_repetido': la línea (o algunas de las marcadas) ya tiene el
//   código. En una línea se agrega igual o se cancela; en masivo, el default
//   es saltear las que ya lo tienen.
// Escape cancela, como DialogoSolapamiento.

const fmtPrecio = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 4,
})

const labelDe = (lista, valor) => lista.find(x => x.value === valor)?.label ?? valor

export default function DialogoOpcionExtra({ detalle, modo, onElegir, onConfirmarRepetido, onCancelar }) {
  const idTitulo = useId()

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancelar() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar])

  let titulo, cuerpo, botones
  if (detalle?.tipo === 'elegir_opcion') {
    titulo = `Código ${detalle.codigo}: elegí una opción`
    cuerpo = (
      <>
        <div className={styles.dialogoTexto}>{detalle.mensaje}</div>
        <div className={styles.opciones}>
          {detalle.opciones.map(o => (
            <button
              key={`${o.precio}|${o.unidad_base}|${o.tipo}`}
              className={`btn ${styles.opcion}`}
              onClick={() => onElegir({ precio: o.precio, unidad_base: o.unidad_base, tipo: o.tipo })}
            >
              <span className={`mono ${styles.opcionPrecio}`}>{fmtPrecio.format(Number(o.precio))}</span>
              <span className={styles.opcionDetalle}>{labelDe(UNIDADES, o.unidad_base)}</span>
              {o.mostrar_tipo && <span className={styles.opcionDetalle}>{labelDe(TIPOS, o.tipo)}</span>}
            </button>
          ))}
        </div>
      </>
    )
    botones = <button className="btn" autoFocus onClick={onCancelar}>Cancelar</button>
  } else if (detalle?.tipo === 'codigo_repetido') {
    titulo = `El código ${detalle.codigo} ya está cargado`
    cuerpo = <div className={styles.dialogoTexto}>{detalle.mensaje}</div>
    if (modo === 'masivo') {
      const n = detalle.lineas_con_codigo
      botones = (
        <>
          <button className="btn btn-primary" autoFocus onClick={() => onConfirmarRepetido('saltear')}>
            {n === 1 ? 'Saltear la 1 que ya lo tiene' : `Saltear las ${n} que ya lo tienen`}
          </button>
          <button className="btn" onClick={() => onConfirmarRepetido('agregar')}>Agregar igual a todas</button>
          <button className="btn" onClick={onCancelar}>Cancelar</button>
        </>
      )
    } else {
      botones = (
        <>
          <button className="btn" autoFocus onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => onConfirmarRepetido('agregar')}>Agregar igual</button>
        </>
      )
    }
  } else {
    return null
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby={idTitulo}>
      <div className={styles.dialogo}>
        <div id={idTitulo} className={styles.dialogoTitulo}>{titulo}</div>
        {cuerpo}
        <div className={styles.dialogoBotones}>{botones}</div>
      </div>
    </div>
  )
}
