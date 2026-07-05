# Base de datos

Supabase Postgres. Migraciones en `supabase/migrations`.

**Producción:** proyecto `foaemadggmpbcrhtpems` (eu-west-2). Migraciones hasta `033` aplicadas.

## Tipos de ID

**Todos los IDs son `TEXT`, no `UUID`.** Los PKs usan `gen_random_uuid()::text` — se generan como UUID pero se almacenan como texto. Las FKs deben ser `TEXT NOT NULL REFERENCES`. Cualquier migración nueva debe seguir este patrón para evitar errores de tipo incompatible en Supabase (`foreign key constraint cannot be implemented — incompatible types: uuid and text`).

## Tablas críticas

| Tabla | Migración | Uso |
|---|---|---|
| `profiles` | 003 | Usuario app + rol |
| `referees` | 001 | Jueces (`domicilio`, `domicilio_lat`, `domicilio_lng`, `arbitraje_stats`, `arbitraje_stats_by_year`) |
| `competitions` | 001 | Campeonatos + plantilla JSON |
| `roster_assignments` | 008 | Slots asignados |
| `approval_proposals` | 001 | Propuestas aprobación |
| `promotion_requests` | 001, 023 | Ascensos + `review_comment` al rechazar |
| `judge_compensation_claims` | 024 | Compensación por juez × campeonato |
| `judge_compensation_duty_lines` | 024 | Desglose sesión × posición por claim |
| `exams` | 001 | Exámenes |
| `reports` | 001 | Informes |
| `regulation_rules` | 001 | Normativa (caché servidor 1 h) |
| `zones` | — | Zonas macro (caché servidor 1 h) |
| `referee_sanctions` | 014 | Sanciones |
| `competition_availability` | 019 | Jueces confirmados disponibles por campeonato |
| `app_sync_state` | 029 | Versión global para Realtime |

### `app_sync_state` (migration 029)

Tabla singleton (`id = 1`) con contador `version`. Triggers en 13 tablas operativas incrementan la versión en cada INSERT/UPDATE/DELETE. Los clientes autenticados escuchan cambios vía Supabase Realtime y refrescan la UI.

Tablas con trigger: `competitions`, `roster_assignments`, `approval_proposals`, `promotion_requests`, `referees`, `referee_sanctions`, `referee_exams`, `referee_reports`, `judge_compensation_claims`, `judge_compensation_duty_lines`, `competition_availability`, `activity_log`, `profiles`.

### `competition_availability` (migration 019)

Reemplaza `referee_availability` (eliminada en 019). Registra qué jueces confirmaron disponibilidad para un campeonato concreto.

Índices en `competition_id` y `referee_id`. RLS: bloqueada a cliente (anon y authenticated); solo servidor con `service_role` (ver [RLS](#rls)). La política permisiva de `authenticated` se eliminó en **033**.

### Compensación de jueces (migrations 024–027)

| Tabla / columna | Uso |
|---|---|
| `referees.domicilio`, `domicilio_lat`, `domicilio_lng` | Domicilio del juez; borrable desde ficha (NULL en los tres campos) |
| `competitions.sede_direccion`, `sede_lat`, `sede_lng`, `ambito` | Destino; baremo |
| `competitions.compensation_clubs` (JSONB, **026**) | Varios clubes organizadores (nombres + correos) |
| `competitions.compensation_organizer` (**031**) | Tipo de organizador del recibo. CHECK `IN ('club','aep','custom')` |
| `judge_compensation_claims` | Una fila por juez × campeonato (sin IBAN) |
| `judge_compensation_duty_lines` | Desglose sesión × posición (`role_key`, `role_label`) |
| `judge_compensation_claims.is_computer_setup` | Montaje del ordenador (pago aparte) |

**025** — rol `responsable_financiero_jueces` y metadatos del recibo.

**027** — montaje sistema y roles en duty lines.

**028** — elimina tabla `device_tokens` (app iOS descontinuada).

**031** — organizador del recibo con tercer tipo `custom` (personalizable): reutiliza `compensation_clubs` (nombres + correos) para cabecera y correos de devolución. Cambio aditivo sobre `club`/`aep`; el CHECK pasa a `compensation_organizer IN ('club','aep','custom')`.

### Arbitrajes por año natural (migration 032)

`referees.arbitraje_stats_by_year` (JSONB) desglosa los arbitrajes por año natural: `{ "2024": {…}, "2025": {…}, … }`. Permite separar censo vigente vs histórico y analítica por año. El agregado histórico (suma de todos los años) sigue en `referees.arbitraje_stats`.

### Índices de rendimiento (migration 030)

| Índice | Tabla | Columna(s) |
|---|---|---|
| `roster_assignments_competition_id_idx` | `roster_assignments` | `competition_id` |
| `roster_assignments_referee_id_idx` | `roster_assignments` | `referee_id` |
| `referees_nivel_idx` | `referees` | `nivel` |
| `referees_estado_idx` | `referees` | `estado` |

Detalle funcional compensación: [`JUDGE-COMPENSATION.md`](./JUDGE-COMPENSATION.md).

## RLS

Modelo: **todo el acceso a datos de la app va por el servidor con la clave `service_role`** (que ignora RLS) y RBAC propio en los route handlers. El cliente del navegador (clave anónima) solo se usa para **auth** y para **leer/suscribirse a `app_sync_state`** (contador de sincronización). Por eso el patrón general del esquema es "RLS habilitado sin políticas" = bloqueado a todo lo que no sea el servidor.

`app_sync_state`: SELECT para `authenticated`; mutaciones solo vía triggers SECURITY DEFINER.

**Endurecimiento (migration 033):** se eliminaron las últimas políticas permisivas `USING (true)` / `WITH CHECK (true)` para el rol `authenticated` en `referee_sanctions` (datos disciplinarios) y `competition_availability`, que las dejaban abiertas a cualquier usuario autenticado vía la clave anónima. Ahora esas tablas quedan bloqueadas como el resto del esquema (RLS on, sin políticas para anon/authenticated): solo accesibles desde el servidor con `service_role`. Sin impacto funcional.

Único pendiente de seguridad (no es código): activar **Leaked Password Protection** (HaveIBeenPwned) desde el panel de Supabase Auth.

## Compat legacy

Migraciones iniciales conservan nombres históricos `event_*`; runtime usa `competition_*`. No reescribir historial de migraciones si producción ya las aplicó.

## Backup

```bash
npm run db:backup
npm run db:backup:verify
npm run db:restore:dry-run
```

Backups van a `backups/`, ignorado por git. Ejecutar desde entorno con credenciales Supabase (mantenedores).

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v1.9
