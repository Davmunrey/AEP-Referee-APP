---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: compensation-hub-manual-km
status: in_progress
last_updated: "2026-06-28"
last_activity: 2026-06-28 — km manual, comparte solo exime km, posición tarima, montaje ordenador
progress:
  total_phases: 5
  completed_phases: 4
  percent: 80
---

## Current Position

Phase: 08 — Backlog detallado (compensación + docs)
Status: In progress on `main`
Last activity: Hub `/compensation`, km manual, posición tarima, montaje ordenador, docs

## Completed (v1.6)

- Panel central compensación `/compensation` + API `GET /compensation/hub`
- Sidebar: Documentación, Compensación, sin avatar duplicado
- Km manual en compensación (comparte solo exime kilometraje, no alojamiento)
- Desglose por posición en tarima (Central, Pesaje, Lateral…)
- Montaje del ordenador como pago aparte (`is_computer_setup`)
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
- Comparte vehículo: sin cobro km, pero km obligatorios para alojamiento
