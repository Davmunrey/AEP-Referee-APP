# Roadmap — AEP Tarima

## v1.6 — Hub compensación y km manual (en curso)

| Área | Entregado |
|---|---|
| Compensación | Panel `/compensation`, hub API, km manual, desglose por posición, montaje ordenador |
| UI | Sidebar Documentación + Compensación, usuario en topbar |
| Docs | Todos los `.md`, manual PDF, capturas `docs/images/` |
| Clubes | 180 clubes AEP en `aep-clubs-registry.json` |

**Pendiente v1.6:** E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## v1.5 — Compensación y UI tarima ✅

| Área | Entregado |
|---|---|
| Supabase prod | Migraciones 023–025 aplicadas |
| Compensación | Servicios, API, UI, export PDF, IBAN efímero |
| RBAC | Rol `responsable_financiero_jueces` |
| UI tarima | Footer fuera de app, panel jueces/slots más densos |
| Docs | README + docs + planning actualizados |

**Pendiente v1.5:** E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## v1.4 — Production Hardening ✅ (Complete)

| Área | Entregado |
|---|---|
| Roster | Plazas requeridas, conflictos misma sesión, * override, merge import parcial |
| Seguridad | Login server-side, PATCH whitelist, sanction bypass bloqueado |
| Privacidad | Dashboard/analytics acotados por zona |
| Robustez | Slot validation, countOpenSlots, TOCTOU assign mitigado |
| Multi-año | `season.ts`, UI sin 2026 hardcodeado |
| Docs | README + docs + planning actualizados |

## v1.2 — Quality & Completeness ✅

Competition edit, test correctness, refactor >500 líneas.

## Backlog — ver plan detallado

**Documento maestro:** [`.planning/phases/08-backlog-detailed/PLAN.md`](./phases/08-backlog-detailed/PLAN.md)

| Bloque | Contenido | Estado |
|---|---|---|
| A | Migraciones 023–025 en Supabase prod | ✅ |
| B | Compensación end-to-end | ✅ (falta E2E) |
| C | UI tarima densa | ✅ |
| D | E2E profundo: import → cuadrante → export | Pendiente |
| E | Sustitución librería `xlsx` | Pendiente |
