// La sesión al día (ADR-0020). El login deja en `authStore` una foto del
// usuario; `usePermisosAlDia` la refresca con `GET /auth/me` para que un cambio
// de roles en Administración se vea sin volver a entrar. Puro, para testearlo
// con `npm test`.

/**
 * Usuario nuevo de la sesión: todo lo de `/auth/me` (id, nombre, email, rol y
 * permisos) más `password_inicial` del guardado, que viene sólo en el login.
 * No arrastra otros campos del guardado: lo que /auth/me ya no devuelve sale.
 */
export function fusionarSesion(guardado, me) {
  const nuevo = { ...me }
  if (guardado && 'password_inicial' in guardado) {
    nuevo.password_inicial = guardado.password_inicial
  }
  return nuevo
}
