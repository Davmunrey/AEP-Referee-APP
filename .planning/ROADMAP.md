# Roadmap — v1.2 AEP Referee APP Quality & Completeness

## Overview

3 phases | 13 requirements | milestone v1.2

| # | Phase | Goal | Requirements |
|---|-------|------|--------------|
| 7 | Competition Edit | UI para editar datos básicos de campeonato | COMP-01, COMP-02, COMP-03 |
| 8 | Test Correctness | Corregir fixtures obsoletos; tsc sin errores | TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06 |
| 9 | Refactor + Artifacts | Dividir archivos >500 líneas + MILESTONES.md | REFACTOR-01, REFACTOR-02, REFACTOR-03, GSD-01 |

## Phase Details

### Phase 7: Competition Edit
**Goal:** Añadir formulario de edición de campeonato a la página de detalle, conectando con el PATCH endpoint existente.
**Requirements:** COMP-01, COMP-02, COMP-03
**Status:** pending
**Success criteria:**
1. Desde `/competitions/[id]` el delegado puede abrir un panel de edición con datos actuales pre-rellenos
2. Guardar actualiza nombre, tipo, fechas, sede y zona en DB
3. `delegado_zona` que intenta editar campeonato de otra zona recibe error 403
4. `solo_ver` no ve el botón de edición
5. Validación idéntica al formulario de creación

### Phase 8: Test Correctness
**Goal:** Eliminar todos los errores de TypeScript en la suite de tests; `npx tsc --noEmit` pasa limpio.
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Status:** pending
**Success criteria:**
1. `npx tsc --noEmit` sale con código 0
2. `npm test` sigue pasando los 155+ tests
3. Fixtures reflejan los tipos actuales del proyecto
4. Sin `as any` ni type-casts espurios en tests

### Phase 9: Refactor + Artifacts
**Goal:** Dividir los tres archivos que superan 500 líneas y crear MILESTONES.md.
**Requirements:** REFACTOR-01, REFACTOR-02, REFACTOR-03, GSD-01
**Status:** pending
**Success criteria:**
1. Ningún archivo en `/src` supera 500 líneas
2. `npm run build` pasa limpio tras el refactor
3. `npm test` sigue pasando tras el refactor
4. `supabase-service` y `memory-service` tienen la misma estructura de módulos
5. `.planning/MILESTONES.md` existe con historial de v1.1
