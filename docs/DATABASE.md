# Base de datos (Supabase Postgres)

## Migraciones

Ejecuta en orden en el SQL Editor de Supabase (o `supabase db push`):

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/003_supabase_auth.sql
supabase/migrations/004_health_snapshots.sql
supabase/migrations/005_judge_management.sql
supabase/migrations/006_roles_rebrand.sql      # user_role: super_admin, delegado_*, solo_ver
supabase/migrations/007_rls_hardening.sql
supabase/migrations/008_per_event_roster_template.sql
```

Las migraciones 004+ usan patrones idempotentes donde aplica. Sin 004/005 la app degrada con listas vacías en exámenes/informes/salud.

## Tablas principales

| Tabla | Uso |
|-------|-----|
| `zones` | Códigos de zona (MAD, CAT, …) |
| `profiles` | Perfil 1:1 con `auth.users` (`role`, `zona`, `activo`) |
| `referees` | Directorio de jueces |
| `competitions` | Campeonatos; **`template` JSONB** — plantilla de sesiones por evento |
| `roster_assignments` | `slot_key` → `referee_id`; **`flags` JSONB** — `{ compartido, intercambio }` |
| `approval_proposals` | Propuestas de tarima |
| `promotion_requests` | Ascensos |
| `activity_log` | Feed del dashboard |
| `roster_history` | Auditoría de tarima |
| `regulation_rules` | Normativa IPF/AEP |
| `app_config` | JSON legacy (`roster_template`, calendario) |
| `health_snapshots` | Bitácora de salud operativa |
| `referee_exams` | Exámenes de jueces |
| `referee_reports` | Informes de juez |

### Columnas nuevas (008)

| Columna | Tipo | Comportamiento |
|---------|------|----------------|
| `competitions.template` | `JSONB` nullable | `RosterSession[]`. `NULL` → preset por `tipo` en aplicación |
| `roster_assignments.flags` | `JSONB` default `{}` | Flags por slot; solo con asignación activa |

RLS en 008: sin políticas nuevas; la API usa **service role** + RBAC en handlers.

## Roles (`user_role`)

Definidos en `006_roles_rebrand.sql`:

- `super_admin`
- `delegado_jueces`
- `delegado_zona`
- `solo_ver`

## RLS

Políticas con `public.current_profile()` para filtrar por rol y zona. Rutas `/api/v1/admin/*` y operaciones de servidor usan **service role**.

## Seed

```bash
npm run db:seed
```

Pobla zonas, normativa, jueces, campeonatos demo, etc. No crea usuarios auth (registro manual o `/admin/users`).

## Backfill de plantillas (opción A)

Copia presets AEP-1/2/3 en filas con `template IS NULL`:

```bash
npm run db:backfill-templates
```

Equivalente SQL (generado desde `src/lib/mock-data.ts`):

```sql
UPDATE competitions SET template = '<preset AEP-1 JSON>'::jsonb
  WHERE tipo = 'AEP-1' AND template IS NULL;
-- idem AEP-2, AEP-3
```

Tras el backfill, la UI edita la copia persistida; el preset en código solo aplica si `template` sigue siendo `NULL`.

## Desarrollo sin Supabase

Sin `NEXT_PUBLIC_SUPABASE_*`, `dataService` usa `memory-service.ts`. No usar en Vercel.
