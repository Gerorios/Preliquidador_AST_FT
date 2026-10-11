// Tests de la lógica pura del editor de roles de Administración (ADR-0020;
// node --test, sin dependencias propias). El catálogo copia la forma de
// `GET /api/auth/modulos` (sólo módulos activos, cada uno con sus pantallas) y
// los roles la de `GET /api/admin/roles`.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SIN_ACCESO, motivoParaNoBorrar, motivoParaNoGuardar, nivelesDe, permisosIguales, quedaSinAcceso,
  textoConfirmacion,
} from './roles.js'

const CATALOGO = [
  {
    clave: 'preliquidacion',
    nombre: 'Preliquidación',
    pantallas: [
      { clave: 'inicio', nombre: 'Inicio', editable: true, requiere: [] },
      { clave: 'revision', nombre: 'Revisión', editable: true, requiere: ['inicio'] },
      { clave: 'verificacion', nombre: 'Verificación', editable: true, requiere: [] },
      { clave: 'mantenimiento', nombre: 'Mantenimiento', editable: true, requiere: [] },
      { clave: 'conceptos', nombre: 'Conceptos', editable: true, requiere: [] },
      { clave: 'gerencial', nombre: 'Vista gerencial', editable: false, requiere: [] },
    ],
  },
  {
    clave: 'terceros',
    nombre: 'Liquidación Terceros',
    pantallas: [
      { clave: 'inicio', nombre: 'Inicio', editable: true, requiere: [] },
      { clave: 'quincena', nombre: 'Quincena', editable: true, requiere: [] },
      { clave: 'verificaciones', nombre: 'Verificaciones', editable: false, requiere: [] },
    ],
  },
]

const EXISTENTES = [
  { id: 1, nombre: 'Preliquidador', permisos: { preliquidacion: { inicio: 'editar' } }, personas: [] },
  { id: 2, nombre: 'Gerente', permisos: { preliquidacion: { gerencial: 'ver' } }, personas: [] },
]

const rol = (cambios = {}) => ({
  nombre: 'Consulta',
  permisos: { preliquidacion: { conceptos: 'ver' } },
  ...cambios,
})

const guardar = (r, existentes = EXISTENTES) => motivoParaNoGuardar(r, CATALOGO, existentes)

// --- nivelesDe ---

test('nivelesDe: una pantalla editable tiene Sin acceso, Ver y Editar', () => {
  assert.deepEqual(nivelesDe({ clave: 'inicio', editable: true }), [SIN_ACCESO, 'ver', 'editar'])
})

test('nivelesDe: una pantalla de sólo Ver no ofrece Editar', () => {
  assert.deepEqual(nivelesDe({ clave: 'gerencial', editable: false }), [SIN_ACCESO, 'ver'])
})

test('nivelesDe: "sin acceso" no es un nivel que se guarde', () => {
  assert.equal(SIN_ACCESO, 'sin')
})

// --- permisosIguales ---

test('permisosIguales: mismos niveles, en otro orden, son iguales', () => {
  assert.equal(permisosIguales(
    { preliquidacion: { inicio: 'editar', conceptos: 'ver' }, terceros: { quincena: 'ver' } },
    { terceros: { quincena: 'ver' }, preliquidacion: { conceptos: 'ver', inicio: 'editar' } },
  ), true)
})

test('permisosIguales: un nivel distinto o una pantalla de más los hace distintos', () => {
  assert.equal(permisosIguales({ preliquidacion: { inicio: 'ver' } }, { preliquidacion: { inicio: 'editar' } }), false)
  assert.equal(permisosIguales(
    { preliquidacion: { inicio: 'ver' } },
    { preliquidacion: { inicio: 'ver', conceptos: 'ver' } },
  ), false)
})

test('permisosIguales: las pantallas en "sin acceso" y los módulos vacíos no cuentan', () => {
  assert.equal(permisosIguales(
    { preliquidacion: { inicio: 'ver', conceptos: SIN_ACCESO }, terceros: {} },
    { preliquidacion: { inicio: 'ver' } },
  ), true)
  assert.equal(permisosIguales({ preliquidacion: { inicio: null } }, {}), true)
  assert.equal(permisosIguales(undefined, null), true)
  assert.equal(permisosIguales({}, { terceros: { quincena: SIN_ACCESO } }), true)
})

// --- motivoParaNoGuardar ---

test('un rol válido se puede guardar', () => {
  assert.equal(guardar(rol()), null)
  assert.equal(guardar(rol({ permisos: {
    preliquidacion: { inicio: 'editar', revision: 'editar', gerencial: 'ver' },
    terceros: { quincena: 'ver', verificaciones: 'ver' },
  } })), null)
})

