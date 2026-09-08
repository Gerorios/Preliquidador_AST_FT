# Sistema de Preliquidación — Frontend — La Asturiana SRL

SPA en **React 18 + Vite 5** para generar, revisar, verificar y exportar la preliquidación de sueldos por quincena. Consume la API del backend FastAPI (`backend_preliquidacion` / `Gerorios/Preliquidador_AST_BK`).

> **Máquina nueva o módulo nuevo**: la puesta a punto de ambos proyectos y la guía para incorporar módulos (Fletes es el primero) viven en el repo backend, en `docs/modulos/PUESTA-A-PUNTO.md` y `docs/modulos/GUIA-MODULOS.md`.

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
│   ├── layout/              # Layout (sidebar, compone el menú de cada módulo), ProtectedRoute
│   ├── ui/                  # CargandoContenido, CargandoOverlay
│   ├── asistente/           # AsistenteChat + asistenteApi (ayuda de uso, transversal)
│   └── pages/Login.jsx
└── modulos/
    └── preliquidacion/      # MÓDULO Preliquidación de sueldos
        ├── rutas.jsx        # rutas, menú y redirecciones del módulo (lo único que el núcleo conoce)
        ├── pages/           # Dashboard, Revision, Verificacion, Conceptos, CategoriasOperarios, Gerencial, PanelPorConcepto
        ├── components/      # PanelLinea, FiltrosBar, AlertasBanner, ControlesJornal, InputBusqueda
        └── services/        # preliquidacion.js, gerencial.js
```

---

## Pantallas

| Ruta | Vista | Qué hace |
|---|---|---|
| `/login` | Login | Email + contraseña (OAuth2 password → JWT) |
| `/preliquidacion/dashboard` | Inicio | Elegir quincena, **Generar/Actualizar** preliquidación, historial con alertas |
| `/preliquidacion/revision/:id` | Revisión | Tabla completa de líneas con filtrado 100 % en cliente (búsqueda con debounce + multi-select en cascada por cliente/finca/tarea/empresa/grupo/supervisor + filtros de alerta). Panel lateral de edición por línea. Modo **liquidación masiva** (conceptos masivos, reasignación de empresa por CUIL). **Exportar Excel** |
| `/preliquidacion/verificacion` | Verificación | Controles de auditoría: horas > 13/día, tancadas > 35/día, plantas > 6.000/día, resumen por empleado ($/día), Plantas vs Jornal y Tancadas vs Jornal (del backend), carga del valor hora de pulverización |
| `/preliquidacion/conceptos` | Conceptos | Maestro de reglas/precios por quincena en 4 pestañas: **Sin concepto** (faltantes), **Comunes**, **Específicos** (con "reemplaza al común"), **Panel de precios** (edición inline + precio masivo, con vistas "Por regla" y "Por concepto" (`PanelPorConcepto`)). Copiar conceptos de otra quincena. Cada cambio invalida líneas y stats (impacto reactivo) |
| `/preliquidacion/categorias-operarios` | Mantenimiento | Asignar categoría 1-7 por operario de taller y heredar de la quincena anterior |
| `/gerencial` | Gerencial | Vista gerencial: indicadores de mano de obra, evolución, por cliente y grupo de tareas, desvíos, controles de pago. Transversal al sistema: queda sin prefijo |

Las direcciones sin prefijo (`/dashboard`, `/conceptos`, …) redirigen a las nuevas.

Además, un **asistente de ayuda** (chat flotante, presente en todo el layout) responde dudas de uso enviando la pantalla actual como contexto; no accede a datos reales.

---

## Autenticación

- Token JWT guardado en localStorage (`auth-asturiana`) vía Zustand `persist`.
- `ProtectedRoute` redirige a `/login` sin token.
- Interceptor Axios inyecta `Authorization: Bearer` y ante un 401 hace logout + redirect.
- El rol del usuario se muestra en el sidebar; la autorización por rol se aplica en el backend.

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
