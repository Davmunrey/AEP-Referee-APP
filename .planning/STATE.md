---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: compensation-and-ui
status: in_progress
last_updated: "2026-06-28"
last_activity: 2026-06-28 — compensación E2E (servicios, API, UI), migraciones 023–025 en prod, tarima densa
progress:
  total_phases: 5
  completed_phases: 3
  percent: 60
---

## Current Position

Phase: 08 — Backlog detallado (compensación + UI tarima)
Status: In progress on `main`
Last activity: Migraciones 023–025 aplicadas en Supabase prod; compensación servicios+API+UI; tarima densa; 312 tests

## Completed (v1.5 parcial)

- Supabase prod: `023` review_comment, `024` judge_compensation, `025` financial_role_and_receipt
- Compensación: lib baremo, servicios supabase/memoria, API CRUD+export, UI board+modal IBAN
- Rol `responsable_financiero_jueces` + enlace compensación en cabecera tarima
- UI tarima: footer fuera de dashboard, cards/slots más densos
- Ficha juez: campo domicilio
- Docs: README + `docs/*` actualizados

## Pending

- E2E smoke `compensation.spec.ts`
- E2E profundo import → cuadrante → export
- Sustitución librería `xlsx`

## Key Decisions

- IBAN efímero: solo en POST export, nunca en BD
- Compensación gestionada por responsable financiero, no delegados
- Temporada deportiva: julio+ → etiqueta año siguiente (`currentSeasonYear`)

## Blockers/Concerns

None for current release. E2E compensación y xlsx en backlog.
