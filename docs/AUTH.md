# Autenticación y autorización

## Arquitectura

| Pieza | Responsabilidad |
|-------|-----------------|
| **Supabase Auth** | Login (email/contraseña), sesión, cookies |
| **`profiles`** | Rol AEP (`super_admin`, `delegado_jueces`, `delegado_zona`, `solo_ver`), zona, estado activo |
| **`@supabase/ssr`** | Gestión de sesión por cookies en servidor y cliente |

El `id` en `profiles` coincide 1:1 con el `id` (UUID) de `auth.users` de Supabase.

> El login es exclusivamente **email/contraseña**. No hay proveedores OAuth.

## Flujo de login

1. El usuario entra en `/sign-in`.
2. Introduce **email + contraseña** (modo «iniciar sesión» o «crear cuenta»).
3. Supabase Auth crea la sesión (cookies `sb-*-auth-token`).
4. En registro nuevo, si está activada la confirmación de email, Supabase envía un enlace a `/auth/callback` → `exchangeCodeForSession`.
5. `getSession()` lee el usuario auth y carga su fila en `profiles`.
6. Si el perfil **no existe**, se crea automáticamente (`ensureProfile` o trigger `handle_new_user`):
   - **Primer usuario registrado** → rol `super_admin`, etiqueta «Super Admin».
   - **Resto** → rol `solo_ver`, etiqueta «Pendiente de asignación»; un administrador los promociona en `/admin/users`.
7. Si `activo = false`, no hay acceso al panel.

## Etiquetas de organización (UI)

`orgLabelForUser()` en `src/lib/auth/profile.ts`:

| Rol | Cabecera sidebar |
|-----|------------------|
| `super_admin` | AEP Nacional |
| `delegado_jueces` | AEP · Comité de Jueces |
| `delegado_zona` | AEP Regional · {zona} |
| `solo_ver` | AEP Consulta |

## Configuración inicial (Supabase Dashboard)

1. **Migraciones SQL** — en orden: `001`, `003`, `004`, `005`, `006_roles_rebrand`, `007_rls_hardening`, `008_per_event_roster_template`.
2. **URLs de redirección** — `Authentication → URL Configuration`:
   - Site URL: `http://localhost:3000` (dev) / `https://aep-tarima.vercel.app` (prod).
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://aep-tarima.vercel.app/auth/callback`.
3. **Protección de contraseñas filtradas** — `Authentication → Policies` → *Leaked password protection* (plan Pro).
4. **Confirmación de email** — opcional desactivar para uso interno.

## Roles y permisos (RBAC)

Implementación en `src/lib/auth/session.ts`:

| Rol | `canEditRoster` | `canApprove` | `canManageUsers` | `canManageJudges` | `canAdminJudges` | `canReviewPromotions` |
|-----|-----------------|--------------|------------------|-------------------|------------------|------------------------|
| `super_admin` | cualquier zona | sí | sí | sí | sí | sí |
| `delegado_jueces` | cualquier zona | sí | sí | sí | sí | sí |
| `delegado_zona` | solo `user.zona === eventZona` | no | no | sí (su zona) | no | no |
| `solo_ver` | no | no | no | no | no | no |

`delegado_jueces` tiene **paridad operativa** con `super_admin` en tarima, aprobaciones, ascensos y usuarios (diseño federativo: jefe nacional de jueces).

### Scoping por zona (`delegado_zona`)

El servidor aplica filtros de zona en todos los recursos derivados de jueces:

| Recurso | Lectura (GET) | Escritura |
|---------|--------------|-----------|
| Campeonatos | filtra `zona === user.zona` | crear/editar/borrar solo en su zona |
| Tarima / asignaciones / flags | hereda zona del campeonato | igual |
| Jueces | filtra por zona | `POST`/`PATCH` solo en su zona; no puede mover juez a otra zona |
| Aprobaciones | filtra por zona | no aprueba |
| Ascensos | filtra por zona | solicita; no revisa |
| Exámenes | filtra por zona del juez | crea/edita; no elimina |
| Informes | filtra por zona del juez | crea/edita; no elimina |
| KPIs dashboard (memoria) | calculados con datos de su zona | n/a |

## Alta de usuarios

- **Autoservicio** — registro en `/sign-in`; primer usuario → `super_admin`, resto → `solo_ver`.
- **Gestión** — `super_admin` o `delegado_jueces` en `/admin/users`: rol, zona, activo, baja.
- Alta manual vía API: `supabase.auth.admin.createUser` (email confirmado).

## Cierre de sesión

Sidebar → **Cerrar sesión** → `supabase.auth.signOut()` → `/sign-in`.  
También: `POST /api/v1/auth/signout`.

## Desarrollo local

Con `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), el login funciona de inmediato.

Guía operativa: [`GUIA-USO.md`](./GUIA-USO.md).
