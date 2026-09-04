// Constantes compartidas entre Conceptos.jsx y PanelPorConcepto.jsx. Separadas
// en su propio módulo para evitar el import circular entre ambos componentes.

export const UNIDADES = [
  { value: 'hsjornal',     label: 'Hs. Jornal' },
  { value: 'hsmaquina',    label: 'Hs. Máquina' },
  { value: 'tancadas',     label: 'Tancadas' },
  { value: 'unidades',     label: 'Unidades' },
  { value: 'jornal_tope1', label: '1 Jornal' },
  { value: 'jornal_tope1_mas_excedente', label: '1 Jornal + Excedente (>10 hs paga hs/10)' },
  { value: 'fijo',         label: '1 Jornal Fijo' },
]

export const TIPOS = [
  { value: 'REMUNERATIVO',    label: 'Remunerativo' },
  { value: 'NO_REMUNERATIVO', label: 'No remunerativo' },
  { value: 'JORNAL',          label: 'Jornal' },
  { value: 'BONO_BOLSON',     label: 'Bono bolsón' },
  { value: 'EXCENTO',         label: 'Excento' },
  { value: 'OTRO',            label: 'Otro' },
]

export const CATEGORIAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
