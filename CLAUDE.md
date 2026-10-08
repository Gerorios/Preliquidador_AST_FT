@AGENTS.md

## Estado del trabajo (se carga en cada sesión)

@../backend_preliquidacion/docs/estado.md

El estado vive en el repo del backend. En un worktree este import no resuelve: la ruta real
la imprime el hook de arranque. Cómo se mantiene: `AGENTS.md`, "Estado del trabajo".

## Específico de Claude Code

Las reglas del proyecto están en `AGENTS.md`, que vale para cualquier agente. Acá va sólo
lo que existe en Claude Code.

- **Flujo**: la skill `flujo-preliquidacion`, la versión de este sistema de la skill global
  `flujo`, que se usa en lugar de la global (no las dos), vive en el repo del backend:
  `backend_preliquidacion/.claude/skills/flujo-preliquidacion/SKILL.md`. Una sesión abierta
  desde la carpeta de los dos repos la ve; una abierta sólo en este repo no: leer ese
  archivo y seguirlo en lugar de la global.
- **Interfaz**: la skill `impeccable` (`.claude/skills/impeccable/`, de pbakaus/impeccable,
  Apache-2.0, copiada tal cual con sus 4 agentes `impeccable-*` y sin sus hooks) es la que
  se usa en todo cambio visual o feature nueva (`AGENTS.md`, "Cambios de interfaz"). Su
  lanzador baja el motor la primera vez a `.impeccable/`, ignorado por git. Para
  actualizarla, se reemplaza la carpeta entera por la de un commit nuevo del original, en
  un PR.
- **Bitácora**: el agente `bitacora` y `/bitacora` viven en el repo del backend y se corren
  desde allá; el agente también actualiza `docs/estado.md` del backend, y los dos se
  commitean juntos a `main` del backend. Desde acá sólo se pregunta. Dos respaldos
  recuerdan preguntar después de un merge: un hook PostToolUse sobre `gh pr merge` y el
  `post-merge` de git.
- **Memoria de Claude**: no guarda el estado de las tareas, que vive en `docs/estado.md` del
  backend. Queda para las preferencias del usuario y las trampas de las herramientas. Vive
  fuera del repo, en la máquina de quien la usa, y no la ve nadie más: lo que importe a una
  persona va a su archivo de la tabla "Dónde se anota cada cosa", y la memoria sólo apunta
  a ese archivo.
- **Lo de cada máquina** (rutas, herramientas fuera del PATH) va en `CLAUDE.local.md`, que
  no se commitea.
