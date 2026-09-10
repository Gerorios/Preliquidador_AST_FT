import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useParams, generatePath, useLocation } from 'react-router-dom'
import Layout from './core/layout/Layout'
import ProtectedRoute from './core/layout/ProtectedRoute'
import CargandoContenido from './core/ui/CargandoContenido'
import Inicio from './core/inicio/Inicio'
import { RegistroContext } from './core/registroContext'
import { MODULOS, tarjetasPara, pantallasAsistente, resolverPantalla } from './modulos/registro'

const Login = lazy(() => import('./core/pages/Login'))
const Administracion = lazy(() => import('./core/administracion/Administracion'))
const CambiarPassword = lazy(() => import('./core/pages/CambiarPassword'))

// App es el único punto que conoce el registro de módulos: se lo inyecta al
// núcleo por contexto para que la carpeta core no importe los módulos.
// `moduloDeRuta` y `etiquetaRol` quedan exportadas en registro.js pero fuera
// del contexto: hoy nadie en el núcleo las consume (la persona ya no ve su
// propio rol; `etiquetaRol` sigue viva para cuando haga falta volver a
// mostrarlo).
const REGISTRO = { MODULOS, tarjetasPara, pantallasAsistente, resolverPantalla }

// Redirección que conserva los parámetros de la URL (p. ej. /revision/12 → /preliquidacion/revision/12)
// y también query string y hash.
function Redireccion({ to }) {
  const params = useParams()
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: generatePath(to, params), search, hash }} replace />
}

export default function App() {
  return (
    <RegistroContext.Provider value={REGISTRO}>
      <Suspense fallback={<CargandoContenido texto="Cargando…" />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Inicio: grilla de módulos, sin menú lateral. */}
          <Route path="/" element={<ProtectedRoute><Inicio /></ProtectedRoute>} />

          {/* Pantallas del Sistema, sin menú lateral (como el Inicio). */}
          <Route path="/administracion" element={
            <ProtectedRoute soloAdmin><Administracion /></ProtectedRoute>} />
          <Route path="/cambiar-password" element={
            <ProtectedRoute><CambiarPassword /></ProtectedRoute>} />

          {/* Direcciones anteriores al prefijo por módulo: al nivel de Routes, fuera
              del marco, para que redirijan sin montar el Layout (evita el parpadeo
              del menú). El ProtectedRoute solo exige sesión: quien entra sin token
              a /dashboard va a /login, y el permiso lo revisa la ruta destino. */}
          {MODULOS.flatMap(m => m.redirecciones).map(({ from, to }) => (
            <Route key={from} path={from} element={<ProtectedRoute><Redireccion to={to} /></ProtectedRoute>} />
          ))}

          {/* Un marco por módulo activo: su menú y su nombre en la marca. */}
          {MODULOS.map(m => (
            <Route key={m.clave} element={<ProtectedRoute><Layout modulo={m} /></ProtectedRoute>}>
              {m.rutas.filter(r => r.path !== m.gerencial?.ruta).map(({ path, element, modulo, roles }) => (
                <Route key={path} path={path} element={<ProtectedRoute modulo={modulo} roles={roles}>{element}</ProtectedRoute>} />
              ))}
            </Route>
          ))}

          {/* Marco transversal de Gerencial: una entrada por módulo con panel gerencial. */}
          <Route element={<ProtectedRoute><Layout marco="gerencial" /></ProtectedRoute>}>
            {MODULOS.filter(m => m.gerencial).map(m => {
              const r = m.rutas.find(x => x.path === m.gerencial.ruta)
              return <Route key={r.path} path={r.path} element={<ProtectedRoute modulo={m.clave} roles={m.gerencial.roles}>{r.element}</ProtectedRoute>} />
            })}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RegistroContext.Provider>
  )
}
