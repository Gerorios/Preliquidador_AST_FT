import { useQuery } from '@tanstack/react-query'
import BarraSuperior from '../layout/BarraSuperior'
import CargandoContenido from '../ui/CargandoContenido'
import { modulosDelSistema } from './adminApi'
import ListaUsuarios from './ListaUsuarios'
import AltaDesdePadron from './AltaDesdePadron'
import styles from './Administracion.module.css'

// Administración de usuarios del Sistema (etapa 0, PR 5). Reemplaza correr
// scripts por SSH: da de alta gente del padrón de empleados, le asigna módulo
// y rol, desactiva a quien se va y resetea contraseñas.
//
// Los dos bloques comparten la lista de módulos activos, que se pide una sola
// vez acá: de ella salen las columnas de accesos y todos los selectores de rol,
// con las etiquetas que declara cada módulo ("Preliquidador", no "operador").
export default function Administracion() {
  const { data: modulos = [], isLoading, isError, error } = useQuery({
    queryKey: ['modulos-sistema'],
    queryFn: modulosDelSistema,
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className={styles.page}>
      <BarraSuperior volverA="/" titulo="Administración" />

      <main className={styles.cuerpo}>
        {isLoading ? (
          <CargandoContenido texto="Cargando módulos del sistema…" />
        ) : isError ? (
          <div className={styles.error}>
            No se pudieron cargar los módulos del sistema: {error.message}
          </div>
        ) : (
          <>
            <ListaUsuarios modulos={modulos} />
            <AltaDesdePadron modulos={modulos} />
          </>
        )}
      </main>
    </div>
  )
}
