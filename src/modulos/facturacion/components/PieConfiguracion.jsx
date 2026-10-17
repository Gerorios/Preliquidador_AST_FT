import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { CLAVE_RESUMEN, guardarConfiguracion } from '../services/resumen'
import { textoMes } from '../listado'
import {
  textoUmbral, umbralParaEditar, leerConfiguracion, textoUltimoCambio,
} from '../vistaResumen'
import styles from './PieConfiguracion.module.css'

// Pie del Resumen (plan E3, decisión 4 y FA5; boceto F0): desde qué mes se
// controla, el Umbral de diferencia y que la cosecha no entra. Sólo el Admin
// ve "Cambiar", que abre ahí mismo un formulario chico para el Umbral y el Mes
// de corte (PUT /api/facturacion/configuracion, ruta 17). Mientras guarda, el
// overlay del núcleo cubre la pantalla (es una mutación); al guardar, un toast
// "Guardado" y el Resumen se vuelve a pedir, porque cambian los Estados.
//
// "Último cambio" sale de lo que traiga la configuración: lo que devuelve el
// PUT al guardar, o `ultimoCambio` si la pantalla lo recibe del Resumen.

export default function PieConfiguracion({ umbral, mesCorte, mesEnCurso, esAdmin, ultimoCambio }) {
  const qc = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [umbralTexto, setUmbralTexto] = useState('')
  const [mes, setMes] = useState('')
  const [errores, setErrores] = useState({})
  // La configuración que devolvió el último guardado, con quién y cuándo.
  const [guardada, setGuardada] = useState(null)

  const botonCambiar = useRef(null)
  const campoUmbral = useRef(null)
  // Al cerrar el formulario, el foco vuelve a "Cambiar" (no al principio de
  // la página); al abrirlo, va al Umbral.
  const volverFoco = useRef(false)
  useEffect(() => {
    if (abierto) campoUmbral.current?.focus()
    else if (volverFoco.current) {
      botonCambiar.current?.focus()
      volverFoco.current = false
    }
  }, [abierto])

  const guardar = useMutation({
    mutationFn: guardarConfiguracion,
    onSuccess: configuracion => {
      setGuardada(configuracion)
      volverFoco.current = true
      setAbierto(false)
      toast.success('Guardado')
      qc.invalidateQueries({ queryKey: CLAVE_RESUMEN })
    },
    onError: error => {
      // Un 422 del backend va debajo de su campo; lo demás, en un toast.
      const campo = error.detail?.tipo === 'configuracion_invalida' ? error.detail.campo : null
      if (campo === 'umbral_pct' || campo === 'mes_corte') setErrores({ [campo]: error.message })
      else toast.error(`No se pudo guardar. ${error.message}`)
    },
  })

  const abrir = () => {
    setUmbralTexto(umbralParaEditar(umbral))
    setMes(mesCorte ?? '')
    setErrores({})
    setAbierto(true)
  }

  const cancelar = () => {
    volverFoco.current = true
    setAbierto(false)
  }

  const enviar = e => {
    e.preventDefault()
    const { datos, errores: encontrados } = leerConfiguracion(umbralTexto, mes)
    setErrores(encontrados)
    if (datos) guardar.mutate(datos)
  }

  const umbralVisible = textoUmbral(umbral)
  const ultimo = textoUltimoCambio(guardada ?? ultimoCambio)

  return (
    <div className={styles.pie}>
      <div className={styles.fila}>
        <p className={styles.texto}>
          Se controla desde <strong>{textoMes(mesCorte) ?? '—'}</strong> (Mes de corte). Con
          diferencia: en alguna tarea, lo facturado se aparta más
          de <strong>{umbralVisible ?? '—'}</strong> de lo trabajado; el porcentaje lo fija el
          administrador. Un período que todavía no terminó se controla igual, pero el campo
          puede sumar partes. La cosecha (bins) no entra en esta versión.
        </p>
        {esAdmin && !abierto && (
          <button ref={botonCambiar} type="button" className="btn btn-sm" onClick={abrir}>
            Cambiar
          </button>
        )}
      </div>

      {esAdmin && abierto && (
        <form
          className={styles.form}
          role="group"
          aria-label="Cambiar Umbral y Mes de corte"
          onSubmit={enviar}
          onKeyDown={e => { if (e.key === 'Escape' && !guardar.isPending) cancelar() }}
          noValidate
        >
          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="fact-umbral">Umbral de diferencia</label>
            <span className={styles.pct}>
              <input
                ref={campoUmbral}
                id="fact-umbral"
                className={`input input-mono ${styles.umbral} ${errores.umbral_pct ? styles.conError : ''}`}
                inputMode="decimal"
                autoComplete="off"
                value={umbralTexto}
                onChange={e => setUmbralTexto(e.target.value)}
                aria-invalid={Boolean(errores.umbral_pct)}
                aria-describedby={errores.umbral_pct ? 'fact-umbral-error' : undefined}
              />
              <span aria-hidden="true">%</span>
            </span>
            {errores.umbral_pct && <span id="fact-umbral-error" className={styles.error}>{errores.umbral_pct}</span>}
          </div>

          <div className={styles.campo}>
            <label className={styles.etiqueta} htmlFor="fact-mes-corte">Mes de corte</label>
            <input
              id="fact-mes-corte"
              className={`input input-mono ${errores.mes_corte ? styles.conError : ''}`}
              type="month"
              max={mesEnCurso ?? undefined}
              value={mes}
              onChange={e => setMes(e.target.value)}
              aria-invalid={Boolean(errores.mes_corte)}
              aria-describedby={errores.mes_corte ? 'fact-mes-corte-error' : undefined}
            />
            {errores.mes_corte && <span id="fact-mes-corte-error" className={styles.error}>{errores.mes_corte}</span>}
          </div>

          <div className={styles.acciones}>
            <button type="button" className="btn btn-sm" onClick={cancelar} disabled={guardar.isPending}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={guardar.isPending}>
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </button>
          </div>

          {ultimo && <span className={styles.quien}>{ultimo}</span>}
        </form>
      )}
    </div>
  )
}
