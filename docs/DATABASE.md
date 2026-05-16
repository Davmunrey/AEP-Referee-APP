# Base de datos (Supabase Postgres)

## Migraciones

Ejecuta los archivos en orden en el SQL Editor de Supabase (o `supabase db push`):

```
supabase/migrations/001_initial_schema.sql    # esquema base
supabase/migrations/003_supabase_auth.sql     # Auth nativo (revierte Clerk)
supabase/migrations/004_health_snapshots.sql  # bitácora de salud del panel
supabase/migrations/005_judge_management.sql  # exámenes e informes de jueces
```

Las migraciones 004 y 005 usan `CREATE TABLE IF NOT EXISTS` — son seguras de
re-ejecutar. La app **degrada sin romper** si 004/005 no están aplicadas: las
funciones afectadas devuelven listas vacías en lugar de fallar.

## Tablas principales

| Tabla | Migración | Uso |
|-------|-----------|-----|
| `zones` | 001 | Códigos de zona federativa (MAD, CAT, …) |
| `profiles` | 001 / 003 | Perfil 1:1 con `auth.users` (rol, zona, activo) |
| `referees` | 001 | Directorio de árbitros |
| `competitions` | 001 | Campeonatos |
| `roster_assignments` | 001 | Slot → árbitro por evento |
| `approval_proposals` | 001 | Propuestas de tarima pendientes |
| `promotion_requests` | 001 | Ascensos de nivel |
| `activity_log` | 001 | Feed del dashboard |
| `roster_history` | 001 | Auditoría de cambios en tarima |
| `regulation_rules` | 001 | Normativa IPF |
| `app_config` | 001 | JSON (`roster_template`, `calendar_events`) |
| `health_snapshots` | 004 | Bitácora del índice de salud operativa |
| `referee_exams` | 005 | Exámenes arbitrales (teórico, práctico, reglamento, recert.) |
| `referee_reports` | 005 | Informes de desempeño / incidencias por juez |

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
