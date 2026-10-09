import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import BarraSuperior from '../layout/BarraSuperior'
import CargandoOverlay from '../ui/CargandoOverlay'
import { modulosDelSistema } from './adminApi'
import ListaUsuarios from './ListaUsuarios'
import AltaDesdePadron from './AltaDesdePadron'
import ListaRoles from './ListaRoles'
import styles from './Administracion.module.css'

const SOLAPAS = [
  { clave: 'usuarios', etiqueta: 'Usuarios' },
  { clave: 'roles', etiqueta: 'Roles' },
]

// Administración del Sistema (ADR-0020). Dos solapas:
// - Usuarios: la lista de personas con su tipo de usuario y sus roles, y el
//   alta desde el padrón de empleados.
// - Roles: los roles que arma el admin, con Ver o Editar por pantalla.
//
// Las dos solapas quedan montadas y la que no se ve sólo se oculta: así un rol
// a medio editar no se pierde por ir a Usuarios y volver.
//
// El catálogo (módulos activos y sus pantallas) se pide acá y lo usa el editor
// de roles: la Administración no lee el registro del front.
//
// Toda escritura (guardar roles, crear usuarios, activar, resetear) muestra el
// overlay "Procesando...": lo dispara cualquier mutación en curso.
export default function Administracion() {
  const [solapa, setSolapa] = useState('usuarios')
  const catalogo = useQuery({
    queryKey: ['modulos-sistema'],
    queryFn: modulosDelSistema,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className={styles.page}>
      <BarraSuperior volverA="/" titulo="Administración" mostrarCambioPassword />
      <CargandoOverlay />

      <main className={styles.cuerpo}>
        <div className={styles.solapas} role="tablist" aria-label="Administración">
          {SOLAPAS.map(s => (
            <button
              key={s.clave}
              type="button"
              role="tab"
              id={`solapa-${s.clave}`}
              aria-selected={solapa === s.clave}
              aria-controls={`panel-${s.clave}`}
              className={`chip ${styles.solapa} ${solapa === s.clave ? 'chip-active' : ''}`}
              onClick={() => setSolapa(s.clave)}
            >
              {s.etiqueta}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id="panel-usuarios"
          aria-labelledby="solapa-usuarios"
          className={styles.panel}
          hidden={solapa !== 'usuarios'}
        >
          <ListaUsuarios />
          <AltaDesdePadron />
        </div>

        <div
          role="tabpanel"
          id="panel-roles"
          aria-labelledby="solapa-roles"
          className={styles.panel}
          hidden={solapa !== 'roles'}
        >
          <ListaRoles catalogo={catalogo} />
        </div>
      </main>
    </div>
  )
}
