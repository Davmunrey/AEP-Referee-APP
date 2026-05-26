# Roadmap — v1.1 AEP Referee APP Full Feature Upgrade

## Overview

6 phases | 23 requirements | milestone v1.1

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 1 | Cross-Zone DB + API | DB schema + API para cross-zone assignments | ZONE-01, ZONE-04, ZONE-06 |
| 2 | Cross-Zone UI | Roster builder con cross-zone UX completa | ZONE-02, ZONE-03, ZONE-05 |
| 3 | Schedule Builder | Edición manual de plantilla de tarima | SCHED-01, SCHED-02, SCHED-03, SCHED-04 |
| 4 | Import Improvements | Mejor parseo Excel/PDF + preview | IMP-01, IMP-02, IMP-03, IMP-04 |
| 5 | Judge Availability | Disponibilidad por fechas + filtro | AVAIL-01, AVAIL-02, AVAIL-03 |
| 6 | Analytics + UX | Analytics cross-zona + refinements UX | ANAL-01, ANAL-02, ANAL-03, UX-01, UX-02, UX-03 |

## Phase Details

### Phase 1: Cross-Zone DB + API
**Goal:** Añadir `cross_zone` flag a DB, migración, y validación en API de asignación.
**Requirements:** ZONE-01, ZONE-04, ZONE-06
**Status:** complete ✅
**Artifacts:** supabase/migrations/017_cross_zone_assignments.sql, assign/route.ts updated

### Phase 2: Cross-Zone UI
**Goal:** Roster builder muestra y gestiona asignaciones cross-zona con UX clara.
**Requirements:** ZONE-02, ZONE-03, ZONE-05
**Status:** complete ✅
**Artifacts:** roster-builder.tsx — "Todas las zonas" option, orange zone badge, cross-zone slot markers

### Phase 3: Schedule Builder
**Goal:** Crear y editar plantillas de tarima sin importar PDF.
**Requirements:** SCHED-01, SCHED-02, SCHED-03, SCHED-04
**Status:** complete ✅
**Artifacts:** roster-template-editor.tsx (627 lines), parse-aep-horario-text.ts hardened (DAY_RE + SCHEDULE_RE + en-dash)

### Phase 4: Import Improvements
**Goal:** Excel e importaciones reconocen todos los campos disponibles.
**Requirements:** IMP-01, IMP-02, IMP-03, IMP-04
**Status:** complete ✅
**Artifacts:** import-preview.ts (6 fields mapped), judges-registry-import.tsx (6-col preview table)

### Phase 5: Judge Availability
**Goal:** Registrar y mostrar disponibilidad de jueces por fecha.
**Requirements:** AVAIL-01, AVAIL-02, AVAIL-03
**Status:** complete ✅
**Artifacts:** 018_referee_availability.sql, availability API routes, referee-availability-panel.tsx, unavailableOnDate in Referee type

### Phase 6: Analytics + UX
**Goal:** Estadísticas cross-zona, export CSV, y refinements UX en selector de jueces.
**Requirements:** ANAL-01, ANAL-02, ANAL-03, UX-01, UX-02, UX-03
**Status:** complete ✅
**Artifacts:** analytics-dashboard.tsx (cross-zone column + banner), buildKpis (Cobertura Nacional KPI), upcomingCount30d in Referee + roster-builder workload warning