test('el nombre se recorta y no puede quedar vacío', () => {
  assert.equal(guardar(rol({ nombre: '' })), 'El rol necesita un nombre.')
  assert.equal(guardar(rol({ nombre: '   ' })), 'El rol necesita un nombre.')
  assert.equal(guardar(rol({ nombre: undefined })), 'El rol necesita un nombre.')
  assert.equal(guardar(rol({ nombre: '  Consulta  ' })), null)
})

test('el nombre tiene hasta 60 caracteres, contados sin los espacios de los bordes', () => {
  assert.equal(guardar(rol({ nombre: 'a'.repeat(60) })), null)
  assert.equal(guardar(rol({ nombre: `  ${'a'.repeat(60)}  ` })), null)
  assert.equal(guardar(rol({ nombre: 'a'.repeat(61) })), 'El nombre puede tener hasta 60 caracteres.')
  // Cuenta caracteres, no unidades de UTF-16 (como `len` en Python).
  assert.equal(guardar(rol({ nombre: 'ñ'.repeat(60) })), null)
})

test('el nombre no puede repetir el de otro rol, sin distinguir mayúsculas ni acentos', () => {
  const esperado = 'Ya hay un rol que se llama "Gerente".'
  assert.equal(guardar(rol({ nombre: 'Gerente' })), esperado)
  assert.equal(guardar(rol({ nombre: '  gerente ' })), esperado)
  assert.equal(guardar(rol({ nombre: 'GERÉNTE' })), esperado)
  const conAcento = [{ id: 7, nombre: 'Revisión', permisos: {}, personas: [] }]
  assert.equal(guardar(rol({ nombre: 'revision' }), conAcento), 'Ya hay un rol que se llama "Revisión".')
})

test('al editar un rol, su propio nombre no cuenta como repetido', () => {
  assert.equal(guardar(rol({ id: 2, nombre: 'gerente' })), null)
  assert.equal(guardar(rol({ id: 1, nombre: 'Gerente' })), 'Ya hay un rol que se llama "Gerente".')
})

test('sin roles existentes no hay nombre repetido', () => {
  assert.equal(motivoParaNoGuardar(rol(), CATALOGO), null)
  assert.equal(motivoParaNoGuardar(rol(), CATALOGO, null), null)
})

test('el rol tiene que dar acceso al menos a una pantalla', () => {
  const esperado = 'El rol tiene que dar acceso al menos a una pantalla.'
  assert.equal(guardar(rol({ permisos: {} })), esperado)
  assert.equal(guardar(rol({ permisos: undefined })), esperado)
  assert.equal(guardar(rol({ permisos: { preliquidacion: { inicio: SIN_ACCESO }, terceros: {} } })), esperado)
})

test('un módulo que no está en el catálogo (inexistente o inactivo) no se puede guardar', () => {
  assert.equal(
    guardar(rol({ permisos: { facturacion: { inicio: 'ver' } } })),
    'El módulo "facturacion" no existe o no está activo.',
  )
})

test('una pantalla que el módulo no declara no se puede guardar', () => {
  assert.equal(
    guardar(rol({ permisos: { preliquidacion: { tarifario: 'ver' } } })),
    'Preliquidación no tiene la pantalla "tarifario".',
  )
})

test('un nivel que no es Ver ni Editar no se puede guardar', () => {
  assert.equal(
    guardar(rol({ permisos: { preliquidacion: { conceptos: 'operador' } } })),
    'Conceptos tiene un nivel desconocido: "operador".',
  )
})

test('Editar sólo en pantallas editables', () => {
  assert.equal(
    guardar(rol({ permisos: { preliquidacion: { gerencial: 'editar' } } })),
    'Vista gerencial sólo admite Ver.',
  )
  assert.equal(
    guardar(rol({ permisos: { terceros: { verificaciones: 'editar' } } })),
    'Verificaciones sólo admite Ver.',
  )
})

test('regla requiere: Revisión necesita al menos Ver en Inicio', () => {
  const esperado = 'Revisión necesita al menos Ver en Inicio.'
  assert.equal(guardar(rol({ permisos: { preliquidacion: { revision: 'editar' } } })), esperado)
  assert.equal(guardar(rol({ permisos: { preliquidacion: { revision: 'ver', inicio: SIN_ACCESO } } })), esperado)
  assert.equal(guardar(rol({ permisos: { preliquidacion: { revision: 'editar', inicio: 'ver' } } })), null)
  assert.equal(guardar(rol({ permisos: { preliquidacion: { revision: 'ver', inicio: 'editar' } } })), null)
  // Inicio sin Revisión está bien: la regla va en un solo sentido.
  assert.equal(guardar(rol({ permisos: { preliquidacion: { inicio: 'ver' } } })), null)
})

