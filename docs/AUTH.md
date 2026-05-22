# Auth y RBAC

## Login

- Ruta UI: `/sign-in`.
- Método: email + contraseña Supabase.
- Rate-limit app: 5 fallos por IP+email cada 15 min antes de llamar a Supabase Auth.
- Errores genéricos: no se diferencia cuenta inexistente, password erróneo o email sin confirmar.
- Sin registro público visible.
- Reset: enlace "¿Olvidaste tu contraseña?".
- Sesión: cookies `sb-*-auth-token`, TTL app 7 días. Cookie Supabase browser no puede ser `HttpOnly` sin cambiar a auth server-side completa.

## Roles

| Rol | Permisos |
|---|---|
| `super_admin` | Todo |
| `delegado_jueces` | Todo operativo nacional |
| `delegado_zona` | Crear/editar jueces, informes y tarimas de su zona |
| `solo_ver` | Lectura |

## Guards

| Guard | Uso |
|---|---|
| `requireApiUser` | Toda API privada |
| `canEditRoster` | Campeonatos/tarima |
| `canApprove` | Aprobaciones |
| `canManageUsers` | Usuarios |
| `canManageJudges` | Jueces, exámenes, informes |
| `canAdminJudges` | Delete juez/informe/sanción |
| `canReviewPromotions` | Revisar ascensos |
| `assertRefereeInUserZone` | Lectura/mutación juez por zona |
| `assertCompetitionInUserZone` | Lectura/mutación campeonato por zona |

## Zona

`delegado_zona` queda limitado por `resolveZoneCode`. La UI oculta acciones fuera de scope, pero servidor es fuente de verdad.

Servidor restringe:

- Ficha juez por zona.
- Roster, historial y export de campeonato por zona.
- Exámenes por zona en update/delete.
- Sanciones por zona en revoke/notify.
- Admin users: solo `super_admin` puede crear, modificar o borrar otro `super_admin`.

## Supabase

- `profiles` enlaza Auth user con rol app.
- Usuario inactivo no obtiene sesión app.
- Primer usuario puede crear perfil `super_admin`; después usuarios deben ser invitados/activados.
- En producción desactivar signup público desde Supabase Auth.

## GitHub Secrets CI

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `READINESS_ALLOWED_EMAILS`
- `E2E_EMAIL`
- `E2E_PASSWORD`
