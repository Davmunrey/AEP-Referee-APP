---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: production-realtime-perf
status: complete
last_updated: "2026-06-28"
last_activity: 2026-06-28 — realtime, rendimiento, domicilio, docs v1.8
progress:
  total_phases: 6
  completed_phases: 6
  percent: 100
---

## Current Position

Phase: Complete — v1.8 en `main`, producción en Vercel
Last activity: Realtime Supabase, optimización rendimiento, botón eliminar domicilio, documentación total

## Completed (v1.8)

- **Producción Vercel** — plataforma operativa en `aep-tarima.vercel.app` (deploy automático `main`)
- **Realtime** — migración `029` (`app_sync_state` + triggers); `AppRealtimeSync` en shell
- **Rendimiento** — consultas batch, `React.cache`, nav counts ligeros, hub compensación optimizado
- **Caché TTL** — zonas y normativa (1 h, `unstable_cache`)
- **SQL** — filtros en directorio de jueces; índices migración `030`
- **Domicilio** — botón «Eliminar ubicación» (NULL en Supabase)
- Todos los `.md` del repositorio sincronizados a v1.8

## Completed (v1.7)

- URL producción `aep-tarima.vercel.app` en todo el repo y correos Supabase Auth
- Normativa 4 pestañas, asistente ayuda (~35 entradas), geocode OSM, badges tarima
- Migración `028`, branding correos

## Completed (v1.6)

- Panel `/compensation`, km manual, montaje sistema, multi-club, IBAN efímero

## Backlog menor (no bloquea producción)

- E2E smoke compensación
- E2E profundo import → cuadrante → export
- Sustitución librería `xlsx`

## Key Decisions

- Producción solo Vercel + Supabase — usuarios no necesitan entorno local
- Realtime vía `app_sync_state` (versión global), no refetch masivo en cliente
- IBAN efímero: solo en POST export, nunca en BD
- Geocoding: nunca desde cliente (CSP); API propia + Nominatim al guardar
- Documentación: solo web (`/docs` + widget Ayuda)
