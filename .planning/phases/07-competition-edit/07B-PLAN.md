---
plan_id: 07B
phase: "07"
wave: 2
depends_on: [07A]
files_modified:
  - src/components/competitions/edit-competition-dialog.tsx
  - src/components/competitions/roster-builder.tsx
autonomous: true
requirements_addressed: [COMP-01, COMP-02, COMP-03]
---

# Plan 07B: EditCompetitionDialog Component + RosterBuilder Integration

## Objective
Create the `EditCompetitionDialog` component using the shared validation from 07A, and integrate it into `RosterBuilder` with role-based visibility. Satisfies all three requirements: UI editing (COMP-01), shared validation (COMP-02), and role enforcement (COMP-03).

## Tasks

<task id="07B-1">
<title>Create src/components/competitions/edit-competition-dialog.tsx</title>
<read_first>
- src/components/competitions/competition-availability-dialog.tsx — dialog structure pattern (open/onClose props, Dialog/DialogContent/DialogHeader/DialogTitle from Radix UI, useTransition, error state, router.refresh())
- src/components/competitions/new-competition-form.tsx — field layout, FieldError component, SectionDivider, selectFieldClass usage, AEP_COMPETITION_TYPE_DESC usage
- src/lib/competition-validation.ts — FieldErrors interface and validateField (created in 07A)
- src/lib/api/client.ts — api.updateCompetition method (created in 07A)
- src/lib/types.ts — Competition type (id, nombre, tipo, fecha, fechaFin, sede, zona fields)
- src/lib/design-tokens.ts — selectFieldClass constant
- src/lib/aep-guide-2026.ts — AEP_COMPETITION_TYPE_DESC for tipo descriptions
- src/lib/aep-zones.ts — zoneUiName for zona display
</read_first>
<action>
Create src/components/competitions/edit-competition-dialog.tsx with "use client" directive.

Props interface EditCompetitionDialogProps: { competition: Competition; zones: Zone[]; open: boolean; onClose: () => void; }.

State: nombre (string, init: competition.nombre), tipo (string, init: competition.tipo), fecha (string, init: competition.fecha), fechaFin (string, init: competition.fechaFin ?? ""), sede (string, init: competition.sede), zona (string, init: competition.zona). Plus: errors (FieldErrors, init: {}), touched (Set<string>, init: new Set()), globalError (string | null, init: null), pending/startTransition from useTransition.

handleBlur(field): add field to touched set, run validateField(field, value, fecha), set errors.

handleSubmit: validate all fields (nombre, tipo, fecha, fechaFin, sede) using validateField; if any error, set errors and return. Call api.updateCompetition(competition.id, { nombre, tipo, fecha, fechaFin, sede, zona }) inside startTransition. On success: call onClose() then router.refresh(). On error: set globalError to err.message; if response status 403, set globalError to "Sin permiso para editar este campeonato".

Zona field: render as <select> with selectFieldClass, options from zones prop (value=zone.code, label=zoneUiName(zone.code)), disabled always (CONTEXT.md decision — delegado_zona can see but not change zona; only admin can change zona via direct DB).

Dialog structure: Dialog open={open} onOpenChange={onClose}. DialogContent. DialogHeader with DialogTitle "Editar campeonato". Form fields for nombre (Input), tipo (select with AEP_COMPETITION_TYPE_DESC options: "AEP-1", "AEP-2", "AEP-3"), fecha (Input type="date"), fechaFin (Input type="date"), sede (Input), zona (select, disabled). Each field has a FieldError when touched and errors[field] is set. GlobalError at bottom of form. Submit button: disabled when pending, shows Loader2 spinner when pending, label "Guardar cambios". Cancel button calls onClose().

Imports: Dialog/DialogContent/DialogHeader/DialogTitle from "@/components/ui/dialog"; Button from "@/components/ui/button"; Input from "@/components/ui/input"; Loader2/Pencil from "lucide-react"; useRouter from "next/navigation"; useTransition/useState from "react"; api from "@/lib/api/client"; FieldErrors/validateField from "@/lib/competition-validation"; Competition/Zone from "@/lib/types"; selectFieldClass from "@/lib/design-tokens"; zoneUiName from "@/lib/aep-zones"; AEP_COMPETITION_TYPE_DESC from "@/lib/aep-guide-2026".
</action>
<acceptance_criteria>
- src/components/competitions/edit-competition-dialog.tsx exists with "use client" directive
- Component exports EditCompetitionDialog function
- Props include competition: Competition, zones: Zone[], open: boolean, onClose: () => void
- All 6 fields pre-filled from competition prop on open
- Zona field has disabled attribute
- Submit calls api.updateCompetition with PATCH body containing nombre, tipo, fecha, fechaFin, sede, zona
- 403 response sets globalError to "Sin permiso para editar este campeonato"
- On success: onClose() called then router.refresh()
- Loader2 spinner renders on submit button when pending
- npx tsc --noEmit exits 0
</acceptance_criteria>
</task>

<task id="07B-2">
<title>Integrate EditCompetitionDialog into RosterBuilder</title>
<read_first>
- src/components/competitions/roster-builder.tsx — lines 450-480 (competition header, edit button placement); lines 105-125 (existing state declarations); lines 1-61 (imports)
- src/components/competitions/edit-competition-dialog.tsx — just created in 07B-1, check props
</read_first>
<action>
In src/components/competitions/roster-builder.tsx:

1. Add import: import { EditCompetitionDialog } from "@/components/competitions/edit-competition-dialog"; and import { Pencil } from "lucide-react" (check if Pencil already imported; if not, add it to the existing lucide-react import line).

2. Add state: const [editCompetitionOpen, setEditCompetitionOpen] = useState(false); — place after the availabilityOpen state declaration (line ~114).

3. In the JSX header section (near line 468-474, after the h1 with competition.nombre), add an edit button. Render it conditionally only when canEdit is true:
{canEdit && (
  <Button variant="ghost" size="icon" onClick={() => setEditCompetitionOpen(true)} title="Editar campeonato" className="ml-1 h-6 w-6 shrink-0">
    <Pencil className="h-3.5 w-3.5" />
  </Button>
)}

Place the button inline with the h1 by wrapping h1 in a flex div: <div className="flex items-center gap-1">{existing h1}<edit button></div>

4. Render EditCompetitionDialog before the closing tag of the component return, alongside other dialogs:
<EditCompetitionDialog competition={competition} zones={zones} open={editCompetitionOpen} onClose={() => setEditCompetitionOpen(false)} />
</action>
<acceptance_criteria>
- EditCompetitionDialog imported in roster-builder.tsx
- editCompetitionOpen state declared
- Edit button renders only when canEdit is true
- Button has Pencil icon and title "Editar campeonato"
- EditCompetitionDialog rendered with competition, zones, open=editCompetitionOpen, onClose that sets false
- solo_ver (canEdit=false) does not see the edit button
- delegado_zona (canEdit=true for own zone) sees the edit button
- npx tsc --noEmit exits 0
</acceptance_criteria>
</task>

## Verification

```bash
npx tsc --noEmit
```

## must_haves

- `EditCompetitionDialog` component exists and is wired to PATCH /competitions/:id
- Edit button visible only when canEdit=true (COMP-03: solo_ver excluded)
- Zona field always disabled in edit form (COMP-03: delegado_zona cannot reassign zone)
- 403 from API shows "Sin permiso para editar este campeonato" (COMP-03: wrong-zone delegado)
- All 6 fields (nombre, tipo, fecha, fechaFin, sede, zona) pre-filled from competition prop
- Validation reuses validateField from @/lib/competition-validation (COMP-02)
