# Autenticación y autorización

## Arquitectura

| Pieza | Responsabilidad |
|-------|-----------------|
| **Supabase Auth** | Login (email/contraseña), sesión, cookies |
| **`profiles`** | Rol AEP (`nacional` / `regional` / `lectura`), zona, estado activo |
| **`@supabase/ssr`** | Gestión de sesión por cookies en servidor y cliente |

El `id` en `profiles` coincide 1:1 con el `id` (UUID) de `auth.users` de Supabase.

> El login es exclusivamente **email/contraseña**. No hay proveedores OAuth
> (Google se retiró a petición del cliente).

## Flujo de login

1. El usuario entra en `/sign-in`.
2. Introduce **email + contraseña** (modo «iniciar sesión» o «crear cuenta»).
3. Supabase Auth crea la sesión (cookies `sb-*-auth-token`).
4. En registro nuevo, si está activada la confirmación de email, Supabase envía
   un enlace que apunta a `/auth/callback` → `exchangeCodeForSession`.
5. `getSession()` lee el usuario auth y carga su fila en `profiles`.
6. Si el perfil **no existe**, se crea automáticamente:
   - **Primer usuario registrado** → rol `nacional` (administrador).
   - **Resto** → rol `lectura`; el nacional los promociona en `/admin/users`.
7. Si `activo = false`, no hay acceso al panel.

## Configuración inicial (Supabase Dashboard)

1. **Migración SQL** — `SQL Editor` → ejecutar `supabase/migrations/003_supabase_auth.sql`.
   Revierte el esquema a Auth nativo, fija `search_path` en funciones (elimina los
   *warnings* de seguridad) y añade el trigger de creación de perfil.
2. **URLs de redirección** — `Authentication → URL Configuration`:
   - Site URL: `http://localhost:3000` (dev) / dominio Vercel (prod).
   - Redirect URLs: añadir `http://localhost:3000/auth/callback` y el de producción.
3. **Protección de contraseñas filtradas** — `Authentication → Policies`:
   activar *Leaked password protection* (elimina el warning correspondiente).
4. **Confirmación de email** — `Authentication → Providers → Email`:
   para uso interno se puede desactivar *Confirm email* y agilizar el alta.

> La app **funciona sin la migración 003**: `profiles.id` es `TEXT` y acepta UUIDs,
> y los perfiles se crean desde `getSession()`. La migración solo endurece el
> esquema y elimina los avisos del panel de Supabase.

## Roles

| Rol | Permisos |
|-----|----------|
| `nacional` | Todo: aprobar propuestas, gestionar usuarios en `/admin/users` |
| `regional` | Su zona: editar tarimas, enviar propuestas, solicitar ascensos |
| `lectura` | Solo lectura, sin crear ni editar |

## Alta de usuarios

- **Autoservicio** — cualquiera crea cuenta con email/contraseña en `/sign-in`;
  entra con rol `lectura` por defecto (`nacional` para el primer registro).
- **Gestión** — el `nacional` ajusta rol y zona, o da de baja, en `/admin/users`.
  El alta manual usa `supabase.auth.admin.createUser` (email ya confirmado).

## Cierre de sesión

Botón **Cerrar sesión** en el sidebar → `supabase.auth.signOut()` → `/sign-in`.
También disponible el endpoint `POST /api/v1/auth/signout`.

## Desarrollo local

Con `.env.local` configurado (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`), el login por email/contraseña funciona de inmediato.
