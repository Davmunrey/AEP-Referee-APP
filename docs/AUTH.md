# Autenticación y autorización

## Arquitectura

| Pieza | Responsabilidad |
|-------|-----------------|
| **Supabase Auth** | Login (Google OAuth + email/contraseña), sesión, cookies |
| **`profiles`** | Rol AEP (`nacional` / `regional` / `lectura`), zona, estado activo |
| **`@supabase/ssr`** | Gestión de sesión por cookies en servidor y cliente |

El `id` en `profiles` coincide 1:1 con el `id` (UUID) de `auth.users` de Supabase.

## Flujo de login

1. El usuario entra en `/sign-in`.
2. Elige **Continuar con Google** o introduce **email + contraseña**.
3. Supabase Auth crea la sesión (cookies `sb-*-auth-token`).
4. Google: redirige a `/auth/callback` → `exchangeCodeForSession`.
5. `getSession()` lee el usuario auth y carga su fila en `profiles`.
6. Si el perfil **no existe**, se crea automáticamente:
   - **Primer usuario registrado** → rol `nacional` (administrador).
   - **Resto** → rol `lectura`; el nacional los promociona en `/admin/users`.
7. Si `activo = false`, no hay acceso al panel.

## Configuración inicial (Supabase Dashboard)

1. **Migración SQL** — `SQL Editor` → ejecutar `supabase/migrations/003_supabase_auth.sql`.
   Revierte el esquema a Auth nativo, fija `search_path` en funciones (elimina los
   *warnings* de seguridad) y añade el trigger de creación de perfil.
2. **Proveedor Google** — `Authentication → Providers → Google`:
   - Activar y pegar `Client ID` + `Client Secret` de Google Cloud Console.
   - En Google Cloud, autorizar el redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`
3. **URLs de redirección** — `Authentication → URL Configuration`:
   - Site URL: `http://localhost:3000` (dev) / dominio Vercel (prod).
   - Redirect URLs: añadir `http://localhost:3000/auth/callback` y el de producción.
4. **Protección de contraseñas filtradas** — `Authentication → Policies`:
   activar *Leaked password protection* (elimina el warning correspondiente).
5. **Confirmación de email** — `Authentication → Providers → Email`:
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

- **Autoservicio** — cualquiera inicia sesión con Google o crea cuenta con
  email/contraseña; entra con rol `lectura` por defecto.
- **Gestión** — el `nacional` ajusta rol y zona, o da de baja, en `/admin/users`.
  El alta manual usa `supabase.auth.admin.createUser` (email ya confirmado).

## Cierre de sesión

Botón **Cerrar sesión** en el sidebar → `supabase.auth.signOut()` → `/sign-in`.
También disponible el endpoint `POST /api/v1/auth/signout`.

## Desarrollo local

Con `.env.local` configurado (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`), el login funciona de inmediato con email/contraseña.
Google requiere además configurar el proveedor en el dashboard (paso 2).
