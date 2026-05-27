# Requirements — v1.2 AEP Referee APP Quality & Completeness

## Competition Edit

- [ ] **COMP-01**: Usuario puede editar nombre, tipo, fecha inicio, fecha fin, sede y zona de un campeonato existente desde su página de detalle
- [ ] **COMP-02**: Formulario de edición valida todos los campos con las mismas reglas que el formulario de creación
- [ ] **COMP-03**: `delegado_zona` solo puede editar campeonatos de su propia zona; no puede reasignarlo a otra zona; `solo_ver` no puede editar

## Test Suite Correctness

- [ ] **TEST-01**: `judge-stats.test.ts` usa valores válidos de `ExamType` (`"Nuevo juez"`, `"Ascenso IPF"`, `"Recertificación"`) y `ReportType` (`"Evaluación"`)
- [ ] **TEST-02**: `roster-ui.test.ts` — fixture `RosterSession` incluye todos los campos obligatorios: `nombre`, `categorias`, `horarioCompeticion`, `horarioPesaje`
- [ ] **TEST-03**: `roster-ui.test.ts` — fixture `Referee` incluye campo obligatorio `ultimo`
- [ ] **TEST-04**: `roster-ui.test.ts` — fixture `RegulationRule` incluye campos obligatorios `id` y `note`
- [ ] **TEST-05**: `judges-import-preview.test.ts` — fixture de `ParsedRegistryReferee` incluye los 8 campos requeridos (`excelId`, `id`, `nombre`, `nivel`, `zona`, `estado`, `disp`, `eventos`, `ultimo`)
- [ ] **TEST-06**: `npx tsc --noEmit` sale sin errores en toda la suite de tests

## File Refactoring

- [ ] **REFACTOR-01**: `roster-builder.tsx` (1603 líneas) dividido en sub-componentes; cada archivo < 500 líneas; comportamiento externo idéntico
- [ ] **REFACTOR-02**: `supabase-service.ts` (1740 líneas) dividido en módulos por dominio; interfaz pública sin cambios
- [ ] **REFACTOR-03**: `memory-service.ts` (1118 líneas) dividido siguiendo la misma estructura que `supabase-service` refactorizado

## GSD Artifacts

- [ ] **GSD-01**: `MILESTONES.md` creado en `.planning/` con el historial de v1.1 (6 fases, 23 requisitos)

## Out of Scope

- Nuevas funcionalidades de producto (v1.3+)
- Migraciones de base de datos adicionales
- Tests nuevos más allá de corregir los existentes

## Traceability

| REQ-ID | Phase |
|--------|-------|
| COMP-01, COMP-02, COMP-03 | Phase 7 |
| TEST-01 – TEST-06 | Phase 8 |
| REFACTOR-01 – REFACTOR-03 | Phase 9 |
| GSD-01 | Phase 9 |
