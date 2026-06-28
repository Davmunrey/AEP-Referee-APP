# Requirements — AEP Tarima

> Histórico v1.2 completado en `main`. v1.4–v1.7 añadieron compensación, normativa, ayuda y pulido UX.

## v1.7 — Normativa y documentación ✅

- [x] **DOC-01**: URL producción `https://aep-tarima.vercel.app` en código, docs y correos Supabase
- [x] **DOC-02**: Sección Normativa con Guía AEP, plazas, compensación e IPF
- [x] **DOC-03**: Asistente de ayuda con base de conocimiento y guía por rol
- [x] **DOC-04**: Todos los `.md` del repositorio sincronizados con el estado actual
- [x] **UX-01**: Autocomplete domicilio funcional (API servidor Photon)
- [x] **UX-02**: Badges nivel compactos en tarima (R/N/I/II)

## v1.6 — Compensación hub ✅

- [x] **COMP-04**: Panel central `/compensation`
- [x] **COMP-05**: Km manual, comparte, montaje sistema
- [x] **COMP-06**: Listado clubes curados AEP (~180)

## v1.2 — Competition Edit ✅

- [x] **COMP-01**: Editar campeonato existente inline
- [x] **COMP-02**: Validación compartida con alta
- [x] **COMP-03**: Scope zonal en edición

## v1.2 — Test Suite ✅

- [x] **TEST-01** – **TEST-06**: Fixtures corregidos, `tsc` limpio

## v1.2 — Refactoring ✅

- [x] **REFACTOR-01**: `roster-builder.tsx` dividido
- [x] **REFACTOR-02**: `supabase-service.ts` por dominio
- [x] **REFACTOR-03**: `memory-service.ts` por dominio

## Backlog abierto

- [ ] **E2E-01**: Smoke compensación Playwright
- [ ] **E2E-02**: Flujo profundo import → cuadrante → export
- [ ] **TECH-01**: Sustitución librería `xlsx`

## Out of Scope (cerrado)

- App iOS — descontinuada (migration 028)
- Manual PDF usuario — eliminado; solo `/docs` web
- `tarima.powerliftingspain.es` — sustituido por `aep-tarima.vercel.app`
