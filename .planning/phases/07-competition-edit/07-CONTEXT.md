# Phase 7: Competition Edit - Context

**Gathered:** 2026-05-27
**Status:** Completed (shipped on `main`). Superseded by v1.4–v1.7 hardening, compensación y normativa — ver `docs/AUDIT.md` y `.planning/STATE.md`.

<domain>
## Phase Boundary

Add competition edit capability to the detail page (`/competitions/[id]`). Connects to the existing PATCH `/api/v1/competitions/[id]` endpoint which already handles role-based authorization (403 for `delegado_zona` editing wrong zone, 403 for `solo_ver`). UI allows editing nombre, tipo, fechas, sede, and zona.

</domain>

<decisions>
## Implementation Decisions

### Component Architecture
- Dialog pattern — matches `CompetitionAvailabilityDialog`, `ScheduleImportDialog`, `QuadrantImportDialog` established pattern
- New `EditCompetitionDialog` component file at `src/components/competitions/edit-competition-dialog.tsx`
- Edit button placed in RosterBuilder header near competition title/info (not in RosterHeaderActions which is roster-specific)
- Button: Pencil icon + "Editar" label

### Editable Fields Scope
- Exactly COMP-01 fields: nombre, tipo (AEP-1/2/3), fecha inicio, fecha fin, sede, zona
- `sesiones` and `requeridos` are NOT editable in this form
- Zona field shown but disabled for `delegado_zona` — can see current zone, cannot change it
- Validation logic extracted to shared file `src/lib/competition-validation.ts` and imported in both `new-competition-form.tsx` and `EditCompetitionDialog`

### Post-save UX
- On success: close dialog then call `router.refresh()` to reload fresh data
- Error display: global error message at bottom of form (matches `new-competition-form.tsx` pattern)
- Loading state: disable submit button + Loader2 spinner on submit button

### Claude's Discretion
- Pre-fill all fields from `competition` prop passed to dialog
- Dialog title: "Editar campeonato"
- Error message for 403 from API: "Sin permiso para editar este campeonato"

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `new-competition-form.tsx` — validateField logic, FieldErrors interface, form patterns, SectionDivider, FieldError components
- `competition-availability-dialog.tsx` — dialog structure pattern to follow
- `@/components/ui/button`, `@/components/ui/input` — established UI primitives
- `@/lib/api/client` — `api` object for HTTP calls (need to add `updateCompetition` method)
- `selectFieldClass` from `@/lib/design-tokens` — for zona/tipo selects
- `AEP_COMPETITION_TYPE_DESC` from `@/lib/aep-guide-2026` — for tipo description
- Lucide icons: Pencil (edit trigger), Loader2 (loading), AlertCircle (errors)

### Established Patterns
- Dialog components: `open/onClose` props, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` from Radix UI
- Form validation: `validateField(field, value, fechaStart)` + touched set + `FieldErrors` state
- Role visibility: `canEdit` prop from `canEditRoster(user, competition.zona)` already in `RosterBuilder`
- Client components: `"use client"` directive, `useRouter` for navigation

### Integration Points
- `RosterBuilder` receives `competition`, `canEdit`, `zones` props — all needed for edit dialog
- `competition.zona`, `competition.nombre`, `competition.tipo`, `competition.fecha`, `competition.fechaFin`, `competition.sede` — fields to pre-fill
- `api` client needs a new `updateCompetition(id, data)` method calling `PATCH /api/v1/competitions/:id`
- `revalidatePath` already called in PATCH route handler — `router.refresh()` on client side is sufficient

</code_context>

<specifics>
## Specific Ideas

- The `validateField` function in `new-competition-form.tsx` should be moved to `src/lib/competition-validation.ts` and re-exported. `new-competition-form.tsx` imports from there. `EditCompetitionDialog` also imports from there.
- No `sesiones`/`requeridos` fields in edit form — these are out of scope per COMP-01.
- `solo_ver` should not see the edit button — checked via `canEdit` prop which is already `false` for `solo_ver`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
