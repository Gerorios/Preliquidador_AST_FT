import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import CargandoContenido from '../../../core/ui/CargandoContenido'
import Icono from '../../../core/ui/iconos'
import useAuthStore from '../../../core/authStore'
import { puedeEditar } from '../../../core/permisos'
import GrillaLineas from '../components/GrillaLineas'
import {
  CLAVE_COMPROBANTES, claveComprobante, obtenerComprobante, crearComprobante,
  editarComprobante, borrarComprobante, listarClientes, listarFincas,
  listarEmpresas, listarTareas, listarComprobantes,
} from '../services/comprobantes'
import {
  estadoNuevo, estadoDesdeDetalle, filaVacia, filaEstaVacia, validarFormulario, armarEntrada,
  errorDeGuardado, textoFecha, quitarFila as quitarDeLasFilas, restaurarFila, sacarDeLaPila,
} from '../formulario'
import { unidadAlElegirTarea } from '../lineas'
import { filaDelListado } from '../listado'
import { formatoPesos } from '../numeros'
import styles from './Comprobante.module.css'

// Alta, edición y consulta de un Comprobante (plan E2, FA6): la cabecera
// (Cliente, Empresa emisora, tipo, número, fecha y, en una Nota de crédito, la
// Factura que corrige) y la grilla de Líneas, que se copian mirando el PDF.
//
// Quien puede Editar carga y corrige; quien sólo Ve, o cualquiera ante un
// histórico, ve lo mismo como texto. En sólo lectura no se lee el sistema de
// campo: el detalle trae los nombres guardados, así que abre aunque el campo
// esté lento o caído. Para editar hacen falta los clientes, las tareas, las
// empresas y las fincas del Cliente, que se leen al abrir.

const TIPOS = { factura: 'Factura', nota_credito: 'Nota de crédito' }
const LISTADO = '/facturacion/comprobantes'

// El backend guarda estas lecturas 10 minutos; acá alcanza con cinco.
const FRESCO = 5 * 60_000
// El aviso con Deshacer dura más que uno común: da tiempo a leerlo y a llegar
// al botón (el mouse encima lo pausa).
const DURACION_DESHACER = 8000
const claveFincas = clienteId => ['facturacion', 'fincas', String(clienteId)]

const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es')

// El orden de los campos en la pantalla: el primer error que se enfoca.
const CAMPOS_CABECERA = ['cliente_id', 'empresa_emisora', 'tipo', 'numero', 'fecha', 'factura_corregida_id']
const CAMPOS_FILA = ['fecha', 'tarea_id', 'unidad', 'finca_id', 'cantidad', 'precio_unitario']

const idCabecera = campo => `cab-${campo}`
// El importe no es un campo: su error se corrige en la cantidad o el precio.
const idFila = (clave, campo) => `linea-${clave}-${campo === 'importe' ? 'cantidad' : campo}`

function titulo(detalle) {
  if (!detalle) return 'Nuevo comprobante'
  const fila = filaDelListado(detalle)
  return fila.numero ? `${fila.tipo_texto} ${fila.numero}` : `${fila.tipo_texto} sin número`
}

// ─── Piezas comunes ─────────────────────────────────────────────────────────

// `onVolver` recibe el clic del enlace al listado: el formulario lo frena si
// hay cambios sin guardar.
function Encabezado({ detalle, onVolver, children }) {
  return (
    <div className={styles.topbar}>
      <Link to={LISTADO} className={styles.volver} onClick={onVolver}>
        <Icono nombre="atras" size={14} enTexto /> Comprobantes
      </Link>
      <h1 className={styles.titulo}>{titulo(detalle)}</h1>
      {detalle?.es_historico && <span className="badge badge-muted">Histórico</span>}
      {detalle?.pendiente_de_facturar && <span className="badge badge-warn">Pendiente de facturar</span>}
      {children && <div className={styles.acciones}>{children}</div>}
    </div>
  )
}

// Un aviso a todo el ancho, debajo del encabezado: queda a la vista aunque la
// grilla esté corrida hacia abajo. `tono` "error" o "info".
function Aviso({ tono = 'error', titulo: tituloAviso, children, acciones }) {
  return (
    <div className={`${styles.aviso} ${tono === 'info' ? styles.avisoInfo : styles.avisoError}`} role={tono === 'error' ? 'alert' : 'status'}>
      <Icono nombre="alerta" size={16} enTexto className={styles.avisoIcono} />
      <div className={styles.avisoTexto}>
        {tituloAviso && <strong>{tituloAviso}</strong>}
        {children && <span>{children}</span>}
      </div>
      {acciones && <div className={styles.avisoAcciones}>{acciones}</div>}
    </div>
  )
}

