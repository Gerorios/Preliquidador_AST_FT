// Lo que muestra Conceptos según si la persona puede editarla o sólo verla
// (ADR-0020). `editable` sale de puedeEditar(usuario, 'preliquidacion',
// 'conceptos'); con sólo Ver no hay altas, ediciones, borrados, precio masivo
// ni copia, y los textos no nombran botones que no están.

// La columna 'chk' sólo sirve para elegir las filas del precio masivo.
export const columnasDelPanel = (columnas, editable) =>
  editable ? columnas : columnas.filter(c => c.key !== 'chk')

export const textoSinConceptos = (nombreScope, editable) => {
  const base = `No hay conceptos ${nombreScope} para esta quincena.`
  return editable ? `${base} Usá "+ Nuevo" para agregar.` : base
}

// Conteo de la barra del panel por regla. Las destildadas sólo existen con
// Editar (la selección es del precio masivo).
export const conteoPanel = ({ filtradas, seleccionadas, total, editable }) => {
  const destildadas = filtradas - seleccionadas
  if (editable && destildadas > 0) return `${destildadas} destildada(s) conservan su precio`
  return `${filtradas} de ${total} conceptos`
}
