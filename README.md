# Sistema de gestión La Asturiana — Frontend

SPA en **React 18 + Vite 5** para los distintos módulos de gestión de La Asturiana SRL. **Preliquidación** (generar, revisar, verificar y exportar la preliquidación de sueldos por quincena) es el primer módulo. Consume la API del backend FastAPI (`backend_preliquidacion` / `Gerorios/Preliquidador_AST_BK`).

> **Máquina nueva o módulo nuevo**: la puesta a punto de ambos proyectos y la guía para incorporar módulos (Liquidación Terceros es el primero) viven en el repo backend, en `docs/modulos/PUESTA-A-PUNTO.md` y `docs/modulos/GUIA-MODULOS.md`.

---

## Stack tecnológico

| Componente | Tecnología |
|---|---|
| UI | React 18.3 (JSX, sin TypeScript) |
| Build / dev server | Vite 5 + @vitejs/plugin-react |
| Enrutado | react-router-dom 6 (rutas lazy + Suspense) |
| Estado de servidor | TanStack React Query 5 (caché, invalidación, refetch) |
| Estado global | Zustand 4 con `persist` (solo autenticación) |
| HTTP | Axios (interceptores de token y 401) |
| Notificaciones | react-hot-toast |
| Fechas | date-fns (locale `es`) |
| Estilos | CSS Modules + design tokens en `index.css` (paleta terracota/oliva del logo, contraste WCAG AA) — fuentes IBM Plex Sans / Mono |

---

## Estructura

```
src/
├── main.jsx                 # Entrada; providers (React Query, Router, Toaster)
├── App.jsx                  # Compone las rutas de cada módulo + redirecciones
├── index.css                # Estilos globales + design tokens
├── assets/                  # Logos La Asturiana
├── core/                    # NÚCLEO COMPARTIDO (ADR-0013)
│   ├── api.js               # Axios: baseURL /api, Bearer automático, logout en 401
│   ├── authStore.js         # Sesión (Zustand + persist, clave "auth-asturiana")
│   ├── layout/              # Layout (sidebar, compone el menú de cada módulo), BarraSuperior (topbar de las pantallas sin sidebar), ProtectedRoute
│   ├── ui/                  # CargandoContenido, CargandoOverlay, iconos.jsx (íconos SVG del sistema)
│   ├── inicio/              # Inicio.jsx: pantalla de tarjetas tras el login (una por módulo + Gerencial)
│   ├── administracion/      # Administración de usuarios del Sistema (alta desde el padrón, lista con reseteo/baja/edición de accesos)
│   ├── registroContext.js   # Contexto que expone el registro de módulos al núcleo (inyectado por App.jsx)
│   ├── asistente/           # AsistenteChat + asistenteApi (ayuda de uso, transversal)
│   └── pages/               # Login.jsx, CambiarPassword.jsx (cambio voluntario de la propia contraseña)
└── modulos/
    ├── registro.js          # Registro de módulos: alta con una línea, arma tarjetas del Inicio y pantallas del asistente
    ├── preliquidacion/      # MÓDULO Preliquidación de sueldos
    │   ├── rutas.jsx        # rutas, menú, redirecciones y descriptor `modulo` (lo único que el núcleo conoce)
    │   ├── pages/           # Dashboard, Revision, Verificacion, Conceptos, CategoriasOperarios, Gerencial, PanelPorConcepto
    │   ├── components/      # PanelLinea, FiltrosBar, AlertasBanner, ControlesJornal, InputBusqueda
    │   └── services/        # preliquidacion.js, gerencial.js
    └── terceros/            # Molde de módulo (PR 4, etapa 0): inactivo, no se monta ni aparece en el Inicio
```

---

## Pantallas

