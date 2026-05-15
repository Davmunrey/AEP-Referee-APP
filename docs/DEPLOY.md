# Despliegue en Vercel

## Requisitos

- Repositorio en GitHub conectado a Vercel
- Proyecto Supabase (región EU recomendada para datos federativos en España)
- Migración `supabase/migrations/001_initial_schema.sql` aplicada

## Variables de entorno en Vercel

| Variable | Entorno | Descripción |
|----------|---------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Production, Preview | Clerk (pública) |
| `CLERK_SECRET_KEY` | Production, Preview | Clerk (solo servidor) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Production, Preview | `/sign-in` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Production, Preview | `/` |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anónima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Service role — admin de usuarios y seed |

## Integración Clerk ↔ Supabase

1. Clerk Dashboard → Setup → Supabase → Activate.
2. Supabase → Authentication → Third-party → Clerk.
3. SQL: `001_initial_schema.sql` + `002_clerk_auth.sql`.

## Pasos

1. **Build**: Vercel ejecuta `npm run build`. El proyecto debe compilar con las variables de Supabase definidas (aunque sean de un proyecto staging).
2. **Seed (una vez)**: Desde tu máquina, con `.env.local` apuntando al Supabase de producción:

   ```bash
   npm run db:seed
   ```

3. **Dominio**: Asigna el dominio federativo en Vercel → Settings → Domains.
4. **Clerk**: Allowed redirect URLs con tu dominio Vercel y `http://localhost:3000`.
5. Desactiva sign-up público en Clerk si solo nacional crea cuentas.

## Notas serverless

- El store en memoria **no** persiste entre invocaciones en Vercel. En producción `dataService` usa siempre Postgres vía Supabase.
- Sin `NEXT_PUBLIC_SUPABASE_URL` la API devuelve 503 y el login no funcionará.

## Checklist post-deploy

- [ ] Login con usuario nacional
- [ ] Login con usuario regional (solo ve su zona)
- [ ] Crear usuario regional desde `/admin/users`
- [ ] Asignar árbitro en tarima y enviar propuesta
- [ ] Aprobar propuesta como nacional
