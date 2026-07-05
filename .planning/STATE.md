---
gsd_state_version: 1.0
milestone: v1.9
milestone_name: censo-anual-seleccion-rapida-seguridad
status: complete
last_updated: "2026-07-05"
last_activity: julio 2026 — arbitrajes por año natural, recibo personalizable, selección rápida por disponibilidad, import seguro del censo, RLS endurecido
progress:
  total_phases: 6
  completed_phases: 6
  percent: 100
---

## Current Position

Phase: Complete — v1.9 en `main`, producción en Vercel
Last activity: Arbitrajes por año natural (censo vigente vs histórico), recibo de compensación con organizador personalizable, selección rápida limitada a jueces disponibles, reemplazo seguro del censo y endurecimiento RLS

## Completed (v1.9)

- **Arbitrajes por año natural** — parser lee todas las hojas `ArbitrajesAAAA`; columna `referees.arbitraje_stats_by_year` (migración `032`); ficha de juez con selector de año + Histórico; directorio con filtro de censo por año (censo vigente vs histórico)
- **Recibo de compensación** — organizador con 3 opciones (club / «Asociación Española de Powerlifting» / personalizable, migración `031`); PDF con logo; correos de pie variables
- **Selección rápida de jueces** — aplica solo a los disponibles (tras aplicar disponibilidad); ordena por idoneidad; nivel recomendado como aviso, no como filtro duro
- **Import Excel maestro «reemplazar censo» seguro** — no borra campeonatos ni cuadrantes; conserva jueces asignados
- **Seguridad** — RLS endurecido: migración `033` elimina políticas permisivas en `referee_sanctions` y `competition_availability`
- **Verificación de datos** con Supabase (PR #48)
- 354 tests Vitest (355 con 1 skip), 61 archivos; migraciones hasta `033` en Supabase producción

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

- **Activar Leaked Password Protection** en Supabase Auth (toggle manual; único pendiente de seguridad)
- OCR client-side para cuadrantes escaneados (diferido)
- E2E smoke compensación
- E2E profundo import → cuadrante → export
- Sustitución librería `xlsx`

## Key Decisions

- Producción solo Vercel + Supabase — usuarios no necesitan entorno local
- Realtime vía `app_sync_state` (versión global), no refetch masivo en cliente
- IBAN efímero: solo en POST export, nunca en BD
- Geocoding: nunca desde cliente (CSP); API propia + Nominatim al guardar
- Documentación: solo web (`/docs` + widget Ayuda)
- Censo por año: arbitrajes almacenados por año natural (`arbitraje_stats_by_year`); censo «vigente» vs «histórico» filtrable
- Selección rápida: siempre subordinada a la disponibilidad declarada; el nivel recomendado es aviso, no filtro excluyente
- Import «reemplazar censo»: nunca destruye campeonatos/cuadrantes ni pierde asignados
- RLS: sin políticas permisivas (`033`); acceso siempre acotado por rol/zona
