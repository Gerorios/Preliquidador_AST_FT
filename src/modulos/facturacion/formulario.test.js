import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aTextoArgentino, estadoNuevo, estadoDesdeDetalle, filaVacia, filaEstaVacia,
  validarFormulario, armarEntrada, errorDeGuardado, filtrarTareas, textoFecha,
  quitarFila, restaurarFila, sacarDeLaPila,
} from './formulario.js'
import { leerNumero } from './numeros.js'

test('aTextoArgentino pasa el decimal del backend a es-AR, sin ceros de más', () => {
  assert.equal(aTextoArgentino('1234.50'), '1.234,5')
  assert.equal(aTextoArgentino('313.5600'), '313,56')
  assert.equal(aTextoArgentino('0.0050'), '0,005')
  assert.equal(aTextoArgentino('12.00'), '12')
  assert.equal(aTextoArgentino('17781987.60'), '17.781.987,6')
  assert.equal(aTextoArgentino(null), '')
  // Ida y vuelta: lo que muestra se vuelve a leer igual.
  assert.equal(leerNumero(aTextoArgentino('1234567.8912')), '1234567.8912')
})

const TAREAS = new Map([
  [7, { tarea_id: 7, nombre: 'PODA', unidad_sugerida: 'plantas', no_facturable: false }],
  [8, { tarea_id: 8, nombre: 'RASTRA', unidad_sugerida: 'horas_tractor', no_facturable: false }],
])

const DETALLE = {
  id: 5, tipo: 'nota_credito', cliente_id: 12, empresa_emisora: 'LA ASTURIANA SA',
  numero: '0001-00000042', fecha: '2026-10-05', factura_corregida: { id: 3, numero: '9', fecha: null },
  actualizado_en: '2026-10-06T10:00:00',
  lineas: [
    // Fuera de orden: el formulario las acomoda por `orden`.
    { id: 2, orden: 2, fecha: '2026-09-16', tarea_id: 8, tarea_nombre: 'RASTRA', unidad: 'hectareas',
      finca_id: null, finca_nombre: null, cantidad: '2.00', precio_unitario: '100.0000', importe: '200.00' },
    { id: 1, orden: 1, fecha: '2026-09-16', tarea_id: 7, tarea_nombre: 'PODA', unidad: 'plantas',
      finca_id: 4, finca_nombre: 'LOTE 4', cantidad: '1234.50', precio_unitario: '98.1234', importe: '121133.34' },
    // Una tarea que ya no está entre las activas.
    { id: 3, orden: 3, fecha: '2026-09-01', tarea_id: 99, tarea_nombre: 'VIEJA', unidad: 'plantas',
      finca_id: null, finca_nombre: null, cantidad: '1.00', precio_unitario: '1.0000', importe: '1.00' },
  ],
}

test('estadoDesdeDetalle arma la cabecera y las filas en orden, con los números en es-AR', () => {
  const { cabecera, filas } = estadoDesdeDetalle(DETALLE, TAREAS)
  assert.deepEqual(cabecera, {
    tipo: 'nota_credito', cliente_id: 12, empresa_emisora: 'LA ASTURIANA SA',
    numero: '0001-00000042', fecha: '2026-10-05', factura_corregida_id: 3,
  })
  assert.deepEqual(filas.map(f => f.tarea_id), [7, 8, 99])
  assert.equal(filas[0].cantidad, '1.234,5')
  assert.equal(filas[0].precio_unitario, '98,1234')
  assert.equal(filas[0].finca_id, 4)
  assert.equal(filas[0].finca_nombre, 'LOTE 4')
})

test('estadoDesdeDetalle toma la unidad como tocada sólo si no es la sugerida de su tarea', () => {
  const { filas } = estadoDesdeDetalle(DETALLE, TAREAS)
  // PODA guardada en plantas, su sugerida: cambiar la tarea vuelve a precargar.
  assert.equal(filas[0].unidadTocada, false)
  // RASTRA guardada en hectáreas, no en su sugerida: alguien la eligió a mano.
  assert.equal(filas[1].unidadTocada, true)
  // Una tarea que ya no está entre las activas: se respeta lo guardado.
  assert.equal(filas[2].unidadTocada, true)
})

test('estadoNuevo arranca como Factura, sin cabecera y con una fila vacía', () => {
  const { cabecera, filas } = estadoNuevo()
  assert.equal(cabecera.tipo, 'factura')
  assert.equal(cabecera.cliente_id, null)
  assert.equal(filas.length, 1)
  assert.ok(filaEstaVacia(filas[0]))
})

