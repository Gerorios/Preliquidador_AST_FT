import styles from './Inicio.module.css'

export default function Inicio() {
  return (
    <div className={styles.page}>
      <h1 className={styles.titulo}>Fletes: módulo en construcción</h1>
      <p className={styles.texto}>
        Las consultas y pantallas de Fletes llegan por etapas; por ahora esta es la única pantalla del módulo.
      </p>
    </div>
  )
}
