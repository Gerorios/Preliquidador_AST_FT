// Tests de lo que muestra Revisión según los permisos de la persona (ADR-0020,
// FT2 paso 4.2). node --test, sin dependencias.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { accionesRevision, avisoIncompletas } from './revisionSoloLectura.js'

const ADMIN = { rol: 'admin', permisos: {} }
const conPermisos = (preliquidacion) => ({ rol: 'usuario', permisos: { preliquidacion } })

test('con Editar Revisión hay liquidación masiva y el panel de línea se edita', () => {
  const a = accionesRevision(conPermisos({ inicio: 'ver', revision: 'editar' }))
  assert.deepEqual(a, { liquidacionMasiva: true, panelSoloLectura: false })
})

test('con sólo Ver Revisión no hay liquidación masiva, el panel es de lectura', () => {
  const a = accionesRevision(conPermisos({ inicio: 'ver', revision: 'ver' }))
  assert.deepEqual(a, { liquidacionMasiva: false, panelSoloLectura: true })
})

test('el admin edita Revisión', () => {
  assert.deepEqual(accionesRevision(ADMIN), { liquidacionMasiva: true, panelSoloLectura: false })
})

test('Editar en otra pantalla no da Editar Revisión', () => {
  const a = accionesRevision(conPermisos({ revision: 'ver', conceptos: 'editar' }))
  assert.equal(a.liquidacionMasiva, false)
  assert.equal(a.panelSoloLectura, true)
})

test('incompletas, con Editar Conceptos: dice qué falta, dónde cargarlo y ofrece ir', () => {
  assert.deepEqual(avisoIncompletas(3, conPermisos({ revision: 'ver', conceptos: 'editar' })), {
    titulo: '3 líneas incompletas',
    detalle: 'falta el código o el precio. Cargá lo que falta en Conceptos.',
    irAConceptos: true,
  })
})

test('incompletas, con sólo Ver Conceptos: no le pide cargar, pero puede ir a mirar', () => {
  assert.deepEqual(avisoIncompletas(3, conPermisos({ revision: 'editar', conceptos: 'ver' })), {
    titulo: '3 líneas incompletas',
    detalle: 'falta el código o el precio en Conceptos.',
    irAConceptos: true,
  })
})

test('incompletas, sin Conceptos: no nombra la pantalla ni ofrece ir', () => {
  const aviso = avisoIncompletas(3, conPermisos({ revision: 'editar' }))
  assert.deepEqual(aviso, {
    titulo: '3 líneas incompletas',
    detalle: 'falta el código o el precio.',
    irAConceptos: false,
  })
  assert.doesNotMatch(aviso.detalle, /Conceptos|maestro|liquidador/)
})

test('una sola incompleta va en singular', () => {
  assert.equal(avisoIncompletas(1, ADMIN).titulo, '1 línea incompleta')
})

test('el admin recibe el aviso completo', () => {
  assert.deepEqual(avisoIncompletas(2, ADMIN), {
    titulo: '2 líneas incompletas',
    detalle: 'falta el código o el precio. Cargá lo que falta en Conceptos.',
    irAConceptos: true,
  })
})