test('cada fila nueva tiene su propia clave', () => {
  assert.notEqual(filaVacia().clave, filaVacia().clave)
})

test('una fila con sólo la fecha, la unidad o la finca cuenta como vacía', () => {
  assert.ok(filaEstaVacia({ ...filaVacia('2026-09-16'), unidad: 'plantas', finca_id: 4 }))
  assert.ok(!filaEstaVacia({ ...filaVacia(), cantidad: '3' }))
  assert.ok(!filaEstaVacia({ ...filaVacia(), tarea_id: 7 }))
})

const CABECERA = {
  tipo: 'factura', cliente_id: 12, empresa_emisora: 'LA ASTURIANA SA',
  numero: '0001-1', fecha: '2026-10-05', factura_corregida_id: null,
}
const FILA_BIEN = {
  ...filaVacia('2026-09-16'), tarea_id: 7, tarea_nombre: 'PODA', unidad: 'plantas',
  cantidad: '1.234,5', precio_unitario: '98,1234',
}

test('validarFormulario marca cada campo de la cabecera que falta', () => {
  const { cabecera } = validarFormulario(
    { tipo: 'nota_credito', cliente_id: null, empresa_emisora: ' ', numero: '  ', fecha: '', factura_corregida_id: null },
    [FILA_BIEN],
  )
  assert.deepEqual(Object.keys(cabecera).sort(),
    ['cliente_id', 'empresa_emisora', 'factura_corregida_id', 'fecha', 'numero'])
})

test('validarFormulario controla el número como el backend', () => {
  const conBarra = validarFormulario({ ...CABECERA, numero: 'A|B' }, [FILA_BIEN])
  assert.ok(conBarra.cabecera.numero)
  const largo = validarFormulario({ ...CABECERA, numero: '1'.repeat(31) }, [FILA_BIEN])
  assert.ok(largo.cabecera.numero)
  // Los espacios de más no cuentan para el largo: el backend los colapsa.
  const espacios = validarFormulario({ ...CABECERA, numero: ` ${'1'.repeat(15)}    ${'2'.repeat(14)} ` }, [FILA_BIEN])
  assert.equal(espacios.cabecera.numero, undefined)
})

test('validarFormulario ignora las filas vacías y pide al menos una Línea', () => {
  const sinLineas = validarFormulario(CABECERA, [filaVacia('2026-09-16')])
  assert.ok(sinLineas.general)
  assert.ok(sinLineas.hayErrores)

  const bien = validarFormulario(CABECERA, [FILA_BIEN, filaVacia('2026-09-16')])
  assert.equal(bien.general, null)
  assert.deepEqual(bien.filas, {})
  assert.equal(bien.hayErrores, false)
})

test('validarFormulario marca la fila por su clave, con las claves de validarLinea', () => {
  const mala = { ...FILA_BIEN, cantidad: '0' }
  const { filas, hayErrores } = validarFormulario(CABECERA, [FILA_BIEN, mala])
  assert.ok(hayErrores)
  assert.deepEqual(Object.keys(filas), [mala.clave])
  assert.ok(filas[mala.clave].cantidad)
})

test('armarEntrada manda sólo las filas con datos, con los números con punto decimal', () => {
  const vacia = filaVacia('2026-09-16')
  const { entrada, claves } = armarEntrada(
    { ...CABECERA, numero: '  0001-1 ', empresa_emisora: ' LA ASTURIANA SA ', factura_corregida_id: 3 },
    [FILA_BIEN, vacia], '2026-10-06T10:00:00',
  )
  assert.deepEqual(claves, [FILA_BIEN.clave])
  assert.deepEqual(entrada, {
    tipo: 'factura', cliente_id: 12, empresa_emisora: 'LA ASTURIANA SA', numero: '0001-1',
    fecha: '2026-10-05',
    // Una Factura no lleva Factura corregida aunque haya quedado elegida.
    factura_corregida_id: null,
    actualizado_en: '2026-10-06T10:00:00',
    lineas: [{
      fecha: '2026-09-16', tarea_id: 7, unidad: 'plantas', finca_id: null,
      cantidad: '1234.5', precio_unitario: '98.1234',
    }],
  })
})

test('armarEntrada conserva la Factura corregida en una Nota de crédito', () => {
  const { entrada } = armarEntrada(
    { ...CABECERA, tipo: 'nota_credito', factura_corregida_id: 3 }, [FILA_BIEN], null)
  assert.equal(entrada.factura_corregida_id, 3)
  assert.equal(entrada.actualizado_en, null)
})

