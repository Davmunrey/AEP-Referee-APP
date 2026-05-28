# Base de datos

Supabase Postgres. Migraciones en `supabase/migrations`.

## Tablas críticas

| Tabla | Uso |
|---|---|
| `profiles` | Usuario app + rol |
| `referees` | Jueces |
| `competitions` | Campeonatos + plantilla JSON |
| `roster_assignments` | Slots asignados |
| `approval_proposals` | Propuestas aprobación |
| `promotion_requests` | Ascensos |
| `exams` | Exámenes |
| `reports` | Informes |
| `regulation_rules` | Normativa |
| `referee_sanctions` | Sanciones |
| `competition_availability` | Jueces confirmados disponibles por campeonato (migration 018) |

## RLS

Modelo: cliente anon/authenticated no accede directo a datos sensibles. App lee/escribe vía route handlers server-side con service role y RBAC propio.

## Compat legacy

Migraciones iniciales conservan nombres históricos `event_*`; runtime usa `competition_*`. No reescribir historial de migraciones si producción ya las aplicó.

## Backup

```bash
npm run db:backup
npm run db:backup:verify
npm run db:restore:dry-run
```

Backups van a `backups/`, ignorado por git.

## Dev sin Supabase

Si faltan `NEXT_PUBLIC_SUPABASE_*`, `dataService` usa memoria. No usar en producción.
