---
plan_id: 07A
phase: "07"
wave: 1
depends_on: []
files_modified:
  - src/lib/competition-validation.ts
  - src/components/competitions/new-competition-form.tsx
  - src/lib/api/client.ts
autonomous: true
requirements_addressed: [COMP-01, COMP-02]
---

# Plan 07A: Shared Validation + API Client Method

> **Histórico — completado.** Referencia de implementación v1.2. Estado actual: `docs/GUIA-USO.md`, `docs/API.md`.

## Objective
Extract `validateField` and `FieldErrors` from `new-competition-form.tsx` into a shared `competition-validation.ts` lib file. Add `updateCompetition` to the api client. This enables `EditCompetitionDialog` (07B) to reuse identical validation without duplicating logic.

## Tasks

<task id="07A-1">
<title>Extract validateField to src/lib/competition-validation.ts</title>
<read_first>
- src/components/competitions/new-competition-form.tsx — current validateField implementation and FieldErrors interface to copy verbatim
</read_first>
<action>
Create src/lib/competition-validation.ts. Export: (1) FieldErrors interface matching new-competition-form.tsx's current definition (fields: nombre, fecha, fechaFin, sede, sesiones, requeridos — all optional strings). (2) validateField(field: string, value: string, fechaStart?: string): string | undefined — exact copy of the current function body from new-competition-form.tsx. No other exports.
</action>
<acceptance_criteria>
- src/lib/competition-validation.ts exists
- File exports FieldErrors interface and validateField function
- validateField logic is byte-for-byte identical to current new-competition-form.tsx implementation
- TypeScript: no type errors (string | undefined return type explicit)
</acceptance_criteria>
</task>

<task id="07A-2">
<title>Update new-competition-form.tsx to import from shared lib</title>
<read_first>
- src/components/competitions/new-competition-form.tsx — lines defining FieldErrors and validateField (to remove)
- src/lib/competition-validation.ts — just created in 07A-1
</read_first>
<action>
In new-competition-form.tsx: (1) Remove the FieldErrors interface definition. (2) Remove the validateField function definition. (3) Add import { FieldErrors, validateField } from "@/lib/competition-validation" at the top, after existing imports. Behavior must be identical — no other changes.
</action>
<acceptance_criteria>
- new-competition-form.tsx no longer defines FieldErrors or validateField inline
- new-competition-form.tsx imports both from "@/lib/competition-validation"
- npx tsc --noEmit exits 0
- No runtime behavior change — form still validates identically
</acceptance_criteria>
</task>

<task id="07A-3">
<title>Add updateCompetition to api client</title>
<read_first>
- src/lib/api/client.ts — find createCompetition (line ~108) to use as structural template; understand the request() helper signature
- src/lib/types.ts — Competition type fields (id, nombre, tipo, fecha, fechaFin, sede, zona)
</read_first>
<action>
In src/lib/api/client.ts, after the getCompetition entry (line ~111), add: updateCompetition: (id: string, body: Partial&lt;Pick&lt;Competition, "nombre" | "tipo" | "fecha" | "fechaFin" | "sede" | "zona"&gt;&gt;) => request&lt;Competition&gt;(`/competitions/${id}`, { method: "PATCH", body: JSON.stringify(body) })
</action>
<acceptance_criteria>
- src/lib/api/client.ts contains updateCompetition method
- Method calls PATCH /competitions/${id} with body JSON
- Return type is Promise&lt;Competition&gt;
- npx tsc --noEmit exits 0
</acceptance_criteria>
</task>

## Verification

```bash
npx tsc --noEmit
```

## must_haves

- validateField logic is identical in shared lib to original (no regression in new-competition-form.tsx)
- api.updateCompetition hits PATCH /competitions/:id
- No duplicate FieldErrors or validateField definitions anywhere in codebase