function errorApi(status, detail) {
  const e = new Error(typeof detail === 'string' ? detail : detail?.mensaje ?? 'x')
  e.status = status
  e.detail = detail
  return e
}

test('errorDeGuardado lleva la fila de linea_invalida a la clave de la fila enviada', () => {
  const claves = ['a', 'c']
  assert.deepEqual(
    errorDeGuardado(errorApi(422, { tipo: 'linea_invalida', mensaje: 'Esa finca no es del Cliente.', fila: 2, campo: 'finca_id' }), claves),
    { tipo: 'linea', clave: 'c', campo: 'finca_id', mensaje: 'Esa finca no es del Cliente.' },
  )
})

test('errorDeGuardado avisa con el número de fila si la fila no es una de las enviadas', () => {
  assert.deepEqual(
    errorDeGuardado(errorApi(422, { tipo: 'linea_invalida', mensaje: 'Falta.', fila: 3, campo: 'fecha' }), ['a']),
    { tipo: 'aviso', mensaje: 'Línea 3: Falta.' },
  )
})

test('errorDeGuardado separa la cabecera, los repetidos, el conflicto y el resto', () => {
  assert.deepEqual(
    errorDeGuardado(errorApi(422, { tipo: 'comprobante_invalido', mensaje: 'Falta.', campo: 'numero' }), []),
    { tipo: 'cabecera', campo: 'numero', mensaje: 'Falta.' },
  )
  for (const tipo of ['comprobante_repetido', 'historico_mismo_numero']) {
    assert.deepEqual(
      errorDeGuardado(errorApi(409, { tipo, mensaje: 'Ya existe.', comprobante_id: 8 }), []),
      { tipo: 'repetido', comprobanteId: 8, mensaje: 'Ya existe.' },
    )
  }
  assert.equal(
    errorDeGuardado(errorApi(409, { tipo: 'comprobante_modificado', mensaje: 'Cambió.' }), []).tipo,
    'modificado',
  )
  assert.deepEqual(
    errorDeGuardado(errorApi(409, { tipo: 'factura_con_notas', mensaje: 'Tiene notas.' }), []),
    { tipo: 'aviso', mensaje: 'Tiene notas.' },
  )
  assert.equal(errorDeGuardado(errorApi(404, 'Comprobante no encontrado'), []).tipo, 'no_existe')
  assert.deepEqual(
    errorDeGuardado(errorApi(503, 'El sistema de campo no responde'), []),
    { tipo: 'aviso', mensaje: 'El sistema de campo no responde' },
  )
})

const LISTA = [
  { tarea_id: 1, nombre: 'HORAS TRACTOR RASTRA', grupo_tarea: 'MAQUINARIA' },
  { tarea_id: 2, nombre: 'PODA DE FORMACIÓN', grupo_tarea: 'MANUALES' },
  { tarea_id: 3, nombre: 'RASTRA', grupo_tarea: 'MAQUINARIA' },
]

test('filtrarTareas busca sin acentos ni mayúsculas, por todas las palabras', () => {
  assert.deepEqual(filtrarTareas(LISTA, 'formacion').map(t => t.tarea_id), [2])
  assert.deepEqual(filtrarTareas(LISTA, 'tract ras').map(t => t.tarea_id), [1])
  assert.deepEqual(filtrarTareas(LISTA, '').map(t => t.tarea_id), [1, 2, 3])
})

test('filtrarTareas pone primero las que empiezan con lo tipeado', () => {
  assert.deepEqual(filtrarTareas(LISTA, 'rastra').map(t => t.tarea_id), [3, 1])
})

test('textoFecha da vuelta la fecha sin pasar por Date', () => {
  assert.equal(textoFecha('2026-10-05'), '05/10/2026')
  assert.equal(textoFecha(null), null)
})

// ─── Quitar y deshacer (revisión de FT-A, RA1) ───

const conDatos = (tarea_id) => ({ ...filaVacia('2026-09-16'), tarea_id, cantidad: '1', precio_unitario: '2' })
const tareasDe = filas => filas.map(f => f.tarea_id)

