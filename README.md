# Sistema de gestión La Asturiana — Frontend

SPA de uso interno del Sistema de gestión La Asturiana SRL, organizada por módulos
(ADR-0013). El primer módulo es **Preliquidación** de sueldos por quincena. Consume la API
del backend (`Gerorios/Preliquidador_AST_BK`).

> **Máquina nueva o módulo nuevo**: la puesta a punto de los dos proyectos y la guía para
> construir módulos viven en el repo del backend, en `docs/modulos/PUESTA-A-PUNTO.md` y
> `docs/modulos/GUIA-MODULOS.md`.

---

## Stack

| Componente | Tecnología |
|---|---|
| UI | React 18 (JSX, sin TypeScript) |
| Build / dev server | Vite 5 |
| Enrutado | react-router-dom 6 (rutas lazy) |
| Estado de servidor | TanStack React Query 5 |
| Estado global | Zustand (sesión) |
| HTTP | Axios |
| Notificaciones | react-hot-toast |
| Estilos | CSS Modules + design tokens en `index.css` |

---

## Estructura

```
src/
├── main.jsx          # entrada y providers
├── App.jsx           # compone las rutas de cada módulo
├── index.css         # estilos globales + design tokens
├── core/             # núcleo compartido: api, sesión, layout, Inicio, administración, UI
└── modulos/
    ├── registro.js   # registro de módulos
    ├── preliquidacion/  # módulo Preliquidación: rutas.jsx, pages/, components/, services/
    └── terceros/        # módulo Liquidación Terceros (en construcción, inactivo)
```

Cada módulo exporta desde su `rutas.jsx` un descriptor `modulo` (rutas, menú, tarjeta del
Inicio). Para sumar uno: crear su `rutas.jsx` tomando `preliquidacion/rutas.jsx` como
referencia, agregarlo en `src/modulos/registro.js` y marcarlo `activo: true` cuando tenga su
primera pantalla real. El detalle, en la guía de módulos del backend.

La autorización real vive en el backend; el front sólo evita mostrar lo que el backend
rechazaría igual.

---

## Puesta en marcha

Requiere Node.js 18+ y el backend corriendo en `http://localhost:8000`.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # bundle de producción a dist/
```

En desarrollo, Vite proxya `/api` al backend local (`vite.config.js`), así que no hay
variables de entorno que configurar.
