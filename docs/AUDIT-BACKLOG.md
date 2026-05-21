# Backlog — Auditoría AEP Referee APP

**Síntesis:** Fases 0–1 completadas. Priorización RICE simplificada (Reach × Impact / Effort).

## P0 — Tarima friendly (implementar primero)

| ID | Ítem | RICE | Estado |
|----|------|------|--------|
| P0-1 | Hub "Tarimas abiertas" en `/events` + CTA "Montar tarima" | Alto | Done en Fase 3 |
| P0-2 | Breadcrumb con nombre campeonato | Alto | Done |
| P0-3 | Stepper Plantilla \| Asignación \| Revisión | Alto | Done |
| P0-4 | Split `roster-builder` + `roster-ui` helpers | Medio | Done |
| P0-5 | Copy imports: calendario anual vs horario campeonato | Alto | Done |
| P0-6 | Panel ayuda "Cómo montar una tarima" | Medio | Done |
| P0-7 | Resumen submit (huecos + violaciones) | Alto | Done |
| P0-8 | Motivo inline juez no asignable (nivel, disp, sanción) | Alto | Done |

## P1 — Datos fiables

| ID | Ítem | RICE | Estado |
|----|------|------|--------|
| P1-1 | Tests API roster (assign, submit, template) | Alto | Done (schemas + route guards) |
| P1-2 | Auth en `/regulations` | Medio | Done |
| P1-3 | Mensajes error API en UI (`formatApiError`) | Medio | Done |
| P1-4 | Tests `referee-sanctions` service | Medio | Done (`sanction-mappers`) |
| P1-5 | Badge solo lectura en eventos pasados en lista | Bajo | Done |

## P1 — Campeonatos + jueces

| ID | Ítem | RICE | Estado |
|----|------|------|--------|
| P1-6 | Dedupe UX en import calendario (preview dedupeRemoved) | Medio | Done (copy + preview existente) |
| P1-7 | Filtros zona por defecto según rol delegado | Medio | Done |

## P1 — Import / export unificado (2026-05-17)

| ID | Ítem | RICE | Estado |
|----|------|------|--------|
| IE-1 | Shell `data-transfer` + `import-export-ui` | Alto | Done |
| IE-2 | Calendar + schedule import wizards | Alto | Done |
| IE-3 | Judges import apply=false/true + UI preview | Alto | Done |
| IE-4 | Export roster/analytics con preview dialog | Alto | Done |
| IE-5 | Tests `import-export-ui`, `judges-import-preview` | Medio | Done |

## P2 — Operaciones

| ID | Ítem | RICE |
|----|------|------|
| P2-1 | Aprobaciones inbox mejorado | Medio |
| P2-2 | Dashboard alertas → deep link tarima | Bajo |
| P2-3 | Ascensos / promociones polish | Bajo |
| P2-4 | Gate producción `npm run verify` | Alto |

## P3 — Limpieza

| ID | Ítem | RICE |
|----|------|------|
| P3-1 | Unificar exámenes/informes duplicados en perfil | Bajo |
| P3-2 | Sandbox reports etiquetado | Bajo |

## Gate P0

Backlog P0 ejecutado en Fase 3. P1 cerrado en misma iteración. P2/P3 diferidos — ver `docs/audit/05-verification.md`.

## Fase 4

`npm test` (**142**) y `npm run build` OK. Playwright no configurado en repo.

## Fase 5 — Hardening producción

| ID | Ítem | Estado |
|----|------|--------|
| PR-1 | Script `audit:prod` para auth API, RBAC, imports preview, docs y migraciones | Done |
| PR-2 | Script `verify` como gate único antes de push | Done |
| PR-3 | Documento `docs/PRODUCTION-READINESS.md` con criterio 100% | Done |
| PR-4 | E2E browser real login → tarima → export | Pendiente |
| PR-5 | Validación Supabase remoto + backup/restore | Pendiente |
