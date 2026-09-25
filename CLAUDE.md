@AGENTS.md

## Específico de Claude Code

Las reglas del proyecto están en `AGENTS.md`, que vale para cualquier agente. Acá va sólo
lo que existe en Claude Code.

- **Bitácora**: el agente `bitacora` y `/bitacora` viven en el repo del backend y se corren
  desde allá. Desde acá sólo se pregunta. Dos respaldos recuerdan preguntar después de un
  merge: un hook PostToolUse sobre `gh pr merge` y el `post-merge` de git.
- **Memoria de Claude**: guarda el estado entre sesiones y se actualiza en cada hito. Vive
  fuera del repo, en la máquina de quien la usa, y no la ve nadie más: lo que importe a una
  persona va a su archivo de la tabla "Dónde se anota cada cosa", y la memoria sólo apunta
  a ese archivo.
- **Lo de cada máquina** (rutas, herramientas fuera del PATH) va en `CLAUDE.local.md`, que
  no se commitea.
