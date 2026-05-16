# Despliegue en Vercel

## Requisitos

- Repositorio en GitHub conectado a Vercel
- Proyecto Supabase (región EU recomendada para datos federativos en España)
- Migraciones `001_initial_schema.sql`, `003_supabase_auth.sql`,
  `004_health_snapshots.sql` y `005_judge_management.sql` aplicadas

## Variables de entorno en Vercel

| Variable | Entorno | Descripción |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anónima Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Service role — admin de usuarios y seed |

## Configuración Supabase

1. SQL Editor → ejecutar `001_initial_schema.sql`, `003_supabase_auth.sql`,
   `004_health_snapshots.sql` (bitácora de salud) y `005_judge_management.sql`
   (exámenes e informes de jueces).
2. Authentication → URL Configuration → Site URL = dominio Vercel;
   Redirect URLs = `https://<dominio>/auth/callback` y `http://localhost:3000/auth/callback`.
3. (Opcional) Authentication → Providers → Google: activar e introducir
   `Client ID`/`Secret` si se quiere login con Google.
4. Authentication → Policies → activar *Leaked password protection*.

## Pasos

1. **Build**: Vercel ejecuta `npm run build`. El proyecto debe compilar con las
   variables de Supabase definidas.
2. **Seed (una vez)**: desde tu máquina, con `.env.local` apuntando al Supabase
   de producción:

   ```bash
   npm run db:seed
   ```

   Puebla zonas, normativa, árbitros y campeonatos. No crea usuarios.
3. **Dominio**: asigna el dominio federativo en Vercel → Settings → Domains.
4. **Primer acceso**: el primer usuario que se registre obtiene rol `nacional`.

## Notas serverless

- El store en memoria **no** persiste entre invocaciones en Vercel. En
  producción `dataService` usa siempre Postgres vía Supabase.
- Sin `NEXT_PUBLIC_SUPABASE_URL` la API devuelve 503 y el login no funcionará.

## Checklist post-deploy

- [ ] Registro del primer usuario → rol nacional automático
- [ ] Login con email/contraseña
- [ ] Crear usuario regional desde `/admin/users`
- [ ] El usuario regional solo ve su zona
- [ ] Asignar árbitro en tarima y enviar propuesta
- [ ] Aprobar propuesta como nacional