| Ruta | Vista | Quién | Qué hace |
|---|---|---|---|
| `/login` | Login | Todos | Identificador + contraseña (OAuth2 password → JWT). El identificador es el email para quien lo tiene, o el **CUIL** (con o sin guiones) para quien no |
| `/` | Inicio | Todos | Tarjetas: una por módulo al que la persona accede, más **Gerencial** (tarjeta del sistema, no de un módulo) |
| `/administracion` | Administración | Solo **admin** | Alta de usuarios desde el padrón de empleados, accesos y roles por módulo, reseteo de contraseña y baja/reactivación. La identidad de cada persona es su CUIL: es también su usuario y su contraseña inicial |
| `/cambiar-password` | Cambiar mi contraseña | Todos | Cambio voluntario de la propia contraseña (pide la actual). No bloquea nada: quien sigue con la inicial (el CUIL) puede seguir trabajando |
| `/preliquidacion/dashboard` | Inicio (Preliquidación) | operador, admin | Elegir quincena, **Generar/Actualizar** preliquidación, historial con alertas |
| `/preliquidacion/revision/:id` | Revisión | operador, admin | Tabla completa de líneas con filtrado 100 % en cliente (búsqueda con debounce + multi-select en cascada por cliente/finca/tarea/empresa/grupo/supervisor + filtros de alerta). Panel lateral de edición por línea. Modo **liquidación masiva** (conceptos masivos, reasignación de empresa por CUIL). **Exportar Excel** |
| `/preliquidacion/verificacion` | Verificación | operador, admin | Controles de auditoría: horas > 13/día, tancadas > 35/día, plantas > 6.000/día, resumen por empleado ($/día), Plantas vs Jornal y Tancadas vs Jornal (del backend), carga del valor hora de pulverización |
| `/preliquidacion/conceptos` | Conceptos | operador, gerente, admin | Maestro de reglas/precios por quincena en 4 pestañas: **Sin concepto** (faltantes), **Comunes**, **Específicos** (con "reemplaza al común"), **Panel de precios** (edición inline + precio masivo, con vistas "Por regla" y "Por concepto" (`PanelPorConcepto`)). Copiar conceptos de otra quincena. Cada cambio invalida líneas y stats (impacto reactivo) |
| `/preliquidacion/categorias-operarios` | Mantenimiento | operador, admin | Asignar categoría 1-7 por operario de taller y heredar de la quincena anterior |
| `/gerencial` | Gerencial | gerente, admin | Vista gerencial: indicadores de mano de obra, evolución, por cliente y grupo de tareas, desvíos, controles de pago. Transversal al sistema: queda sin prefijo, se llega por su propia tarjeta en el Inicio (no es un módulo). El operador no la ve |

Las direcciones sin prefijo (`/dashboard`, `/conceptos`, …) redirigen a las nuevas.

Además, un **asistente de ayuda** (chat flotante, presente en todo el layout) responde dudas de uso enviando la pantalla actual como contexto; no accede a datos reales.

---

## Inicio y módulos

Después de loguearse, la persona cae en `/` (`src/core/inicio/Inicio.jsx`): una pantalla de tarjetas, sin sidebar, con una tarjeta por cada módulo al que tiene acceso más, si corresponde, la tarjeta **Gerencial**. Cada tarjeta lleva a la "home" de ese módulo para el rol de la persona. El registro de módulos (`src/modulos/registro.js`) arma esa lista a partir de los descriptores `modulo` que exporta cada `rutas.jsx`.

Qué tarjetas ve cada rol (con Preliquidación como único módulo activo hoy):

| Rol | Tarjetas en el Inicio |
|---|---|
| admin | Preliquidación + Gerencial |
| Preliquidador (operador de Preliquidación) | Preliquidación (lleva a `/preliquidacion/dashboard`) |
| Gerente | Preliquidación (lleva a `/preliquidacion/conceptos`, no al dashboard del operador) + Gerencial |

**Gerencial** no es un módulo: es una tarjeta del sistema. Aparece cuando la persona tiene rol `gerente` (o es admin) en algún módulo que declara vista gerencial, y lleva a `/gerencial` (transversal, sin prefijo de módulo).

## Cómo agregar un módulo

1. Crear `src/modulos/<modulo>/rutas.jsx` que exporte el descriptor `modulo` (ver `src/modulos/preliquidacion/rutas.jsx` como referencia completa). Sus campos:
   - `clave`, `nombre`, `descripcion(usuario)`, `icono` (nombre de `src/core/ui/iconos.jsx`)
   - `activo` (boolean): si es `false`, el módulo no se monta en `App.jsx` ni aparece en el Inicio (así vive el molde `terceros` hoy)
   - `prefijo`, `rutas`, `nav` (menú del módulo, derivado de `rutas` para que no puedan divergir), `redirecciones`
   - `etiquetasRol`: mapa de rol interno del módulo (p. ej. `operador`, `gerente`) a la etiqueta visible (p. ej. `Preliquidador`)
   - `rolesTarjeta`: roles del módulo que ven su tarjeta en el Inicio
   - `home(usuario)`: ruta a la que lleva la tarjeta, según el rol de la persona en el módulo
   - `pantallas`: mapa ruta → nombre, para que el asistente de ayuda reconozca las pantallas del módulo
   - `gerencial`: `{ ruta, roles }` si el módulo tiene vista gerencial, o `null`
