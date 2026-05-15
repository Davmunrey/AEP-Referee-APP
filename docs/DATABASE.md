# Base de datos (Supabase Postgres)

## Migración

Ejecuta el archivo completo:

```
supabase/migrations/001_initial_schema.sql
```

En el SQL Editor de Supabase o con CLI: `supabase db push`.

## Tablas principales

| Tabla | Uso |
|-------|-----|
| `zones` | Códigos de zona federativa (MAD, CAT, …) |
| `profiles` | Perfil 1:1 con `auth.users` (rol, zona, activo) |
| `referees` | Directorio de árbitros |
| `competitions` | Campeonatos |
| `roster_assignments` | Slot → árbitro por evento |
| `approval_proposals` | Propuestas de tarima pendientes |
| `promotion_requests` | Ascensos de nivel |
| `activity_log` | Feed del dashboard |
| `roster_history` | Auditoría de cambios en tarima |
| `regulation_rules` | Normativa IPF |
| `app_config` | JSON (`roster_template`, `calendar_events`) |

## RLS

Las políticas usan `public.current_profile()` para filtrar por rol y zona. El cliente anon autenticado solo ve filas permitidas; operaciones de administración de usuarios usan **service role** en rutas `/api/v1/admin/*`.

## Seed

```bash
# .env.local con SUPABASE_SERVICE_ROLE_KEY
npm run db:seed
```

Crea zonas, árbitros, campeonatos, normativa, actividad y usuarios:

- `nacional@aep-tarima.es`
- `madrid@aep-tarima.es`, `cataluna@aep-tarima.es`, …
- `consulta@aep-tarima.es`

Contraseña inicial: `SEED_DEFAULT_PASSWORD` o `ChangeMe2026!` por defecto. **Cámbiala en producción.**

## Desarrollo sin Supabase

Si no hay variables `NEXT_PUBLIC_SUPABASE_*`, `dataService` usa memoria (`memory-service.ts`) para explorar UI sin login real. No uses este modo en Vercel.
