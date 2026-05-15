# Autenticación y autorización

## Arquitectura

| Pieza | Responsabilidad |
|-------|-----------------|
| **Clerk** | Login, sesión, contraseñas, MFA (opcional) |
| **Supabase** | Datos federativos + RLS |
| **`profiles`** | Rol AEP (`nacional` / `regional` / `lectura`), zona, activo |

El `id` en `profiles` es el **Clerk user ID** (`user_…`), no un UUID de Supabase Auth.

## Flujo de login

1. El usuario entra en `/sign-in` (componente Clerk).
2. Clerk establece la sesión (cookies).
3. `getSession()` lee `auth().userId` y carga la fila en `profiles`.
4. Si no hay perfil o `activo = false`, no hay acceso al panel.

## Configuración obligatoria

1. **Clerk Dashboard** → activar [integración Supabase](https://dashboard.clerk.com/setup/supabase).
2. **Supabase Dashboard** → Authentication → Third-party → **Clerk** (pegar dominio Clerk).
3. Ejecutar `supabase/migrations/002_clerk_auth.sql`.
4. Variables en Vercel: claves Clerk + Supabase (ver `docs/DEPLOY.md`).

## Roles

| Rol | Permisos |
|-----|----------|
| `nacional` | Todo, aprobar propuestas, `/admin/users` |
| `regional` | Su zona, editar tarimas y enviar propuestas |
| `lectura` | Solo lectura |

## Alta de usuarios

Solo **nacional** en `/admin/users`:

1. Crea usuario en **Clerk** (email + contraseña).
2. Inserta **perfil** en Supabase con rol y zona.

Desactiva el registro público en Clerk (Settings → Restrictions) para que no cualquiera se registre en `/sign-up`.

## Cerrar sesión

`SignOutButton` de Clerk en el sidebar → redirige a `/sign-in`.

## Desarrollo local

Sin Clerk/Supabase configurados, `dataService` usa memoria y `getSession()` devuelve `null` (no hay login real). Para probar el flujo completo, configura `.env.local` con ambos servicios y ejecuta `npm run db:seed`.
