# Charter — Auditoría y mejora AEP Referee APP

**Fecha:** 2026-05-17  
**Orquestador:** `@antigravity-skill-orchestrator` + `@concise-planning`  
**Modo:** Fases (auditoría → backlog → implementación)

## Objetivo

App coherente, segura y fácil de usar para operaciones AEP. **Constructor de Tarima** como experiencia principal para **delegado_zona** y **delegado_jueces** por igual.

## Matriz de dominios y skills

| Dominio | Subagente / skill | Artefacto |
|---------|-------------------|-----------|
| UX producto tarima | `ux-researcher-designer`, `frontend-design` | `docs/audit/01-ux-tarima.md` |
| Frontend + a11y | `senior-frontend`, `a11y-audit` | `docs/audit/02-frontend-a11y.md` |
| Backend / API | `senior-backend`, `api-design-reviewer`, `data-quality-auditor` | `docs/audit/03-backend-api.md` |
| Seguridad + QA | `senior-secops`, `senior-qa`, `systematic-debugging` | `docs/audit/04-security-qa.md` |

## Criterios de éxito (medibles)

| ID | Criterio | Métrica |
|----|----------|---------|
| E1 | Encontrar campeonato para montar tarima | ≤ 2 clics desde Dashboard, Campeonatos o Tarimas abiertas |
| E2 | Cobertura visible y accionable | Barra % + huecos listados antes de enviar a aprobación |
| E3 | Normativa clara | Motivo visible si juez no asignable (nivel, sanción, no disponible) |
| E4 | Imports distinguibles | Usuario distingue calendario anual vs horario de campeonato |
| E5 | Calidad | `npm test` + `npm run build` verdes tras cada epic |
| E6 | RBAC | Sin regresión `solo_ver`, zona, eventos pasados solo lectura |

## Reglas de orquestación

- Máx. 4 subagentes en paralelo en auditoría.
- Sin skills en fixes triviales (typos, renombres).
- Fase 1: solo lectura, sin commits de producto.
- Gate humano antes de Fase 3 (backlog P0 aprobado en plan).

## Plantilla de informe por subagente

```markdown
## Informe de auditoría — [DOMINIO]

### Alcance
- Rutas / archivos revisados
- Metodología

### Hallazgos
| ID | Severidad | Hallazgo | Recomendación |
|----|-----------|----------|----------------|
| H-001 | P0/P1/P2/P3 | ... | ... |

### Resumen ejecutivo
- Top 3 riesgos
- Quick wins
```

## Fases de ejecución

| Fase | Entregable | Gate |
|------|-----------|------|
| 0 | Este charter | — |
| 1 | 4 informes en `docs/audit/` | — |
| 2 | `docs/AUDIT-BACKLOG.md` | Revisión P0 |
| 3 | Código por epic | Tests verdes |
| 4 | Verificación adversarial + E2E smoke | DoD |
