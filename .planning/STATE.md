---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: production-hardening
status: completed
last_updated: "2025-06-28"
last_activity: 2025-06-28 — audit completo, multi-temporada, docs actualizados
progress:
  total_phases: 10
  completed_phases: 10
  percent: 100
---

## Current Position

Phase: 10 — Production hardening
Status: Complete on `main`
Last activity: Roster rules, zone scoping, login server-side, multi-year season utils, 298 tests

## Completed (v1.4)

- Roster: plazas requeridas, conflictos misma sesión, confirm-to-force *, merge import horario parcial
- Audit fixes: slotKey parsing, RBAC zona, PATCH whitelist, sanction bypass, promotion downgrade guard
- Dashboard/analytics: scope zonal para `delegado_zona`
- Auth: `POST /auth/login` server-side; rate-limit no manipulable
- Multi-temporada: `src/lib/season.ts`; UI sin año fijo
- DB: migration `023_promotion_review_comment`
- Docs: README + `docs/*` + iOS actualizados

## Key Decisions

- Temporada deportiva: julio+ → etiqueta año siguiente (`currentSeasonYear`)
- Datos multi-año por fechas ISO; documentos normativos por archivo (`aep-guide-YYYY`)
- `countOpenSlots` ignora claves huérfanas; assign revalida post-upsert (TOCTOU mitigado)
- Guías normativas AEP permanecen versionadas por año de publicación

## Blockers/Concerns

None for current release. Pendiente: E2E profundo import→export, sustitución `xlsx`.
