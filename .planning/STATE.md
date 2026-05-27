---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Quality & Completeness
status: planning
last_updated: "2026-05-27T18:38:23.589Z"
last_activity: 2026-05-27
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-27 — Milestone v1.2 started

## Completed Phases

- Phase 1: Cross-Zone DB + API ✅ — migration 017, cross_zone flag in roster_assignments, auto-detect in assign API
- Phase 2: Cross-Zone UI ✅ — "Todas las zonas" filter, orange zone badge, cross-zone visual markers in roster
- Phase 3: Schedule Builder ✅ — RosterTemplateEditor (627 lines), PDF parser hardened (DAY_RE, SCHEDULE_RE), multi-day support
- Phase 4: Import Improvements ✅ — 6-field preview (Nombre/Nivel/Zona/Localidad/Género/Tel.), warnings passed through
- Phase 5: Judge Availability ✅ — migration 018, availability API routes, RefereeAvailabilityPanel, unavailableOnDate in roster
- Phase 6: Analytics + UX ✅ — cross-zone column + banner, Cobertura Nacional KPI (5th card), CSV export, iniciales search, 30-day workload warning

## Key Decisions

- Cross-zone auto-detection is server-side only (compare referee.zona vs competition.zona) — prevents client spoofing
- Availability filter: `disp=false` referees hidden by default; `unavailableOnDate=true` shown with warning (can still assign)
- 30-day workload window uses `upcomingCount30d` (DB-computed) when forDate is set; falls back to `eventos >= 8` for general lists
- Coverage KPI uses `enumerateSlotKeys(template).length` — same source as analytics, so values agree

## Blockers/Concerns

None. Milestone finalized.
