// Qué muestra Revisión según los permisos de la persona (ADR-0020). Con sólo
// Ver Revisión no hay liquidación masiva y el panel de la línea es de lectura;
// exportar el Excel es una lectura y queda siempre. El backend protege las
// escrituras con Editar Revisión: esto sólo evita mostrar botones que darían 403.

import { puedeEditar, puedeVer } from '../../../core/permisos.js'

const MODULO = 'preliquidacion'

export function accionesRevision(usuario) {
  const editable = puedeEditar(usuario, MODULO, 'revision')
  return { liquidacionMasiva: editable, panelSoloLectura: !editable, exportar: true }
}

// Banner de líneas incompletas. No nombra un rol ni manda a Conceptos a quien
// no puede abrirla: el texto depende de lo que la persona puede hacer ahí.
export function avisoIncompletas(cantidad, usuario) {
  const titulo = cantidad === 1 ? '1 línea incompleta' : `${cantidad} líneas incompletas`
  const veConceptos = puedeVer(usuario, MODULO, 'conceptos')
  let detalle = 'falta el código o el precio.'
  if (puedeEditar(usuario, MODULO, 'conceptos')) {
    detalle = 'falta el código o el precio. Cargalos en Conceptos.'
  } else if (veConceptos) {
    detalle = 'falta el código o el precio en Conceptos.'
  }
  return { titulo, detalle, irAConceptos: veConceptos }
}
