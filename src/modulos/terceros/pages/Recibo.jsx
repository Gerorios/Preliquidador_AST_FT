import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { resumen } from '../columnasGrilla'
import { detalleRecibo } from '../services/terceros'
import { comoFecha, comoNumero, comoPesos } from '../formato'
import { nombreQuincena } from '../recibos'
import styles from './Recibo.module.css'

// El recibo como hoja, para imprimir o guardar como PDF desde el navegador.
// Uno o varios: `?quincena=...&tercero=A&tercero=B`, una hoja por tercero.
//
// Es un solo cálculo impreso de dos formas (plan, 3.5):
//   - **Del tercero**: cierra en el Total a facturar —lo que él copia en su
//     factura—, sigue el detalle de los seguros, y abajo el Total a pagar.
//   - **De la empresa**: el seguro va adentro y hay un solo total.
// Los dos tienen que terminar en el mismo número; si no, el recibo está mal.
//
// Uno sin emitir se imprime igual, pero marcado como borrador: sirve para
// revisarlo, no para mandarlo.

const BLOQUES = [
  ['quincena', 'De esta quincena'],
  ['cuotas', 'Cuotas de repuestos'],
  ['ajustes', 'Ajustes de otras quincenas'],
]

const signado = (signo, v) => `${signo < 0 ? '−' : ''}${comoPesos(v)}`

function Grupo({ grupo }) {
  return (
    <div className={styles.grupo}>
      <div className={styles.grupoTitulo}>
        <span>{grupo.label}</span>
        <span>{signado(grupo.signo, grupo.subtotal)}</span>
      </div>
      <table className={styles.lineas}>
        <tbody>
          {grupo.lineas.map((l, i) => (
            <tr key={i}>
              <td className={styles.fecha}>{comoFecha(l.fecha)}</td>
              <td>
                {resumen(l) || l.concepto_label}
                {l.cuota && <span className={styles.nota}> · cuota {l.cuota}</span>}
                {l.viene_de && (
                  <span className={styles.nota}>
                    {' '}· de la {nombreQuincena(l.viene_de)}{l.motivo ? `: ${l.motivo}` : ''}
                  </span>
                )}
              </td>
              <td className={styles.num}>{l.cantidad != null ? comoNumero(l.cantidad) : ''}</td>
              <td className={styles.num}>{l.precio != null && !l.cuota ? comoPesos(l.precio) : ''}</td>
              <td className={styles.num}>{comoPesos(l.importe)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Total({ label, valor, fuerte }) {
  return (
    <div className={`${styles.total} ${fuerte ? styles.totalFuerte : ''}`}>
      <span>{label}</span>
      <span>{comoPesos(valor)}</span>
    </div>
  )
}

function Hoja({ r, layout }) {
  const c = r.contenido ?? {}
  const seguros = c.seguros ?? []
  const deEmpresa = layout === 'empresa'
  return (
    <div className={styles.hoja}>
      {!r.emitido && <div className={styles.borrador}>Borrador · sin emitir</div>}

      <div className={styles.cabecera}>
        <div>
          <div className={styles.titulo}>Liquidación de servicios</div>
          <div className={styles.tercero}>{r.tercero}</div>
        </div>
        <div className={styles.cabeceraDatos}>
          <div>{nombreQuincena(r.quincena)}</div>
          {r.empresa && <div>Factura a <b>{r.empresa}</b></div>}
          {r.emitido_en && <div>Emitido el {comoFecha(r.emitido_en.slice(0, 10))}</div>}
          {deEmpresa && <div className={styles.nota}>Copia de la empresa</div>}
        </div>
      </div>

      {BLOQUES.map(([clave, titulo]) => (c[clave] ?? []).length > 0 && (
        <section key={clave} className={styles.bloque}>
          <div className={styles.bloqueTitulo}>{titulo}</div>
          {c[clave].map(g => <Grupo key={g.concepto} grupo={g} />)}
        </section>
      ))}

      {deEmpresa ? (
        <>
          {seguros.length > 0 && (
            <section className={styles.bloque}>
              <div className={styles.bloqueTitulo}>Seguros</div>
              {seguros.map(g => <Grupo key={g.concepto} grupo={{ ...g, signo: -1 }} />)}
            </section>
          )}
          {/* El de la empresa tiene un solo total, y es el Total a pagar del
              tercero: que den igual es la comprobación de que está bien. */}
          <Total label="Total a facturar" valor={r.total_a_pagar} fuerte />
        </>
      ) : (
        <>
          <Total label="Total a facturar" valor={r.total_a_facturar} fuerte />
          {seguros.length > 0 && (
            <section className={styles.bloque}>
              <div className={styles.bloqueTitulo}>Seguros</div>
              {seguros.map(g => <Grupo key={g.concepto} grupo={{ ...g, signo: -1 }} />)}
            </section>
          )}
          <Total label="Total a pagar" valor={r.total_a_pagar} fuerte />
        </>
      )}

      <div className={styles.cuenta}>
        <Total label="Saldo anterior" valor={r.saldo_anterior} />
        <Total label="Total" valor={r.total} fuerte />
      </div>

      {!deEmpresa && r.empresa && (
        <div className={styles.pie}>
          Facturar a {r.empresa} por {comoPesos(r.total_a_facturar)}.
        </div>
      )}
    </div>
  )
}

export default function Recibo() {
  const [params] = useSearchParams()
  const quincena = params.get('quincena')
  const terceros = params.getAll('tercero')
  const [layout, setLayout] = useState('tercero')

  const consultas = useQueries({
    queries: terceros.map(t => ({
      queryKey: ['terceros', 'recibos', 'detalle', quincena, t],
      queryFn: () => detalleRecibo(quincena, t),
    })),
  })
  const cargando = consultas.some(q => q.isLoading)

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <div className={styles.modos}>
          <button className={`btn btn-sm ${layout === 'tercero' ? 'btn-primary' : ''}`}
                  onClick={() => setLayout('tercero')}>
            Del tercero
          </button>
          <button className={`btn btn-sm ${layout === 'empresa' ? 'btn-primary' : ''}`}
                  onClick={() => setLayout('empresa')}>
            De la empresa
          </button>
        </div>
        <button className="btn btn-primary btn-sm" disabled={cargando}
                onClick={() => window.print()}>
          Imprimir o guardar PDF ({terceros.length})
        </button>
      </div>

      {cargando && <div className={styles.vacio}>Armando los recibos…</div>}
      {!cargando && consultas.map((q, i) => (
        q.data
          ? <Hoja key={terceros[i]} r={q.data} layout={layout} />
          : <div key={terceros[i]} className={styles.vacio}>
              No se pudo traer el recibo de {terceros[i]}.
            </div>
      ))}
    </div>
  )
}
