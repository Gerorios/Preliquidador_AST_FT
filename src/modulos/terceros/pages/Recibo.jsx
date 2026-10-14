import { Fragment, useEffect, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
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

// Lo de la quincena va sin título: es lo que se espera encontrar en el recibo,
// y el título sólo hace falta para lo que viene de otro lado (lo pidió el
// usuario, 2026-10-05).
const BLOQUES = [
  ['quincena', null],
  ['cuotas', 'Cuotas de repuestos'],
  // Lo movido de otra quincena y lo cargado a mano, agrupado por concepto.
  ['ajustes', 'Ajustes'],
]

// En el recibo, algunas líneas se describen más corto que en la grilla: el
// tercero reconoce una carga por patente, vale y estación, y la observación es
// para quien liquida (lo pidió el usuario, 2026-10-05). El vale va como número
// solo, sin la palabra. Lo que no está acá se describe igual que en la grilla.
const EN_RECIBO = {
  combustible: l => [l.patente, l.vale, l.estacion],
  // Un ajuste cargado a mano se explica por su motivo: el grupo ya dice de qué es.
  ajustes: l => [l.motivo],
}

const detalleDe = (l) =>
  (EN_RECIBO[l.concepto]
    ? EN_RECIBO[l.concepto](l).filter(Boolean).join(' · ')
    : resumen(l)) || l.concepto_label

// Un solo signo menos en toda la hoja. `comoPesos` de un negativo pone el guion
// corto, y al lado del «−» de los subtotales se leía como dos cosas distintas.
const pesos = (v) => (Number(v) < 0 ? `−${comoPesos(-Number(v))}` : comoPesos(v))
const signado = (signo, v) => pesos(signo * Number(v))

// Un grupo de ajustes puede mezclar lo que se le paga y lo que se le descuenta:
// su total es `neto`, que trae cada línea con su signo, y cada línea muestra el
// suyo. En los demás grupos el signo es uno solo y va en el total.
function Grupo({ grupo }) {
  const mezcla = grupo.lineas.some(l => l.signo !== grupo.signo)
  return (
    <div className={styles.grupo}>
      <div className={styles.grupoTitulo}>
        <span>{grupo.label}</span>
        <span>{grupo.neto != null ? pesos(grupo.neto) : signado(grupo.signo, grupo.subtotal)}</span>
      </div>
      <table className={styles.lineas}>
        {/* Anchos fijos: el detalle se lleva lo que sobra y baja de renglón si
            no entra, y los importes quedan alineados con los subtotales. */}
        <colgroup>
          <col className={styles.colFecha} />
          <col />
          <col className={styles.colCantidad} />
          <col className={styles.colPrecio} />
          <col className={styles.colImporte} />
        </colgroup>
        <tbody>
          {grupo.lineas.map((l, i) => (
            <tr key={i}>
              <td className={styles.fecha}>{comoFecha(l.fecha)}</td>
              <td className={styles.detalle}>
                {detalleDe(l)}
                {l.cuota && <span className={styles.nota}> · cuota {l.cuota}</span>}
                {l.viene_de && (
                  <span className={styles.nota}>
                    {' '}· de la {nombreQuincena(l.viene_de)}
                    {/* En un ajuste a mano el motivo ya es el detalle. */}
                    {l.motivo && l.concepto !== 'ajustes' ? `: ${l.motivo}` : ''}
                  </span>
                )}
              </td>
              <td className={styles.num}>{l.cantidad != null ? comoNumero(l.cantidad) : ''}</td>
              <td className={styles.num}>{l.precio != null && !l.cuota ? comoPesos(l.precio) : ''}</td>
              <td className={styles.num}>
                {mezcla ? signado(l.signo, l.importe) : comoPesos(l.importe)}
              </td>
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
      <span>{pesos(valor)}</span>
    </div>
  )
}

function Hoja({ r, layout }) {
  const c = r.contenido ?? {}
  const seguros = c.seguros ?? []
  const deEmpresa = layout === 'empresa'
  return (
    <div className={styles.hoja} data-tercero={r.tercero}>
      {!r.emitido && <div className={styles.borrador}>Borrador · sin emitir</div>}

      <div className={styles.cabecera}>
        <div>
          <div className={styles.titulo}>Orden de facturación</div>
          <div className={styles.tercero}>{r.tercero}</div>
        </div>
        <div className={styles.cabeceraDatos}>
          <div>{nombreQuincena(r.quincena)}</div>
          {/* Repartida entre varias empresas, cuánto a cada una: es lo que el
              tercero necesita para hacer sus facturas. */}
          {(r.facturas ?? []).length === 1 && <div>Factura a <b>{r.facturas[0].empresa}</b></div>}
          {(r.facturas ?? []).length > 1 && r.facturas.map(f => (
            <div key={f.empresa}>Facturar a <b>{f.empresa}</b>: {pesos(f.importe)}</div>
          ))}
          {r.emitido_en && <div>Emitido el {comoFecha(r.emitido_en.slice(0, 10))}</div>}
          {deEmpresa && <div className={styles.nota}>Copia de la empresa</div>}
        </div>
      </div>

      {BLOQUES.map(([clave, titulo]) => (c[clave] ?? []).length > 0 && (
        <section key={clave} className={styles.bloque}>
          {titulo && <div className={styles.bloqueTitulo}>{titulo}</div>}
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
    </div>
  )
}

// Un PDF por tercero, para mandarlo por WhatsApp (lo pidió el usuario,
// 2026-10-05). Dos caminos:
//
//   - **Uno**: «Guardar PDF» deja en pantalla sólo esa hoja y abre el diálogo
//     de imprimir del navegador; el título de la página es el nombre que
//     propone para el archivo. `?pdf=1` con un solo tercero lo abre al cargar.
//   - **Todos de un clic**: «Guardar todos» pide una carpeta una sola vez y
//     escribe ahí un PDF por tercero. El navegador no arma un PDF sin el
//     diálogo de imprimir, así que lo arma html2pdf.js a partir de la misma
//     hoja: un solo diseño para la pantalla, el papel y el PDF. La dependencia
//     la aprobó el usuario el 2026-10-05, antes que reportlab, porque con
//     reportlab el recibo se dibujaría dos veces. Se carga recién al usarla.
//     Elegir carpeta es de Chrome y Edge (quien manda los recibos usa Chrome).
const nombreArchivo = (tercero, quincena, layout) =>
  `Orden de facturación ${tercero} - ${nombreQuincena(quincena)}${layout === 'empresa' ? ' (empresa)' : ''}`

// Lo que Windows no acepta en un nombre de archivo.
const comoArchivo = (nombre) => `${nombre.replace(/[\\/:*?"<>|]/g, '-').trim()}.pdf`

// Los mismos márgenes que la hoja impresa (`@page`), y sin cortar un renglón
// ni el título de un grupo entre dos páginas.
const OPCIONES_PDF = {
  margin: [16, 14, 16, 14],
  image: { type: 'jpeg', quality: 0.95 },
  html2canvas: { scale: 2, backgroundColor: '#ffffff' },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css'], avoid: ['tr', '[class*="grupoTitulo"]'] },
}

const puedeElegirCarpeta = typeof window !== 'undefined'
  && typeof window.showDirectoryPicker === 'function'

export default function Recibo() {
  const [params] = useSearchParams()
  const quincena = params.get('quincena')
  const terceros = params.getAll('tercero')
  const automatico = params.get('pdf') === '1' && terceros.length === 1
  const [layout, setLayout] = useState('tercero')
  // El tercero cuyo PDF se está guardando: mientras tanto es la única hoja.
  const [solo, setSolo] = useState(null)
  // Los que ya se guardaron en esta pantalla, para no perder la cuenta
  // mientras se mandan de a uno.
  const [guardados, setGuardados] = useState(() => new Set())
  // Mientras se guardan todos: cuántos van de cuántos.
  const [progreso, setProgreso] = useState(null)
  const yaAbrio = useRef(false)

  const consultas = useQueries({
    queries: terceros.map(t => ({
      queryKey: ['terceros', 'recibos', 'detalle', quincena, t],
      queryFn: () => detalleRecibo(quincena, t),
    })),
  })
  const cargando = consultas.some(q => q.isLoading)

  useEffect(() => {
    if (!solo) return undefined
    const antes = document.title
    document.title = nombreArchivo(solo, quincena, layout)
    const terminar = () => {
      document.title = antes
      setGuardados(g => new Set(g).add(solo))
      setSolo(null)
    }
    window.addEventListener('afterprint', terminar, { once: true })
    // Se espera a que quede sólo esa hoja en pantalla antes de imprimir.
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', terminar)
    }
  }, [solo, quincena, layout])

  useEffect(() => {
    if (automatico && !cargando && consultas[0]?.data && !yaAbrio.current) {
      yaAbrio.current = true
      setSolo(terceros[0])
    }
  }, [automatico, cargando, consultas, terceros])

  const varios = terceros.length > 1

  const guardarTodos = async () => {
    let carpeta
    try {
      // Tiene que ser lo primero del clic: el navegador sólo abre el selector
      // si lo pidió alguien.
      carpeta = await window.showDirectoryPicker({
        id: 'recibos-terceros', mode: 'readwrite', startIn: 'documents',
      })
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('No se pudo abrir la carpeta')
      return
    }
    const listos = terceros.filter((_, i) => consultas[i]?.data)
    setProgreso({ hecho: 0, total: listos.length })
    const fallaron = []
    try {
      const { default: html2pdf } = await import('html2pdf.js')
      for (const [n, t] of listos.entries()) {
        const hoja = document.querySelector(`[data-tercero="${CSS.escape(t)}"]`)
        try {
          hoja.setAttribute('data-pdf', '')
          const pdf = await html2pdf().set(OPCIONES_PDF).from(hoja).outputPdf('blob')
          const archivo = await carpeta.getFileHandle(
            comoArchivo(nombreArchivo(t, quincena, layout)), { create: true })
          const escritor = await archivo.createWritable()
          await escritor.write(pdf)
          await escritor.close()
          setGuardados(g => new Set(g).add(t))
        } catch {
          fallaron.push(t)
        } finally {
          hoja?.removeAttribute('data-pdf')
        }
        setProgreso({ hecho: n + 1, total: listos.length })
      }
    } catch {
      toast.error('No se pudo cargar el armado de PDF')
      return
    } finally {
      setProgreso(null)
    }
    const bien = listos.length - fallaron.length
    if (bien) toast.success(`${bien} PDF guardados en «${carpeta.name}»`)
    if (fallaron.length) toast.error(`No se pudieron guardar: ${fallaron.join(', ')}`)
  }

  return (
    <div className={styles.page}>
      <div className={styles.barra}>
        <div className={styles.modos}>
          {[['tercero', 'Del tercero'], ['empresa', 'De la empresa']].map(([clave, label]) => (
            <button key={clave} onClick={() => setLayout(clave)}
                    className={`${styles.chip} ${layout === clave ? styles.chipActivo : ''}`}>
              {label}
            </button>
          ))}
        </div>
        {varios && (
          <span className={styles.cuentaPdf}>
            {guardados.size} de {terceros.length} PDF guardados
          </span>
        )}
        {varios ? (
          <>
            <button className="btn btn-sm" disabled={cargando || !!progreso}
                    title="Todas las hojas en un solo PDF, para imprimir en papel"
                    onClick={() => window.print()}>
              Imprimir todos juntos
            </button>
            <button className="btn btn-primary btn-sm"
                    disabled={cargando || !!progreso || !puedeElegirCarpeta}
                    title={puedeElegirCarpeta
                      ? 'Un PDF por tercero, en la carpeta que elijas'
                      : 'Elegir una carpeta funciona en Chrome o Edge'}
                    onClick={guardarTodos}>
              {progreso
                ? `Guardando ${progreso.hecho} de ${progreso.total}…`
                : `Guardar todos (${terceros.length})`}
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" disabled={cargando || !consultas[0]?.data}
                  onClick={() => setSolo(terceros[0])}>
            Guardar PDF
          </button>
        )}
      </div>

      {cargando && <div className={styles.vacio}>Armando las órdenes de facturación…</div>}
      {!cargando && consultas.map((q, i) => {
        const t = terceros[i]
        if (solo && solo !== t) return null
        if (!q.data) {
          return (
            <div key={t} className={styles.vacio}>
              No se pudo traer la orden de facturación de {t}.
            </div>
          )
        }
        return (
          <Fragment key={t}>
            {varios && (
              <div className={styles.porHoja}>
                <span className={styles.porHojaNombre}>{t}</span>
                <button className={`btn btn-sm ${guardados.has(t) ? '' : 'btn-primary'}`}
                        disabled={!!solo || !!progreso}
                        onClick={() => setSolo(t)}>
                  {guardados.has(t) ? '✓ Guardado' : 'Guardar PDF'}
                </button>
              </div>
            )}
            <Hoja r={q.data} layout={layout} />
          </Fragment>
        )
      })}
    </div>
  )
}