function Pagina({ children }) {
  return <div className={styles.page}>{children}</div>
}

// Las Notas de crédito de una Factura, o la Factura de una Nota, como enlaces.
function Relacionados({ detalle }) {
  if (detalle.tipo === 'nota_credito' && detalle.factura_corregida) {
    const f = detalle.factura_corregida
    return (
      <p className={styles.relacionados}>
        Corrige la{' '}
        <Link to={`${LISTADO}/${f.id}`} className={styles.enlace}>
          Factura {f.numero ?? 'sin número'}{f.fecha ? ` del ${textoFecha(f.fecha)}` : ''}
        </Link>
      </p>
    )
  }
  if (detalle.notas_credito?.length) {
    return (
      <p className={styles.relacionados}>
        {detalle.notas_credito.length === 1 ? 'La corrige la Nota de crédito ' : 'La corrigen las Notas de crédito '}
        {detalle.notas_credito.map((n, i) => (
          <span key={n.id}>
            {i > 0 && ', '}
            <Link to={`${LISTADO}/${n.id}`} className={styles.enlace}>{n.numero ?? 'sin número'}</Link>
          </span>
        ))}
      </p>
    )
  }
  return null
}

// ─── Sólo lectura ───────────────────────────────────────────────────────────

function Dato({ etiqueta, children }) {
  return (
    <div className={styles.campo}>
      <dt className="field-label">{etiqueta}</dt>
      <dd className={styles.valor}>{children}</dd>
    </div>
  )
}

function Vista({ detalle, aviso }) {
  const fila = filaDelListado(detalle)
  const apagado = texto => <span className={styles.apagado}>{texto}</span>
  return (
    <Pagina>
      <Encabezado detalle={detalle} />
      {aviso}
      <div className={styles.cuerpo}>
        {detalle.es_historico && (
          <p className={styles.nota}>
            Comprobante histórico, migrado de la planilla: no se edita ni se borra.
            Sus importes son los de la planilla, tal cual.
          </p>
        )}
        <dl className={styles.cabecera}>
          <Dato etiqueta="Cliente">{detalle.cliente_nombre}</Dato>
          <Dato etiqueta="Empresa emisora">{detalle.empresa_emisora ?? apagado('Sin empresa')}</Dato>
          <Dato etiqueta="Tipo">{fila.tipo_texto}</Dato>
          <Dato etiqueta="Número">
            {detalle.numero ? <span className="mono">{detalle.numero}</span> : apagado('Sin número')}
          </Dato>
          <Dato etiqueta="Fecha">{textoFecha(detalle.fecha) ?? apagado('Sin fecha')}</Dato>
        </dl>
        <Relacionados detalle={detalle} />
        <section className={styles.seccion} aria-labelledby="titulo-lineas">
          <h2 id="titulo-lineas" className={styles.subtitulo}>Líneas</h2>
          <GrillaLineas soloLectura lineas={detalle.lineas ?? []} tipo={detalle.tipo} />
        </section>
      </div>
    </Pagina>
  )
}

// ─── Formulario ─────────────────────────────────────────────────────────────

function Campo({ campo, etiqueta, error, ayuda, children }) {
  return (
    <div className={styles.campo}>
      <label className="field-label" htmlFor={idCabecera(campo)}>{etiqueta}</label>
      {children}
      {error && (
        <p id={`${idCabecera(campo)}-error`} className={styles.errorCampo}>
          <Icono nombre="alerta" size={13} enTexto className={styles.errorIcono} />
          {error}
        </p>
      )}
      {!error && ayuda && <p className={styles.ayuda}>{ayuda}</p>}
    </div>
  )
}