test('quitar la fila del índice i y restaurarla la deja en el índice i con los mismos datos', () => {
  const filas = [conDatos(1), conDatos(2), conDatos(3), conDatos(4)]
  for (const i of [0, 1, 3]) {
    const { filas: restantes, quitada } = quitarFila(filas, filas[i].clave)
    assert.equal(restantes.length, 3)
    assert.ok(!restantes.some(f => f.clave === filas[i].clave))
    assert.equal(quitada.indice, i)
    const vuelta = restaurarFila(restantes, quitada)
    assert.deepEqual(vuelta, filas)
    assert.equal(vuelta[i], filas[i])
  }
})

test('quitar una clave que no está no cambia nada', () => {
  const filas = [conDatos(1)]
  const { filas: restantes, quitada } = quitarFila(filas, 'no-esta')
  assert.equal(restantes, filas)
  assert.equal(quitada, null)
})

test('restaurar una fila que ya está no la duplica', () => {
  const filas = [conDatos(1), conDatos(2)]
  const { filas: restantes, quitada } = quitarFila(filas, filas[1].clave)
  const vuelta = restaurarFila(restaurarFila(restantes, quitada), quitada)
  assert.deepEqual(tareasDe(vuelta), [1, 2])
})

// La pila de quitadas, como la arma la pantalla: cada quitar suma una entrada.
function quitarVarias(filas, claves) {
  let pila = []
  for (const clave of claves) {
    const r = quitarFila(filas, clave)
    filas = r.filas
    pila = [...pila, r.quitada]
  }
  return { filas, pila }
}

test('dos quitadas seguidas: deshacer la primera devuelve las dos, en su orden', () => {
  const filas = [conDatos(1), conDatos(2), conDatos(3), conDatos(4)]
  // Enter en Quitar de la línea 2 y otro Enter en el de la que quedó en su lugar.
  const { filas: restantes, pila } = quitarVarias(filas, [filas[1].clave, filas[2].clave])
  assert.deepEqual(tareasDe(restantes), [1, 4])

  const { pila: resto, restauradas } = sacarDeLaPila(pila, filas[1].clave)
  assert.deepEqual(resto, [])
  assert.deepEqual(restauradas.reduce(restaurarFila, restantes), filas)
})

test('dos quitadas seguidas: deshacer la última y después la primera vuelve al orden de antes', () => {
  const filas = [conDatos(1), conDatos(2), conDatos(3), conDatos(4)]
  const { filas: restantes, pila } = quitarVarias(filas, [filas[3].clave, filas[0].clave])
  assert.deepEqual(tareasDe(restantes), [2, 3])

  const ultima = sacarDeLaPila(pila, filas[0].clave)
  const medio = ultima.restauradas.reduce(restaurarFila, restantes)
  assert.deepEqual(tareasDe(medio), [1, 2, 3])
  assert.equal(ultima.pila.length, 1)

  const primera = sacarDeLaPila(ultima.pila, filas[3].clave)
  assert.deepEqual(primera.restauradas.reduce(restaurarFila, medio), filas)
  assert.deepEqual(primera.pila, [])
})

test('un Deshacer que ya se usó no hace nada', () => {
  const filas = [conDatos(1), conDatos(2)]
  const { pila } = quitarVarias(filas, [filas[0].clave])
  const usado = sacarDeLaPila(pila, filas[0].clave)
  const otraVez = sacarDeLaPila(usado.pila, filas[0].clave)
  assert.deepEqual(otraVez.restauradas, [])
  assert.deepEqual(otraVez.pila, [])
})

test('una fila vacía quitada en el medio no corre el lugar de la que se deshace', () => {
  const vacia = filaVacia('2026-09-16')
  const filas = [vacia, conDatos(1), conDatos(2), conDatos(3)]
  // Se quita la línea 3 con datos y después la vacía de arriba (sin aviso).
  const { filas: restantes, pila } = quitarVarias(filas, [filas[2].clave, vacia.clave])
  assert.deepEqual(tareasDe(restantes), [1, 3])

  const { restauradas } = sacarDeLaPila(pila, filas[2].clave)
  assert.deepEqual(restauradas.reduce(restaurarFila, restantes), filas)
})

test('una línea agregada al final después de quitar no cambia dónde vuelve la quitada', () => {
  const filas = [conDatos(1), conDatos(2), conDatos(3)]
  const { filas: restantes, pila } = quitarVarias(filas, [filas[1].clave])
  const nueva = filaVacia('2026-09-16')
  const { restauradas } = sacarDeLaPila(pila, filas[1].clave)
  const vuelta = restauradas.reduce(restaurarFila, [...restantes, nueva])
  assert.deepEqual(vuelta, [...filas, nueva])
})
