// Íconos vectoriales del sistema (etapa 0, PR 4). Reemplazan los emojis de
// rutas.jsx y del menú por SVG consistentes con el resto de la UI. Un nombre
// desconocido cae en 'modulos' y avisa por consola solo en desarrollo.
import styles from './Icono.module.css'

const PATHS = {
  preliquidacion: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  gerencial: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  terceros: <><path d="M2 7h12v9H2zM14 10h5l3 3v3h-8z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  administracion: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M18 8v6M15 11h6" /></>,
  inicio: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  usuarios: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16.5 4.8a3.5 3.5 0 0 1 0 6.4" /><path d="M18.5 20a6.5 6.5 0 0 0-3-5.4" /></>,
  copiar: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  conceptos: <><path d="M12 2v20" /><path d="M17 6.5c0-2-2.2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3" /></>,
  verificacion: <path d="M20 6 9 17l-5-5" />,
  mantenimiento: <path d="M14.5 5.5a4 4 0 0 0 4 4l2-2a5.5 5.5 0 0 1-7.5 7.5L6 22l-3-3 7-7a5.5 5.5 0 0 1 7.5-7.5z" />,
  modulos: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  atras: <path d="M19 12H5M11 18l-6-6 6-6" />,
  salir: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  chat: <path d="M21 12a8 8 0 0 1-8 8H8l-5 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />,
  cerrar: <path d="M18 6 6 18M6 6l12 12" />,
  llave: <><circle cx="8" cy="16" r="4" /><path d="M10.8 13.2 20 4M16.5 7.5l2.5 2.5M14.5 9.5l2.5 2.5" /></>,
  filtro: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  buscar: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  abajo: <path d="m6 9 6 6 6-6" />,
  arriba: <path d="m6 15 6-6 6 6" />,
  derecha: <path d="m9 6 6 6-6 6" />,
  tilde: <path d="m5 12 5 5 9-10" />,
  intercambiar: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  descargar: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  grilla: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  generar: <path d="M7 5v14l11-7z" />,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  gota: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  planta: <><path d="M12 21v-9" /><path d="M12 12c0-4 3-7 7-7 0 4-3 7-7 7z" /><path d="M12 15c0-3-2.5-5.5-6-5.5 0 3 2.5 5.5 6 5.5z" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  alerta: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
}

// `enTexto`: el ícono va dentro de un texto o un botón y se alinea con la línea
// de base del texto. Es un CSS Module del núcleo para no sumar CSS global.
export default function Icono({ nombre, size = 18, className, enTexto = false }) {
  let clave = nombre
  if (!PATHS[clave]) {
    if (import.meta.env.DEV) console.warn(`Icono desconocido: "${nombre}", se usa "modulos"`)
    clave = 'modulos'
  }
  const clases = [enTexto && styles.enTexto, className].filter(Boolean).join(' ') || undefined
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={clases}
      aria-hidden="true"
    >
      {PATHS[clave]}
    </svg>
  )
}