2. Agregar una línea en `src/modulos/registro.js`: importar el `modulo` y sumarlo al arreglo `TODOS`.
3. Poner `activo: true` en el descriptor cuando el módulo tenga su primera pantalla real, para que se monte y aparezca en el Inicio.

## Íconos

Los íconos SVG del sistema viven en `src/core/ui/iconos.jsx` (`<Icono nombre="..." />`), un mapa de nombre a trazo `<path>`/`<svg>` interno; ya no hay emojis en menú ni tarjetas. Para agregar uno: sumar la clave y su trazo al objeto `PATHS` del archivo. Un nombre no registrado cae en el ícono `modulos` y avisa por consola solo en desarrollo.

---

## Autenticación

- Token JWT guardado en localStorage (`auth-asturiana`) vía Zustand `persist`.
- `ProtectedRoute` redirige a `/login` sin token; con la prop `soloAdmin` (usada en `/administracion`) exige además el rol global `admin`, sin necesidad de declarar un módulo.
- Interceptor Axios inyecta `Authorization: Bearer` y ante un 401 hace logout + redirect.
- El login devuelve `usuario.password_inicial` (booleano, calculado en el backend contra el hash guardado): es `true` mientras la persona siga entrando con el CUIL sin cambiarlo. El Inicio muestra un aviso no bloqueante mientras sea `true`, con un enlace a `/cambiar-password`; al cambiarla, el propio front actualiza el store (`login(token, { ...usuario, password_inicial: false })`) para que el aviso baje sin recargar. No hay recuperación de contraseña por mail (el sistema no manda correo): si alguien la olvida, un admin se la resetea desde Administración.
- El usuario tiene un **rol global** (`admin` o `usuario`) y, además, un **rol por módulo** en `usuario.modulos` (p. ej. `{ preliquidacion: 'operador' }` u `'gerente'`). El admin ve todo; dentro de un módulo, `operador` y `gerente` ven pantallas distintas (ver tabla de Pantallas). `tienePermiso(usuario, modulo, roles)` en `src/core/permisos.js` decide el acceso; `ProtectedRoute` la usa para las rutas y `Layout` para filtrar el menú. La autorización real se aplica en el backend, el frontend solo evita mostrar lo que el backend igual rechazaría.
- La sesión guardada en localStorage está versionada (`version: 2`): al desplegar este cambio, las sesiones anteriores (sin `modulos`) se descartan automáticamente y el usuario tiene que volver a loguearse.
- La home después de loguear depende del módulo: un operador cae en `/preliquidacion/dashboard`, un gerente puro en `/gerencial` (ver `home()` en `rutas.jsx` y `HOMES` en `App.jsx`).

---

## Instalación y ejecución

Requiere Node.js 18+ y el backend corriendo en `http://localhost:8000`.

```bash
npm install
npm run dev       # servidor de desarrollo en http://localhost:5173
npm run build     # bundle de producción a dist/
npm run preview   # sirve el build generado
```

En desarrollo, Vite proxya `/api` → `http://localhost:8000` (ver `vite.config.js`), por lo que no hay problemas de CORS ni variables de entorno que configurar.

En producción, `dist/` se sirve con nginx, que también proxya `/api/` al backend (ver `docs/DEPLOY.md` del backend).

Para desarrollar contra la base de prueba `testing` y no contra producción, ver `docs/modulos/PUESTA-A-PUNTO.md` del repo backend.

---

## Detalles de implementación destacables

- **Filtros en cascada O(n)** (`FiltrosBar.jsx`): las opciones de cada filtro se recalculan según los demás filtros activos en una sola pasada.
- **Actualización optimista** al agregar conceptos por código (`PanelLinea.jsx`), reconciliada con el refetch.
- **Sincronización de caché**: las mutaciones que devuelven la línea recalculada la escriben puntualmente en el caché de React Query; el resto dispara refetch + resync del panel abierto.
- **Overlay global de bloqueo** (`CargandoOverlay.jsx`) con `useIsMutating()` para evitar dobles envíos.
- **Exportación Excel**: descarga como blob con parseo del nombre desde `Content-Disposition` (`filename*=UTF-8''`).
- **Timeout Axios de 5 min** por las generaciones de quincena pesadas.
