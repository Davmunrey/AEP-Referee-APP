# Despliegue en Vercel

**Producción:** https://aep-tarima.vercel.app/

## Requisitos

- Repositorio GitHub conectado a Vercel
- Proyecto Supabase (región EU recomendada)
- Migraciones **001 → 008** aplicadas (ver [`DATABASE.md`](./DATABASE.md))

## Variables de entorno en Vercel

| Variable | Entorno | Descripción |
|----------|---------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anónima |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | Service role — admin y seed |

## Configuración Supabase

1. SQL Editor — migraciones en orden hasta `008_per_event_roster_template.sql`.
2. **URL Configuration** — Site URL = `https://aep-tarima.vercel.app`; Redirect URLs:
   - `https://aep-tarima.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`
3. **Leaked password protection** — activar si el plan lo permite (Pro).
4. Login solo **email/contraseña**.

## Pasos

1. **Build** — `npm run build` en Vercel con variables definidas.
2. **Seed (una vez)** — desde local con `.env.local` apuntando a prod:

   ```bash
   npm run db:seed
   ```

3. **Backfill plantillas (opcional)** — si hay campeonatos con `template` NULL:

   ```bash
   npm run db:backfill-templates
   ```

4. **Dominio** — asignado: `aep-tarima.vercel.app` (Vercel → Settings → Domains).
5. **Primer acceso** — primer registro → `super_admin`.

## Notas serverless

- `memory-service` no persiste en Vercel; producción usa siempre Supabase.
- Sin `NEXT_PUBLIC_SUPABASE_URL` la API devuelve 503.

## Checklist post-deploy

- [ ] Primer usuario → `super_admin`
- [ ] Login email/contraseña
- [ ] Crear delegado de zona en `/admin/users`
- [ ] Delegado de zona solo ve su zona
- [ ] Editar plantilla y asignar juez en tarima
- [ ] Flags `*` / `↑↓` en export TXT
- [ ] Enviar propuesta y aprobar como `delegado_jueces` o `super_admin`

Guía operativa: [`GUIA-USO.md`](./GUIA-USO.md).
