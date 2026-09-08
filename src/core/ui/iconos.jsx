// Íconos vectoriales del sistema (etapa 0, PR 4). Reemplazan los emojis de
// rutas.jsx y del menú por SVG consistentes con el resto de la UI. Un nombre
// desconocido cae en 'modulos' y avisa por consola solo en desarrollo.
const PATHS = {
  preliquidacion: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  gerencial: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  fletes: <><path d="M2 7h12v9H2zM14 10h5l3 3v3h-8z" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></>,
  administracion: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M18 8v6M15 11h6" /></>,
  inicio: <><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /></>,
  conceptos: <><path d="M12 2v20" /><path d="M17 6.5c0-2-2.2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3" /></>,
  verificacion: <path d="M20 6 9 17l-5-5" />,
  mantenimiento: <path d="M14.5 5.5a4 4 0 0 0 4 4l2-2a5.5 5.5 0 0 1-7.5 7.5L6 22l-3-3 7-7a5.5 5.5 0 0 1 7.5-7.5z" />,
  modulos: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  flecha: <path d="M5 12h14M13 6l6 6-6 6" />,
  atras: <path d="M19 12H5M11 18l-6-6 6-6" />,
  salir: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  chat: <path d="M21 12a8 8 0 0 1-8 8H8l-5 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />,
  cerrar: <path d="M18 6 6 18M6 6l12 12" />,
}

export default function Icono({ nombre, size = 18, className }) {
  let clave = nombre
  if (!PATHS[clave]) {
    if (import.meta.env.DEV) console.warn(`Icono desconocido: "${nombre}", se usa "modulos"`)
    clave = 'modulos'
  }
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
      className={className}
      aria-hidden="true"
    >
      {PATHS[clave]}
    </svg>
  )
}
