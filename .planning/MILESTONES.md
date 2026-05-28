# Milestones — AEP Referee APP

## v1.1 — Completeness & Workflow (2026-05-27)

**6 phases | 23 requirements**

### Phase 1: Cross-Zone Judge Assignment
- Cross-zone judge selection with automatic zone detection
- Visual cross-zone badge in roster view
- Confirm filter to show only available judges
- `canEditRoster(user, competition.zona)` RBAC helper

### Phase 2: Template Editor
- Inline template editor with session/role management
- Drag-and-drop slot reordering
- Session naming, category configuration

### Phase 3: PDF Import Robustness
- Improved PDF regex for schedule extraction
- Better session detection and error reporting
- Fallback parsing strategies

### Phase 4: Per-Competition Availability
- `referee_availability` DB table (migration 018)
- GET/POST/DELETE `/api/v1/competitions/:id/availability`
- `CompetitionAvailabilityDialog` — WhatsApp-style availability UI
- Roster warnings for unconfirmed judges

### Phase 5: Analytics Coverage KPI
- Zone coverage KPI on analytics page
- Cross-zone column in analytics table
- Coverage summary card

### Phase 6: Roster UI Enhancements
- Initials search in referee panel
- Level badge implementation
- Load progress indicator

---

## v1.2 — Quality & Completeness (In Progress)

**3 phases | 13 requirements**

### Phase 7: Competition Edit ✓
- `EditCompetitionDialog` — inline edit form for nombre, tipo, fechas, sede, zona
- Shared validation via `src/lib/competition-validation.ts`
- Edit button in RosterBuilder header (canEdit-gated)
- 403 error handling for wrong-zone delegado

### Phase 8: Test Suite Correctness ✓
- Fixed `ExamType` fixture: `"Teórico"` → `"Nuevo juez"`
- Fixed `ReportType` fixture: `"Desempeño"` → `"Evaluación"`
- Added `subjectType` to `RefereeReport` fixture
- Fixed `RosterSession` fixture: added `nombre`, `categorias`, `horarioCompeticion`, `horarioPesaje`
- Fixed `Referee` fixture: added `ultimo`
- Fixed `RegulationRule` fixtures: added `id` and `note`
- Fixed `ParsedRegistryReferee` fixtures: added 6 required fields
- `npx tsc --noEmit` exits 0

### Phase 9: Refactor + Artifacts (In Progress)
- Splitting `roster-builder.tsx` (1625 lines) into sub-components
- Splitting `supabase-service.ts` (1740 lines) by domain
- Splitting `memory-service.ts` (1118 lines) by domain
- `.planning/MILESTONES.md` created (this file)
