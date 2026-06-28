# Base de datos

Supabase Postgres. Migraciones en `supabase/migrations`.

## Tipos de ID

**Todos los IDs son `TEXT`, no `UUID`.** Los PKs usan `gen_random_uuid()::text` — se generan como UUID pero se almacenan como texto. Las FKs deben ser `TEXT NOT NULL REFERENCES`. Cualquier migración nueva debe seguir este patrón para evitar errores de tipo incompatible en Supabase (`foreign key constraint cannot be implemented — incompatible types: uuid and text`).

## Tablas críticas

| Tabla | Migración | Uso |
|---|---|---|
| `profiles` | 003 | Usuario app + rol |
| `referees` | 001 | Jueces |
| `competitions` | 001 | Campeonatos + plantilla JSON |
| `roster_assignments` | 008 | Slots asignados |
| `approval_proposals` | 001 | Propuestas aprobación |
| `promotion_requests` | 001, 023 | Ascensos + `review_comment` al rechazar |
| `judge_compensation_claims` | 024 | Compensación por juez × campeonato |
| `judge_compensation_duty_lines` | 024 | Desglose sesión × posición por claim |
| `exams` | 001 | Exámenes |
| `reports` | 001 | Informes |
| `regulation_rules` | 001 | Normativa |
| `referee_sanctions` | 014 | Sanciones |
| `competition_availability` | 019 | Jueces confirmados disponibles por campeonato |

### `competition_availability` (migration 019)

Reemplaza `referee_availability` (eliminada en 019). Registra qué jueces confirmaron disponibilidad para un campeonato concreto.

```sql
CREATE TABLE competition_availability (
  id              TEXT  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  competition_id  TEXT  NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  referee_id      TEXT  NOT NULL REFERENCES referees(id) ON DELETE CASCADE,
  created_by      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT competition_availability_unique UNIQUE (competition_id, referee_id)
);
```

Índices en `competition_id` y `referee_id`. RLS: anon sin acceso; authenticated full CRUD.

### `promotion_requests.review_comment` (migration 023)

```sql
ALTER TABLE promotion_requests ADD COLUMN IF NOT EXISTS review_comment TEXT;
```

Persiste el motivo de rechazo al revisar ascensos (obligatorio en API cuando `approve: false`).

### Compensación de jueces (migrations 024–025)

**024** — tablas y geolocalización:

| Tabla / columna | Uso |
|---|---|
| `referees.domicilio`, `domicilio_lat`, `domicilio_lng` | Domicilio del juez (referencia; km manual en compensación) |
| `competitions.sede_direccion`, `sede_lat`, `sede_lng`, `ambito` | Destino; baremo |
| `competitions.compensation_clubs` (JSONB, **026**) | Varios clubes organizadores |
| `judge_compensation_claims` | Una fila por juez × campeonato (sin IBAN) |
| `judge_compensation_duty_lines` | Desglose sesión × posición (`role_key`, `role_label`) |
| `judge_compensation_claims.is_computer_setup` | Montaje del ordenador (pago aparte) |

**025** — rol financiero y metadatos del recibo:

- Enum `user_role`: valor `responsable_financiero_jueces`
- `competitions.compensation_organizer`, `compensation_club_name`, `compensation_club_email`, `compensation_volunteer`

**027** — montaje sistema y roles en duty lines:

- `judge_compensation_claims.is_computer_setup`, `computer_setup_amount`
- `judge_compensation_duty_lines.role_key`, `role_label`

**028** — elimina tabla `device_tokens` (app iOS descontinuada).

**Estado producción (2026-06-28):** migraciones hasta `028` aplicadas en proyecto Supabase `foaemadggmpbcrhtpems` (eu-west-2).

Detalle funcional: [`JUDGE-COMPENSATION.md`](./JUDGE-COMPENSATION.md).

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
