# Roadmap — AEP Tarima

## v1.4 — Production Hardening ✅ (Complete)

| Área | Entregado |
|---|---|
| Roster | Plazas requeridas, conflictos misma sesión, * override, merge import parcial |
| Seguridad | Login server-side, PATCH whitelist, sanction bypass bloqueado |
| Privacidad | Dashboard/analytics acotados por zona |
| Robustez | Slot validation, countOpenSlots, TOCTOU assign mitigado |
| Multi-año | `season.ts`, UI sin 2026 hardcodeado |
| Docs | README + docs + iOS + planning actualizados |

## v1.2 — Quality & Completeness ✅

Competition edit, test correctness, refactor >500 líneas.

## Próximo (backlog) — ver plan detallado

**Documento maestro:** [`.planning/phases/08-backlog-detailed/PLAN.md`](./phases/08-backlog-detailed/PLAN.md)

| Bloque | Contenido |
|---|---|
| A | Aplicar migración 023 en Supabase prod (review_comment ascensos) |
| B | Compensación end-to-end (servicios, UI, IBAN efímero) |
| C | UI tarima densa (footer fuera de app, panel jueces, cuadrante) |
| D | E2E profundo: import → cuadrante → export |
| E | Sustitución librería `xlsx` |

Orden: **A → C → B → D** (E en paralelo bajo demanda).
