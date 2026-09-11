# Sistema de gestión La Asturiana — frontend

React + Vite. Núcleo compartido (`src/core/`) + módulos autocontenidos
(`src/modulos/<m>/`), espejo de la estructura del backend. Módulos:
**Preliquidación** (activo, en producción) y **Liquidación Terceros** (molde, inactivo).

**El backend es otro repo**: `backend_preliquidacion` (FastAPI). Casi todo cambio de módulo
necesita PRs hermanos en los dos.

## Antes de proponer una decisión de diseño

**Buscá en `docs/BITACORA.md` del repo del backend.** El diario es uno solo para los dos
repos y vive allá. Ahí está el *por qué* de lo ya decidido, incluido lo que se evaluó y se
descartó. No se carga sola: hay que abrirla.

Sirve para no volver a proponer algo ya rechazado. Ejemplo real: la invitación por email
está descartada (mucha gente no tiene mail propio) y el sistema no manda correo — eso no se
deduce de ningún diff.

Si la decisión que buscás no está ahí, no asumas que no se tomó: preguntá.

## Después de cada merge a `main`, preguntar por la bitácora

Apenas se mergea un PR, **preguntarle al usuario si corro `/bitacora`**. Una línea, no un
párrafo: "quedó sin anotar el PR #N, ¿lo anoto?". Si dice que no, seguir sin insistir — no
se pierde nada, la próxima corrida lo cubre igual.

Porqué: el hook `post-merge` sólo avisa cuando la máquina del usuario actualiza `main`, y ese
aviso se pierde fácil entre la salida de otros comandos. La pregunta es el respaldo.

El agente `bitacora` vive en el repo del backend y escribe allá. Desde acá sólo se avisa y
se pregunta. Nunca correrlo sin preguntar: escribe en `main` directo.

## Reglas de trabajo (el usuario las pidió explícitamente)

- **Rama antes de editar.** Nunca commitear directo a `main`.
- **NUNCA deployar al VPS sin OK explícito del usuario.** El sistema está en producción en
  https://preliquidacion.laasturianasrl.com.ar y lo usan personas reales. Mergear a `main`
  no es deployar. El deploy del front es **swap de carpeta** (`frontend_new` → `frontend`,
  `frontend_old` queda como rollback).
- **Smoke tests reales** en el navegador, no "debería andar". Si algo no se probó, decilo.
- **Implementar y después verificar de forma adversarial**: buscá activamente el error propio.

Caso real de por qué importa: el login quedó con `type="email"` y el navegador rechazaba un
CUIL de 11 dígitos antes de enviarlo. El backend lo soportaba con 7 tests verdes y la
funcionalidad central igual no se podía usar. Los tests del back no ven esto.

## Reglas de arquitectura (ADR-0013, el ADR vive en el backend)

- Un módulo **nunca importa** a otro módulo. Lo compartido sube a `src/core/`.
- El núcleo **no importa** módulos.
- Lo que usa un solo módulo vive en ese módulo; el núcleo crece sólo cuando dos lo necesitan.
- Las rutas de un módulo van con su prefijo (`/preliquidacion/...`); `/gerencial` va sin.
- Un módulo **inactivo** no monta rutas ni muestra su Tarjeta en el Inicio.

## Comandos

```bash
npm run dev                       # desarrollo
npm run build                     # bundle de producción
sh scripts/hooks/instalar.sh      # hooks de git, uno por clon
```

`gh` **no está en el PATH**: invocarlo como `"/c/Program Files/GitHub CLI/gh.exe"`, y los
cuerpos de PR siempre con `--body-file` (nunca `--body` inline).

`main` exige una aprobación y no se puede auto-aprobar: el merge va con `--admin`.

## Al escribir un PR

El cuerpo del PR es la **única fuente** del *por qué* que la bitácora puede archivar. Dos o
tres líneas de "esto se decidió así porque, y se descartó aquello" alcanzan. Lo que no quede
escrito ahí se pierde, y en la próxima sesión alguien lo va a volver a proponer.

## Idioma

Español, con acentos correctos. Términos técnicos e identificadores en su forma original.
Textos públicos sin emojis.
