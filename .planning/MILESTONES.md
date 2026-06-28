# Milestones — AEP Tarima

## v1.8 — Producción Vercel, realtime y rendimiento (2026-06)

- Plataforma operativa en **https://aep-tarima.vercel.app** (deploy automático)
- Realtime Supabase (`app_sync_state`, migración 029)
- Rendimiento: consultas batch, React.cache, nav counts, hub compensación
- Caché TTL zonas/normativa; filtros SQL jueces; índices (migración 030)
- Botón eliminar ubicación domicilio
- 331 tests; documentación completa v1.8

## v1.7 — Normativa, docs y pulido UX (2026-06)

- URL oficial `aep-tarima.vercel.app`
- Normativa 4 pestañas + panel compensación normativa
- Asistente ayuda completo (KB + quick-start + Gemini)
- Geocode autocomplete vía API servidor
- Badges nivel compactos en tarima
- Migración 028, correos Supabase branding

## v1.6 — Compensation Hub & km manual (2026-06)

- Panel `/compensation` + API hub
- Km manual, comparte, montaje sistema
- ~180 clubes AEP, multi-club
- Migraciones 026–027

## v1.5 — Compensation & UI (2026-06)

- Migraciones 023–025 en Supabase producción
- Compensación end-to-end, IBAN efímero
- Rol `responsable_financiero_jueces`
- UI tarima densa

## v1.4 — Production Hardening (2025-06)

- Roster: plazas requeridas, conflictos, imprevistos
- Privacidad zonal, login server-side
- Multi-temporada (`season.ts`)

## v1.1 — Completeness & Workflow (2025-05)

Cross-zone assignment, template editor, PDF imports, availability per competition, analytics coverage, roster UI enhancements.

## v1.2 — Quality & Completeness

Competition edit, test correctness, refactor archivos >500 líneas.