// Las props de accesibilidad de un campo de la cabecera con o sin error.
const propsError = (campo, error) => ({
  id: idCabecera(campo),
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${idCabecera(campo)}-error` : undefined,
})

// Texto de una Factura en el selector de la Nota de crédito: número, fecha y
// total, para reconocerla sin abrirla.
function textoFactura(f) {
  const partes = [f.numero ? `N° ${f.numero}` : 'Sin número']
  if (f.fecha) partes.push(textoFecha(f.fecha))
  if (f.total_neto != null) partes.push(formatoPesos(f.total_neto))
  if (f.es_historico) partes.push('histórico')
  return partes.join(' · ')
}

function Formulario({ detalle, clientes, empresas, tareas }) {
  const esNuevo = !detalle
  const navigate = useNavigate()
  const qc = useQueryClient()

  const tareasPorId = useMemo(() => new Map(tareas.map(t => [t.tarea_id, t])), [tareas])
  const tareasOrdenadas = useMemo(() => [...tareas].sort(porNombre), [tareas])

  // El formulario se arma una vez con lo guardado; la página lo vuelve a montar
  // (key) cuando cambia lo guardado, después de guardar o al volver a abrirlo.
  const [inicial] = useState(() => (detalle ? estadoDesdeDetalle(detalle, tareasPorId) : estadoNuevo()))
  const [estado, setEstado] = useState(inicial)
  const { cabecera, filas } = estado
  // En el alta, lo inicial es el formulario vacío: cualquier cosa cargada ya es
  // un cambio. En la edición, lo guardado.
  const sucio = useMemo(() => JSON.stringify(estado) !== JSON.stringify(inicial), [estado, inicial])
  // Se guardó un alta o se borró: la pantalla se va sola y lo que hubiera sin
  // guardar ya no cuenta (en la edición, guardar vuelve a montar el formulario
  // con lo guardado, sin cambios).
  const [saliendo, setSaliendo] = useState(false)
  const conCambios = sucio && !saliendo

  // Se intentó guardar con algo mal: desde ahí se marcan los errores propios y
  // se actualizan mientras se corrige. `errorApi` es el que volvió del backend.
  const [intento, setIntento] = useState(false)
  const [errorApi, setErrorApi] = useState(null)
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(false)
  // Se tocó "Comprobantes" con cambios sin guardar: espera que se confirme.
  const [confirmandoSalir, setConfirmandoSalir] = useState(false)

  // Cerrar la pestaña o recargar con cambios sin guardar pide confirmación al
  // navegador (que muestra su propio texto). El menú lateral no se puede
  // frenar: con BrowserRouter haría falta tocar el núcleo (revisión de FT-A,
  // RA2).
  useEffect(() => {
    if (!conCambios) return
    const avisar = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [conCambios])

  // El enlace al listado: con cambios, antes se confirma. Abrirlo en otra
  // pestaña (Ctrl, Shift, la rueda) no pierde nada y pasa derecho.
  const pedirVolver = (e) => {
    if (!conCambios || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    setConfirmandoSalir(true)
  }

  const descartarYVolver = () => {
    setSaliendo(true)
    navigate(LISTADO)
  }

  // Foco pendiente: el id del campo a enfocar después del próximo render (la
  // fila nueva, el primer error).
  const foco = useRef(null)
  useEffect(() => {
    if (!foco.current) return
    const elemento = document.getElementById(foco.current)
    foco.current = null
    elemento?.focus()
  })

  // Las filas quitadas que todavía se pueden deshacer, en el orden en que se
  // quitaron, con el id de su aviso (formulario.js, "Quitar y deshacer").
  const quitadas = useRef([])
  // Al salir de la pantalla, o cuando se vuelve a montar con lo guardado, ya no
  // hay a dónde devolverlas: se cierran sus avisos.
  useEffect(() => {
    const pila = quitadas
    return () => pila.current.forEach(q => q.aviso && toast.dismiss(q.aviso))
  }, [])

  const tieneNotas = (detalle?.notas_credito?.length ?? 0) > 0

  // ─── Lecturas que dependen de la cabecera ───
  const clienteId = cabecera.cliente_id
  const fincasQ = useQuery({
    queryKey: claveFincas(clienteId),
    queryFn: () => listarFincas(clienteId),
    enabled: clienteId != null,
    staleTime: FRESCO,
  })
  const fincas = useMemo(() => [...(fincasQ.data ?? [])].sort(porNombre), [fincasQ.data])
  let estadoFincas = 'ok'
  if (clienteId == null) estadoFincas = 'sin_cliente'
  else if (fincasQ.isLoading) estadoFincas = 'cargando'
  else if (fincasQ.isError && !fincasQ.data) estadoFincas = 'error'

  // Las Facturas del Cliente, para elegir la que corrige una Nota de crédito:
  // salen del listado, que ya las trae con su número, fecha y total.
  const esNota = cabecera.tipo === 'nota_credito'
  const listadoQ = useQuery({
    queryKey: CLAVE_COMPROBANTES,
    queryFn: listarComprobantes,
    enabled: esNota,
  })
  const facturasDelCliente = useMemo(() => {
    const propias = (listadoQ.data ?? [])
      .filter(f => f.tipo === 'factura' && f.cliente_id === clienteId && f.id !== detalle?.id)
    // La guardada se ofrece aunque el listado no haya llegado.
    const guardada = detalle?.factura_corregida
    if (guardada && detalle.cliente_id === clienteId && !propias.some(f => f.id === guardada.id)) {
      propias.unshift({ ...guardada, total_neto: null, es_historico: false })
    }
    return propias
  }, [listadoQ.data, clienteId, detalle])

  // ─── Errores a la vista ───
  const validacion = useMemo(() => validarFormulario(cabecera, filas), [cabecera, filas])
  const erroresCabecera = { ...(intento ? validacion.cabecera : {}) }
  const erroresFilas = { ...(intento ? validacion.filas : {}) }
  let errorGeneral = intento ? validacion.general : null
  if (errorApi?.tipo === 'cabecera') {
    if (errorApi.campo === 'lineas' || !CAMPOS_CABECERA.includes(errorApi.campo)) errorGeneral = errorApi.mensaje
    else erroresCabecera[errorApi.campo] = errorApi.mensaje
  }
  if (errorApi?.tipo === 'linea' && errorApi.clave) {
    erroresFilas[errorApi.clave] = { ...(erroresFilas[errorApi.clave] ?? {}), [errorApi.campo]: errorApi.mensaje }
  }
  if (errorApi?.tipo === 'repetido') {
    erroresCabecera.numero = 'Ese número ya está registrado: mirá el aviso de arriba.'
  }

  // ─── Cambios ───
  const limpiarErrorDe = (campo, clave) => {
    if (!errorApi) return
    const deCabecera = errorApi.tipo === 'cabecera' && errorApi.campo === campo
    const repetido = errorApi.tipo === 'repetido' && ['numero', 'empresa_emisora', 'tipo', 'cliente_id'].includes(campo)
    const deFila = errorApi.tipo === 'linea' && clave != null && errorApi.clave === clave
    if (deCabecera || repetido || deFila) setErrorApi(null)
  }

  const cambiarCabecera = (campo, valor) => {
    const nueva = { ...cabecera, [campo]: valor }
    let nuevasFilas = filas
    // Una Factura no corrige a nadie; al cambiar de Cliente, la Factura
    // corregida y las fincas eran del otro.
    if (campo === 'tipo' && valor === 'factura') nueva.factura_corregida_id = null
    if (campo === 'cliente_id' && valor !== cabecera.cliente_id) {
      nueva.factura_corregida_id = null
      if (filas.some(f => f.finca_id != null)) {
        nuevasFilas = filas.map(f => ({ ...f, finca_id: null, finca_nombre: null }))
        toast('Se quitaron las fincas de las líneas: eran del Cliente anterior.')
      }
    }
    setEstado({ cabecera: nueva, filas: nuevasFilas })
    limpiarErrorDe(campo)
  }

  const cambiarFila = (clave, cambios) => {
    setEstado({ cabecera, filas: filas.map(f => (f.clave === clave ? { ...f, ...cambios } : f)) })
    limpiarErrorDe(null, clave)
  }

  const elegirTarea = (clave, tarea) => {
    const fila = filas.find(f => f.clave === clave)
    cambiarFila(clave, {
      tarea_id: tarea?.tarea_id ?? null,
      tarea_nombre: tarea?.nombre ?? '',
      unidad: unidadAlElegirTarea(fila, tarea),
    })
  }

  // La fila nueva copia la fecha de la anterior: las Líneas de un mismo PDF
  // suelen ser de la misma quincena (el 1 o el 16).
  const agregarFila = () => {
    const nueva = filaVacia(filas.at(-1)?.fecha ?? '')
    setEstado({ cabecera, filas: [...filas, nueva] })
    foco.current = idFila(nueva.clave, 'fecha')
  }

  // Devuelve la fila de esa clave y las quitadas después de ella. Lo llama el
  // aviso, que se armó al quitar: las filas de ahora salen del estado, no de
  // este render.
  const deshacerQuitar = (clave) => {
    const { pila, restauradas } = sacarDeLaPila(quitadas.current, clave)
    if (!restauradas.length) return
    quitadas.current = pila
    restauradas.forEach(q => q.aviso && toast.dismiss(q.aviso))
    setEstado(prev => ({ ...prev, filas: restauradas.reduce(restaurarFila, prev.filas) }))
    // El foco vuelve a donde estaba al quitarla.
    foco.current = idFila(clave, 'quitar')
  }

  const quitarFila = (clave) => {
    const { filas: restantes, quitada } = quitarDeLasFilas(filas, clave)
    if (!quitada) return
    setEstado({ cabecera, filas: restantes })
    limpiarErrorDe(null, clave)
    // El foco sigue en la grilla: el quitar de la fila que quedó en su lugar,
    // o el de la anterior, o "Agregar línea".
    const vecina = restantes[quitada.indice] ?? restantes[quitada.indice - 1]
    foco.current = vecina ? idFila(vecina.clave, 'quitar') : 'grilla-agregar'
    // Una fila vacía no tiene nada que perder: sale sin aviso. Se apila igual,
    // para que deshacer otra la devuelva a su lugar.
    const aviso = filaEstaVacia(quitada.fila) ? null : toast(
      <span className="flex items-center gap-3">
        Se quitó la línea {quitada.indice + 1}
        <button type="button" className="btn btn-sm" onClick={() => deshacerQuitar(clave)}>
          Deshacer
        </button>
      </span>,
      { duration: DURACION_DESHACER },
    )
    quitadas.current = [...quitadas.current, { ...quitada, aviso }]
  }

  // ─── Guardar ───
  const mutGuardar = useMutation({
    mutationFn: ({ entrada }) => (esNuevo ? crearComprobante(entrada) : editarComprobante(detalle.id, entrada)),
    onSuccess: (guardado) => {
      qc.invalidateQueries({ queryKey: CLAVE_COMPROBANTES })
      // El detalle nuevo vuelve a montar el formulario con lo guardado.
      qc.setQueryData(claveComprobante(guardado.id), guardado)
      toast.success(`${TIPOS[guardado.tipo] ?? 'Comprobante'} ${esNuevo ? 'guardada' : 'actualizada'}`)
      if (esNuevo) {
        // Lo cargado ya está guardado: pasar al detalle no tiene nada que avisar.
        setSaliendo(true)
        navigate(`${LISTADO}/${guardado.id}`, { replace: true })
      }
    },
    onError: (error, { claves }) => {
      const marca = errorDeGuardado(error, claves)
      setErrorApi(marca)
      if (marca.tipo === 'linea' && marca.clave) foco.current = idFila(marca.clave, marca.campo)
      else if (marca.tipo === 'cabecera') {
        foco.current = CAMPOS_CABECERA.includes(marca.campo) ? idCabecera(marca.campo) : 'grilla-agregar'
      } else if (marca.tipo === 'repetido') foco.current = idCabecera('numero')
    },
  })

  const guardar = () => {
    setErrorApi(null)
    setConfirmandoBorrar(false)
    setConfirmandoSalir(false)
    if (validacion.hayErrores) {
      setIntento(true)
      const campoCabecera = CAMPOS_CABECERA.find(c => validacion.cabecera[c])
      const filaConError = filas.find(f => validacion.filas[f.clave])
      if (campoCabecera) foco.current = idCabecera(campoCabecera)
      else if (filaConError) {
        const errs = validacion.filas[filaConError.clave]
        foco.current = idFila(filaConError.clave, CAMPOS_FILA.find(c => errs[c]) ?? 'cantidad')
      } else foco.current = 'grilla-agregar'
      return
    }
    const { entrada, claves } = armarEntrada(cabecera, filas, detalle?.actualizado_en)
    mutGuardar.mutate({ entrada, claves })
  }

  // ─── Borrar ───
  const mutBorrar = useMutation({
    mutationFn: () => borrarComprobante(detalle.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CLAVE_COMPROBANTES })
      toast.success(`${TIPOS[detalle.tipo]} borrada`)
      setSaliendo(true)
      navigate(LISTADO)
      qc.removeQueries({ queryKey: claveComprobante(detalle.id) })
    },
    onError: (error) => {
      setConfirmandoBorrar(false)
      setErrorApi({ ...errorDeGuardado(error, []), operacion: 'borrar' })
    },
  })

  const volverAAbrir = () => {
    setErrorApi(null)
    qc.invalidateQueries({ queryKey: claveComprobante(detalle.id) })
  }

  // ─── Avisos de arriba ───
  let aviso = null
  if (errorApi?.tipo === 'repetido') {
    aviso = (
      <Aviso
        titulo="No se guardó: ese número ya está registrado."
        acciones={(
          <Link to={`${LISTADO}/${errorApi.comprobanteId}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
            Ver el existente en otra pestaña
          </Link>
        )}
      >
        {errorApi.mensaje} Revisá el número y la Empresa emisora contra el PDF.
      </Aviso>
    )
  } else if (errorApi?.tipo === 'modificado') {
    aviso = (
      <Aviso
        titulo="No se guardó: otra persona cambió este comprobante mientras lo editabas."
        acciones={<button type="button" className="btn btn-sm" onClick={volverAAbrir}>Volver a abrirlo</button>}
      >
        Para no pisar su trabajo, no se cambió nada. Al volver a abrirlo vas a ver lo que guardó la otra persona, y se pierde lo que cambiaste acá.
      </Aviso>
    )
  } else if (errorApi?.tipo === 'no_existe') {
    aviso = (
      <Aviso
        titulo={errorApi.mensaje}
        acciones={<Link to={LISTADO} className="btn btn-sm">Volver a Comprobantes</Link>}
      />
    )
  } else if (errorApi?.tipo === 'aviso') {
    aviso = (
      <Aviso titulo={errorApi.operacion === 'borrar' ? 'No se borró.' : 'No se guardó.'}>
        {errorApi.mensaje}
      </Aviso>
    )
  } else if (errorApi || (intento && validacion.hayErrores)) {
    aviso = (
      <Aviso titulo="No se guardó: hay datos para corregir.">
        Están marcados en rojo, con el motivo debajo de cada uno.
      </Aviso>
    )
  }

  const fila = detalle ? filaDelListado(detalle) : null
  const clientesConGuardado = useMemo(() => {
    const lista = [...clientes].sort(porNombre)
    if (detalle && !lista.some(c => c.id === detalle.cliente_id)) {
      lista.unshift({ id: detalle.cliente_id, nombre: `${detalle.cliente_nombre} (dado de baja)` })
    }
    return lista
  }, [clientes, detalle])
  const empresasConGuardada = useMemo(() => {
    const guardada = detalle?.empresa_emisora
    return guardada && !empresas.includes(guardada) ? [guardada, ...empresas] : empresas
  }, [empresas, detalle])

  let opcionesFactura
  if (clienteId == null) opcionesFactura = <option value="">Elegí el Cliente primero</option>
  else if (listadoQ.isLoading && facturasDelCliente.length === 0) opcionesFactura = <option value="">Cargando facturas…</option>
  else if (facturasDelCliente.length === 0) {
    opcionesFactura = (
      <option value="">
        {listadoQ.isError ? 'No se pudieron leer las facturas' : 'Ese Cliente no tiene facturas registradas'}
      </option>
    )
  } else {
    opcionesFactura = (
      <>
        <option value="">Elegí la factura…</option>
        {facturasDelCliente.map(f => <option key={f.id} value={f.id}>{textoFactura(f)}</option>)}
      </>
    )
  }

  return (
    <Pagina>
      <Encabezado detalle={detalle} onVolver={pedirVolver}>
        {conCambios && <span className={styles.sinGuardar}>Hay cambios sin guardar</span>}
        <button type="button" className="btn btn-primary" onClick={guardar} disabled={mutGuardar.isPending}>
          {esNuevo ? 'Guardar comprobante' : 'Guardar cambios'}
        </button>
      </Encabezado>
      {confirmandoSalir && conCambios && (
        <div className={styles.confirmacion} role="alert">
          <span>
            Hay cambios sin guardar en {esNuevo ? <strong>el comprobante nuevo</strong> : <>la {fila.tipo_texto} <strong>{fila.numero_texto}</strong></>}.
            {' '}Si volvés a Comprobantes, se pierden.
          </span>
          <button type="button" className="btn btn-sm btn-danger" onClick={descartarYVolver}>
            Descartar y volver
          </button>
          <button type="button" className="btn btn-sm" autoFocus onClick={() => setConfirmandoSalir(false)}>
            Seguir editando
          </button>
        </div>
      )}
      {aviso}
      <div className={styles.cuerpo}>
        <div className={styles.cabecera}>
          <Campo
            campo="cliente_id" etiqueta="Cliente" error={erroresCabecera.cliente_id}
            ayuda={tieneNotas ? 'Tiene notas de crédito: no cambia de Cliente.' : null}
          >
            <select
              {...propsError('cliente_id', erroresCabecera.cliente_id)}
              className="input"
              value={clienteId ?? ''}
              disabled={tieneNotas}
              // En el alta se arranca a cargar sin tocar el mouse.
              autoFocus={esNuevo}
              onChange={e => cambiarCabecera('cliente_id', e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">Elegí el Cliente…</option>
              {clientesConGuardado.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>

          <Campo campo="empresa_emisora" etiqueta="Empresa emisora" error={erroresCabecera.empresa_emisora}>
            <select
              {...propsError('empresa_emisora', erroresCabecera.empresa_emisora)}
              className="input"
              value={cabecera.empresa_emisora}
              onChange={e => cambiarCabecera('empresa_emisora', e.target.value)}
            >
              <option value="">Elegí la empresa…</option>
              {empresasConGuardada.map(nombre => <option key={nombre} value={nombre}>{nombre}</option>)}
            </select>
          </Campo>

          <fieldset className={styles.campo} aria-describedby={erroresCabecera.tipo ? `${idCabecera('tipo')}-error` : undefined}>
            <legend className="field-label">Tipo</legend>
            <div className={styles.segmentado}>
              {Object.entries(TIPOS).map(([valor, texto], i) => (
                <label key={valor} className={styles.segmento}>
                  <input
                    type="radio"
                    name="tipo"
                    id={i === 0 ? idCabecera('tipo') : undefined}
                    value={valor}
                    checked={cabecera.tipo === valor}
                    disabled={tieneNotas}
                    onChange={() => cambiarCabecera('tipo', valor)}
                  />
                  <span>{texto}</span>
                </label>
              ))}
            </div>
            {erroresCabecera.tipo && (
              <p id={`${idCabecera('tipo')}-error`} className={styles.errorCampo}>{erroresCabecera.tipo}</p>
            )}
          </fieldset>

          <Campo campo="numero" etiqueta="Número" error={erroresCabecera.numero} ayuda="Tal cual figura en el PDF.">
            <input
              {...propsError('numero', erroresCabecera.numero)}
              type="text"
              className="input input-mono"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              value={cabecera.numero}
              onChange={e => cambiarCabecera('numero', e.target.value)}
            />
          </Campo>

          <Campo campo="fecha" etiqueta="Fecha" error={erroresCabecera.fecha}>
            <input
              {...propsError('fecha', erroresCabecera.fecha)}
              type="date"
              className="input"
              value={cabecera.fecha}
              onChange={e => cambiarCabecera('fecha', e.target.value)}
            />
          </Campo>

          {esNota && (
            <div className={styles.campoAncho}>
              <Campo campo="factura_corregida_id" etiqueta="Factura que corrige" error={erroresCabecera.factura_corregida_id}>
                <select
                  {...propsError('factura_corregida_id', erroresCabecera.factura_corregida_id)}
                  className="input"
                  value={cabecera.factura_corregida_id ?? ''}
                  disabled={clienteId == null || facturasDelCliente.length === 0}
                  onChange={e => cambiarCabecera('factura_corregida_id', e.target.value === '' ? null : Number(e.target.value))}
                >
                  {opcionesFactura}
                </select>
              </Campo>
            </div>
          )}
        </div>

        {detalle && <Relacionados detalle={detalle} />}

        <section className={styles.seccion} aria-labelledby="titulo-lineas">
          <div className={styles.seccionTitulo}>
            <h2 id="titulo-lineas" className={styles.subtitulo}>Líneas</h2>
            <span className={styles.ayudaSeccion}>
              Copialas del PDF: Tab pasa al campo siguiente. Los números van con coma decimal, por ejemplo 1.234,50.
            </span>
          </div>
          {errorGeneral && (
            <p className={styles.errorGeneral} role="alert">
              <Icono nombre="alerta" size={14} enTexto className={styles.errorIcono} />
              {errorGeneral}
            </p>
          )}
          <GrillaLineas
            filas={filas}
            tipo={cabecera.tipo}
            tareas={tareasOrdenadas}
            tareasPorId={tareasPorId}
            fincas={fincas}
            estadoFincas={estadoFincas}
            errores={erroresFilas}
            onCambiar={cambiarFila}
            onElegirTarea={elegirTarea}
            onAgregar={agregarFila}
            onQuitar={quitarFila}
          />
        </section>

        {!esNuevo && (
          <div className={styles.zonaBorrar}>
            {confirmandoBorrar ? (
              <div className={styles.confirmacion} role="alert">
                <span>
                  ¿Borrar la {fila.tipo_texto} <strong>{fila.numero_texto}</strong> de {detalle.cliente_nombre}?
                  {' '}Se borran también sus líneas{detalle.cantidad_adjuntos > 0 ? ' y sus adjuntos' : ''}. No se puede deshacer.
                </span>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => mutBorrar.mutate()}>
                  Sí, borrar
                </button>
                <button type="button" className="btn btn-sm" autoFocus onClick={() => setConfirmandoBorrar(false)}>
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={tieneNotas}
                  aria-describedby={tieneNotas ? 'motivo-no-borrar' : undefined}
                  onClick={() => setConfirmandoBorrar(true)}
                >
                  Borrar comprobante
                </button>
                {tieneNotas && (
                  <span id="motivo-no-borrar" className={styles.motivoBorrar}>
                    No se puede borrar: tiene notas de crédito que la corrigen.
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </Pagina>
  )
}

// ─── Página ─────────────────────────────────────────────────────────────────

function ErrorDeCarga({ titulo: tituloError, error, onReintentar, reintentando }) {
  return (
    <Aviso
      titulo={tituloError}
      acciones={(
        <button type="button" className="btn btn-sm" onClick={onReintentar} disabled={reintentando}>
          {reintentando ? 'Reintentando…' : 'Reintentar'}
        </button>
      )}
    >
      {error?.message}
    </Aviso>
  )
}

export default function Comprobante() {
  const { id } = useParams()
  const esNuevo = id == null
  const { usuario } = useAuthStore()
  const editable = puedeEditar(usuario, 'facturacion', 'comprobantes')

  const detalleQ = useQuery({
    queryKey: claveComprobante(id),
    queryFn: () => obtenerComprobante(id),
    enabled: !esNuevo,
  })
  const detalle = detalleQ.data
  // Para editar hacen falta las lecturas del campo; para mirar, no.
  const usaCampo = editable && (esNuevo || (detalle != null && !detalle.es_historico))

  const clientesQ = useQuery({ queryKey: ['facturacion', 'clientes'], queryFn: listarClientes, enabled: usaCampo, staleTime: FRESCO })
  const tareasQ = useQuery({ queryKey: ['facturacion', 'tareas'], queryFn: listarTareas, enabled: usaCampo, staleTime: FRESCO })
  const empresasQ = useQuery({ queryKey: ['facturacion', 'empresas'], queryFn: listarEmpresas, enabled: usaCampo, staleTime: FRESCO })
  // Las fincas del Cliente guardado se leen con el resto, así la grilla abre
  // completa; las de otro Cliente las pide el formulario al cambiarlo.
  const fincasQ = useQuery({
    queryKey: claveFincas(detalle?.cliente_id),
    queryFn: () => listarFincas(detalle.cliente_id),
    enabled: usaCampo && detalle != null,
    staleTime: FRESCO,
  })

  // En el alta, quien no puede Editar vuelve al listado.
  if (esNuevo && !editable) return <Navigate to={LISTADO} replace />

  // Se espera con isPending (todavía no hay datos), no con isLoading (sólo
  // mientras busca): una lectura en pausa o cancelada sin datos queda en
  // pending sin buscar, y con isLoading pasaba de largo con los datos
  // undefined y la pantalla quedaba en blanco (revisión de FT-A, RA4).
  if (!esNuevo && detalleQ.isPending) {
    return (
      <Pagina>
        <Encabezado detalle={null} />
        <CargandoContenido texto="Cargando el comprobante…" />
      </Pagina>
    )
  }

  if (!esNuevo && detalleQ.isError && (!detalle || detalleQ.error?.status === 404)) {
    // 404, o un id que no es un número (422 de la ruta): no hay tal comprobante.
    const noExiste = [404, 422].includes(detalleQ.error?.status)
    return (
      <Pagina>
        <Encabezado detalle={null} />
        {noExiste ? (
          <div className={styles.vacio}>
            <h2 className={styles.vacioTitulo}>Este comprobante no existe</h2>
            <p className={styles.vacioTexto}>Puede que lo hayan borrado. Volvé al listado para buscarlo.</p>
            <Link to={LISTADO} className={`btn ${styles.enlaceBoton}`}>Volver a Comprobantes</Link>
          </div>
        ) : (
          <ErrorDeCarga
            titulo="No se pudo cargar el comprobante."
            error={detalleQ.error}
            onReintentar={() => detalleQ.refetch()}
            reintentando={detalleQ.isFetching}
          />
        )}
      </Pagina>
    )
  }

  const lecturas = [clientesQ, tareasQ, empresasQ, ...(detalle ? [fincasQ] : [])]
  if (usaCampo && lecturas.some(q => q.isPending)) {
    return (
      <Pagina>
        <Encabezado detalle={detalle ?? null} />
        <CargandoContenido texto="Leyendo clientes, tareas y fincas del sistema de campo…" />
      </Pagina>
    )
  }

  // Las fincas pueden fallar sin frenar: la grilla avisa en su columna.
  const fallidas = [clientesQ, tareasQ, empresasQ].filter(q => q.isError && !q.data)
  if (usaCampo && fallidas.length) {
    const error = (
      <ErrorDeCarga
        titulo={esNuevo
          ? 'No se pudo leer el sistema de campo: sin los clientes, las tareas y las empresas no se puede cargar un comprobante.'
          : 'No se pudo leer el sistema de campo: por ahora el comprobante se ve sin poder editarlo.'}
        error={fallidas[0].error}
        onReintentar={() => fallidas.forEach(q => q.refetch())}
        reintentando={fallidas.some(q => q.isFetching)}
      />
    )
    if (esNuevo) {
      return (
        <Pagina>
          <Encabezado detalle={null} />
          {error}
        </Pagina>
      )
    }
    return <Vista detalle={detalle} aviso={error} />
  }

  if (!usaCampo) return <Vista detalle={detalle} />

  return (
    <Formulario
      // Lo guardado cambia al guardar o al volver a abrirlo: el formulario
      // arranca de nuevo con eso.
      key={detalle ? `${detalle.id}-${detalle.actualizado_en ?? 'sin-editar'}` : 'nuevo'}
      detalle={detalle ?? null}
      clientes={clientesQ.data}
      empresas={empresasQ.data}
      tareas={tareasQ.data}
    />
  )
}
