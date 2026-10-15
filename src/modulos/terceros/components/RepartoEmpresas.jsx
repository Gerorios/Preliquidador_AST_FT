import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { repartirEmpresas } from '../services/terceros'
import { comoPesos } from '../formato'
import { EMPRESAS } from '../recibos'
import styles from './AjustesRecibo.module.css'

// A qué empresas le factura el tercero y cuánto a cada una, antes de emitir.
//
// Casi siempre es una sola, y no se escribe importe: es el Total a facturar. A
// algunos se les pide que facturen una parte a una empresa y otra parte a otra
// (lo pidió el usuario, 2026-10-05): ahí se escribe el importe de cada una, y
// no se emite hasta que sumen el Total a facturar.
//
// Se guarda apenas está completo, no recién al emitir: queda aunque se cierre
// el diálogo, y el borrador ya lo muestra.

const VACIA = { empresa: '', importe: '' }

const desde = (facturas) => (facturas.length
  ? facturas.map(f => ({
    empresa: f.empresa,
    importe: facturas.length > 1 ? String(f.importe ?? '') : '',
  }))
  : [VACIA])

// Lo que se manda: con una sola empresa, sin importe.
const paraGuardar = (partes) => (partes.length > 1
  ? partes.map(p => ({ empresa: p.empresa, importe: p.importe }))
  : partes.filter(p => p.empresa).map(p => ({ empresa: p.empresa })))

const completas = (partes) => partes.every(p => p.empresa)
  && (partes.length === 1 || partes.every(p => Number(p.importe) > 0))

// `frenoEmitir`: otra razón por la que todavía no se puede emitir, dicha en el
// botón. `onEmitir` recibe el reparto: se guarda y se emite en un solo paso,
// para que nunca salga con uno a medio guardar.
export default function RepartoEmpresas({
  quincena, tercero, facturas, total, puedeEmitir, frenoEmitir, ocupado, onEmitir,
}) {
  const qc = useQueryClient()
  const [partes, setPartes] = useState(() => desde(facturas))

  const repartida = partes.length > 1
  const suma = partes.reduce((n, p) => n + (Number(p.importe) || 0), 0)
  const diferencia = Math.round((Number(total) - suma) * 100) / 100

  const guardar = useMutation({
    mutationFn: (lista) => repartirEmpresas(quincena, tercero, lista),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['terceros', 'recibos'] }),
    onError: err => toast.error(err.message),
  })

  // Una empresa sin importe todavía se está escribiendo: no se guarda a medias.
  const guardarSi = (nuevas) => {
    if (nuevas.length > 1 && !completas(nuevas)) return
    guardar.mutate(paraGuardar(nuevas))
  }

  const cambiar = (i, campo, valor) =>
    partes.map((p, j) => (j === i ? { ...p, [campo]: valor } : p))

  const quitar = (i) => {
    const nuevas = partes.filter((_, j) => j !== i)
    setPartes(nuevas)
    guardarSi(nuevas)
  }

  const libres = (i) => EMPRESAS.filter(
    e => e === partes[i].empresa || !partes.some(p => p.empresa === e))

  const noSeEmite = !partes[0].empresa ? 'Falta elegir a qué empresa factura'
    : !completas(partes) ? 'Falta el importe de cada empresa'
    : repartida && diferencia !== 0
      ? `Lo repartido suma ${comoPesos(suma)} y el Total a facturar es ${comoPesos(total)}`
    : frenoEmitir

  return (
    <div className={styles.seccion}>
      <div className={styles.titulo}>Factura a</div>

      {partes.map((p, i) => (
        <div key={i} className={styles.form}>
          <label className={styles.campo}>
            <span className={styles.campoLabel}>Empresa *</span>
            <select className="input" value={p.empresa} disabled={guardar.isPending}
                    onChange={e => {
                      const nuevas = cambiar(i, 'empresa', e.target.value)
                      setPartes(nuevas)
                      guardarSi(nuevas)
                    }}>
              <option value="">elegir…</option>
              {libres(i).map(x => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
          {repartida && (
            <>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Importe *</span>
                <input className="input" type="number" step="0.01"
                       style={{ width: 140, textAlign: 'right' }} value={p.importe}
                       onChange={e => setPartes(cambiar(i, 'importe', e.target.value))}
                       onBlur={() => guardarSi(partes)} />
              </label>
              <button className="btn btn-sm" onClick={() => quitar(i)}>Quitar</button>
            </>
          )}
        </div>
      ))}

      <div className={styles.form}>
        {partes.length < EMPRESAS.length && (
          <button className="btn btn-sm" onClick={() => setPartes([...partes, VACIA])}>
            Otra empresa
          </button>
        )}
        {repartida && (
          <span className={diferencia ? styles.resta : styles.suma}>
            {comoPesos(suma)} de {comoPesos(total)}
            {diferencia > 0 && ` · faltan ${comoPesos(diferencia)}`}
            {diferencia < 0 && ` · sobran ${comoPesos(-diferencia)}`}
          </span>
        )}
        {puedeEmitir && (
          <button className="btn btn-primary btn-sm"
                  disabled={Boolean(noSeEmite) || ocupado || guardar.isPending}
                  title={noSeEmite || undefined}
                  onClick={() => onEmitir(paraGuardar(partes))}>
            Emitir
          </button>
        )}
      </div>
    </div>
  )
}
