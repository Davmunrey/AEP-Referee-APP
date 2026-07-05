# Requirements — AEP Tarima

> Histórico v1.2 completado en `main`. v1.4–v1.9: compensación, normativa, ayuda, realtime, rendimiento, producción Vercel, censo anual y seguridad.

## v1.9 — Censo anual, selección rápida y seguridad ✅

- [x] **CENSO-01**: Arbitrajes por año natural (parser hojas `ArbitrajesAAAA`, columna `arbitraje_stats_by_year`, migración `032`)
- [x] **CENSO-02**: Ficha de juez con selector de año + Histórico; directorio con filtro de censo por año (vigente vs histórico)
- [x] **COMP-07**: Recibo con organizador de 3 opciones (club / «Asociación Española de Powerlifting» / personalizable, migración `031`); PDF con logo; pie de correo variable
- [x] **ROSTER-01**: Selección rápida aplica solo a jueces disponibles; orden por idoneidad; nivel recomendado como aviso
- [x] **IMPORT-01**: Import Excel maestro «reemplazar censo» seguro (conserva campeonatos, cuadrantes y asignados)
- [x] **SEC-01**: RLS endurecido — eliminadas políticas permisivas en `referee_sanctions` y `competition_availability` (migración `033`)

## v1.8 — Producción, realtime y rendimiento ✅

- [x] **PROD-01**: Plataforma operativa en Vercel (`aep-tarima.vercel.app`)
- [x] **RT-01**: Sincronización en tiempo real (Supabase Realtime + `app_sync_state`)
- [x] **PERF-01**: Optimización consultas Supabase (competición, hub, nav)
- [x] **PERF-02**: Caché TTL zonas/normativa; índices Postgres (`030`)
- [x] **UX-03**: Botón eliminar ubicación domicilio en ficha juez
- [x] **DOC-05**: Todos los `.md` sincronizados v1.8

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

- [ ] **SEC-02**: Activar Leaked Password Protection en Supabase Auth (toggle manual)
- [ ] **TECH-02**: OCR client-side para cuadrantes escaneados (diferido)
- [ ] **E2E-01**: Smoke compensación Playwright
- [ ] **E2E-02**: Flujo profundo import → cuadrante → export
- [ ] **TECH-01**: Sustitución librería `xlsx`

## Out of Scope (cerrado)

- App iOS — descontinuada (migration 028)
- Manual PDF usuario — eliminado; solo `/docs` web
- `tarima.powerliftingspain.es` — sustituido por `aep-tarima.vercel.app`
