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

## P2 — Operaciones

| ID | Ítem | RICE |
|----|------|------|
| P2-1 | Aprobaciones inbox mejorado | Medio |
| P2-2 | Dashboard alertas → deep link tarima | Bajo |
| P2-3 | Ascensos / promociones polish | Bajo |

## P3 — Limpieza

| ID | Ítem | RICE |
|----|------|------|
| P3-1 | Unificar exámenes/informes duplicados en perfil | Bajo |
| P3-2 | Sandbox reports etiquetado | Bajo |

## Gate P0

Backlog P0 ejecutado en Fase 3. P1 cerrado en misma iteración. P2/P3 diferidos — ver `docs/audit/05-verification.md`.

## Fase 4

`npm test` (132) y `npm run build` OK. Playwright no configurado en repo.
