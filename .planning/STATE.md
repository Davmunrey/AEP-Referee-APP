---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: docs-normativa-ux-polish
status: complete
last_updated: "2026-06-28"
last_activity: 2026-06-28 — docs *.md, normativa, asistente, geocode, badges tarima
progress:
  total_phases: 6
  completed_phases: 6
  percent: 100
---

## Current Position

Phase: Complete — v1.7 en `main`
Last activity: Actualización total documentación, normativa compensación, asistente, geocode OSM, badges compactos

## Completed (v1.7)

- URL producción `aep-tarima.vercel.app` en todo el repo y correos Supabase Auth
- Sección **Normativa** con 4 pestañas incl. compensación jueces
- Asistente de ayuda: `knowledge-base.ts` (~35 entradas), `quick-start.ts`, widget Ayuda
- `GET /api/v1/geocode/search` — autocomplete domicilio (Photon servidor, fix CSP)
- Badges nivel abreviados en tarima (R, N, I, II)
- Migración `028` (drop device_tokens)
- Todos los `.md` del repositorio sincronizados

## Completed (v1.6)

- Panel `/compensation`, km manual, desglose por posición, montaje sistema
- 180 clubes AEP curados, multi-club en recibos
- IBAN efímero en export PDF

## Pending (backlog)

- E2E smoke compensación
- E2E profundo import → cuadrante → export
- Sustitución librería `xlsx`

## Key Decisions

- IBAN efímero: solo en POST export, nunca en BD
- Compensación: rol `responsable_financiero_jueces`
- Geocoding: nunca desde cliente (CSP); API propia + Nominatim al guardar
- Documentación: solo web (`/docs` + widget Ayuda), no manual PDF
