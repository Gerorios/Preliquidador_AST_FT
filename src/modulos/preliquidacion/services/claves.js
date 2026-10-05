// Claves de React Query que comparten varias pantallas del módulo.
// Viven en un solo lugar para que una invalidación en una pantalla alcance
// al caché que lee otra: con claves escritas a mano en cada archivo, Revisión
// y Verificación terminaban con cachés distintas para las mismas líneas.
// Sólo están las compartidas; las claves internas de una sola pantalla
// (Gerencial, Conceptos) quedan donde están.

export const claves = {
  preliquidaciones: ['preliquidaciones'],
  // Number(id): Revisión recibe el id como string (useParams) y Verificación
  // lo toma del <select>. Sin normalizar, ['lineas', '12'] y ['lineas', 12]
  // son dos cachés distintas y la invalidación de una no llega a la otra.
  lineas: (id) => ['lineas', Number(id)],
  stats: (id) => ['stats', Number(id)],
  // Prefijos para invalidar las líneas y estadísticas de todas las quincenas
  // (p. ej. tras cambiar un precio, que recalcula más de una).
  todasLasLineas: ['lineas'],
  todasLasStats: ['stats'],
  // Combo de códigos para agregar concepto (panel de línea y liquidación
  // masiva). Lleva la quincena: el backend devuelve los códigos de esa.
  conceptosCombo: (quincena) => ['conceptos-combo', quincena ?? null],
}