test('regla requiere: es genérica y nombra todas las pantallas que faltan', () => {
  const catalogo = [{
    clave: 'facturacion',
    nombre: 'Facturación',
    pantallas: [
      { clave: 'inicio', nombre: 'Inicio', editable: true, requiere: [] },
      { clave: 'clientes', nombre: 'Clientes', editable: true, requiere: [] },
      { clave: 'facturas', nombre: 'Facturas', editable: true, requiere: ['inicio', 'clientes'] },
    ],
  }]
  assert.equal(
    motivoParaNoGuardar(rol({ permisos: { facturacion: { facturas: 'ver' } } }), catalogo, []),
    'Facturas necesita al menos Ver en Inicio y Clientes.',
  )
  assert.equal(
    motivoParaNoGuardar(rol({ permisos: { facturacion: { facturas: 'ver', clientes: 'ver' } } }), catalogo, []),
    'Facturas necesita al menos Ver en Inicio.',
  )
})

test('una pantalla sin `requiere` declarado no exige nada', () => {
  const catalogo = [{ clave: 'x', nombre: 'X', pantallas: [{ clave: 'a', nombre: 'A', editable: true }] }]
  assert.equal(motivoParaNoGuardar(rol({ permisos: { x: { a: 'editar' } } }), catalogo, []), null)
})

// --- textoConfirmacion ---

test('textoConfirmacion: varias personas, con "y" antes de la última', () => {
  assert.equal(
    textoConfirmacion([{ id: 1, nombre: 'Ana', activo: true }, { id: 2, nombre: 'Beto', activo: true }]),
    'Este cambio vale para 2 personas: Ana y Beto.',
  )
  assert.equal(
    textoConfirmacion([
      { id: 1, nombre: 'Ana', activo: true },
      { id: 2, nombre: 'Beto', activo: true },
      { id: 3, nombre: 'Carla', activo: true },
    ]),
    'Este cambio vale para 3 personas: Ana, Beto y Carla.',
  )
})

test('textoConfirmacion: una sola persona va en singular', () => {
  assert.equal(textoConfirmacion([{ id: 1, nombre: 'Ana', activo: true }]), 'Este cambio vale para 1 persona: Ana.')
})

test('textoConfirmacion: las personas inactivas cuentan y van marcadas', () => {
  assert.equal(
    textoConfirmacion([{ id: 1, nombre: 'Ana', activo: true }, { id: 2, nombre: 'Beto', activo: false }]),
    'Este cambio vale para 2 personas: Ana y Beto (inactiva).',
  )
})

test('textoConfirmacion: sin personas no hay nada que confirmar', () => {
  assert.equal(textoConfirmacion([]), null)
  assert.equal(textoConfirmacion(undefined), null)
})

// --- motivoParaNoBorrar ---

test('motivoParaNoBorrar: un rol que nadie tiene se puede borrar', () => {
  assert.equal(motivoParaNoBorrar({ id: 1, nombre: 'X', personas: [] }), null)
  assert.equal(motivoParaNoBorrar({ id: 1, nombre: 'X' }), null)
})

test('motivoParaNoBorrar: si alguien lo tiene, dice quiénes', () => {
  assert.equal(
    motivoParaNoBorrar({ id: 1, nombre: 'X', personas: [{ id: 1, nombre: 'Ana', activo: true }, { id: 2, nombre: 'Beto', activo: true }] }),
    'Lo tienen 2 personas: Ana y Beto. Sacáselo primero para poder borrarlo.',
  )
  assert.equal(
    motivoParaNoBorrar({ id: 1, nombre: 'X', personas: [{ id: 1, nombre: 'Ana', activo: true }] }),
    'Lo tiene 1 persona: Ana. Sacáselo primero para poder borrarlo.',
  )
})

test('motivoParaNoBorrar: una persona inactiva también lo bloquea', () => {
  assert.equal(
    motivoParaNoBorrar({ id: 1, nombre: 'X', personas: [{ id: 2, nombre: 'Beto', activo: false }] }),
    'Lo tiene 1 persona: Beto (inactiva). Sacáselo primero para poder borrarlo.',
  )
})

// --- quedaSinAcceso ---

test('quedaSinAcceso: un usuario no admin sin ningún rol queda sin acceso', () => {
  assert.equal(quedaSinAcceso({ id: 5, rol: 'usuario' }, []), true)
  assert.equal(quedaSinAcceso({ id: 5, rol: 'usuario' }, undefined), true)
})

test('quedaSinAcceso: con algún rol no queda sin acceso', () => {
  assert.equal(quedaSinAcceso({ id: 5, rol: 'usuario' }, [3]), false)
  assert.equal(quedaSinAcceso({ id: 5, rol: 'usuario' }, [{ id: 3, nombre: 'Gerente' }]), false)
})

test('quedaSinAcceso: el admin nunca queda sin acceso, aunque no tenga roles', () => {
  assert.equal(quedaSinAcceso({ id: 1, rol: 'admin' }, []), false)
})
