---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: compensation-hub-osm-docs
status: in_progress
last_updated: "2026-06-28"
last_activity: 2026-06-28 — panel compensación, OSM gratuito, docs y manual PDF actualizados
progress:
  total_phases: 5
  completed_phases: 4
  percent: 80
---

## Current Position

Phase: 08 — Backlog detallado (compensación + docs)
Status: In progress on `main`
Last activity: Hub `/compensation`, OSM, sidebar, manual PDF, 344 tests

## Completed (v1.6)

- Panel central compensación `/compensation` + API `GET /compensation/hub`
- Sidebar: Documentación, Compensación, sin avatar duplicado
- Kilometraje 100 % gratuito (Photon/Nominatim/OSRM)
- Listado 180 clubes AEP + multi-club en recibos
- Manual PDF exportable con capturas actualizadas
- Docs `*.md` sincronizados

## Pending

- E2E smoke compensación
- E2E profundo import → cuadrante → export
- Sustitución librería `xlsx`

## Key Decisions

- IBAN efímero: solo en POST export, nunca en BD
- Compensación gestionada por responsable financiero, no delegados
- Sin Google Maps: stack OSM gratuito
