# Auth y RBAC

## Login

- Ruta UI: `/sign-in`.
- Flujo: `POST /auth/password` (check rate-limit) → `POST /auth/login` (credenciales).
- El login real ocurre **en servidor** (`/api/v1/auth/login`): Supabase `signInWithPassword`, cookies de sesión y registro interno de fallos.
- Rate-limit: 5 fallos por IP+email cada 15 min. Las acciones públicas `fail`/`success` en `/auth/password` devuelven **403** (no manipulables desde cliente).
- Errores genéricos: no se diferencia cuenta inexistente, password erróneo o email sin confirmar.
- Sin registro público visible.
- Reset: enlace "¿Olvidaste tu contraseña?" (Supabase `resetPasswordForEmail`).
- Sesión: cookies `sb-*-auth-token`, TTL app 7 días.
- **Correos transaccionales**: plantillas con branding AEP Tarima y URL `https://aep-tarima.vercel.app`. Fuente: `src/lib/auth/supabase-email-branding.ts` + `supabase/templates/`. Aplicar en remoto con `npm run supabase:email-branding` (requiere `SUPABASE_ACCESS_TOKEN`).

## Gestión de contraseñas

| Acción | Ruta | Quién | Verificación |
|---|---|---|---|
| Cambiar la propia | `POST /auth/change-password` | Cualquier rol autenticado | Exige la contraseña actual |
| Reset de otro usuario | `POST /admin/users/:id/password` | `canManageUsers` | Solo `super_admin` resetea a otro `super_admin` |

## Roles

| Rol | Permisos |
|---|---|
| `super_admin` | Todo |
| `delegado_jueces` | Todo operativo nacional (jueces, tarimas, ascensos) |
| `delegado_zona` | Jueces, informes y tarimas de su zona; dashboard/analytics acotados |
| `responsable_financiero_jueces` | Compensación de gastos de jueces (lectura de tarimas/censo; export PDF). **No** edita tarima ni censo. Acceso principal: `/compensation` |
| `solo_ver` | Lectura |

## Guards

| Guard | Uso |
|---|---|
| `requireApiUser` | Toda API privada |
| `canEditRoster` | Campeonatos/tarima |
| `canApprove` | Aprobaciones |
| `canManageUsers` | Usuarios |
| `canManageJudges` | Jueces, exámenes, informes |
| `canManageCompensation` | Compensación y export de recibos (responsable financiero) |
| `canAdminJudges` | Delete juez/informe/sanción |
| `canReviewPromotions` | Revisar ascensos |
| `assertRefereeInUserZone` | Lectura/mutación juez por zona |
| `assertCompetitionInUserZone` | Lectura/mutación campeonato por zona |

## Zona

`delegado_zona` queda limitado por `resolveZoneCode`. La UI oculta acciones fuera de scope; **servidor es fuente de verdad**.

Servidor restringe:

- Ficha juez, roster, historial y export por zona.
- Dashboard: competiciones, KPIs, calendario, intelligence, actividad filtrada.
- Analytics: agregaciones y top jueces de su zona.
- Exámenes y sanciones por zona en mutaciones.
- Sin zona asignada: fail-closed (sin lectura nacional).

## Supabase

- `profiles` enlaza Auth user con rol app.
- Usuario inactivo no obtiene sesión app.
- Primer usuario puede crear perfil `super_admin`; después usuarios deben ser invitados/activados.
- En producción desactivar signup público desde Supabase Auth.
- **Acceso a datos:** el cliente del navegador (clave anónima) solo se usa para auth y para leer/suscribirse a `app_sync_state`. Todo el resto de datos se lee/escribe desde el servidor con `service_role` (ignora RLS) + RBAC propio. El esquema está bloqueado por RLS "sin políticas" (ver [`DATABASE.md`](./DATABASE.md#rls); endurecido en migración 033).
- **Pendiente de seguridad** (toggle manual del panel, no es código): activar **Leaked Password Protection** (HaveIBeenPwned) en Supabase Auth.

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v1.9 · Site URL y redirect URLs deben apuntar a este dominio Vercel.

## GitHub Secrets CI

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `READINESS_ALLOWED_EMAILS`
- `E2E_EMAIL`
- `E2E_PASSWORD`
