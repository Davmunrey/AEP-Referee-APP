---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: centro-ayuda-local-sin-ia
status: complete
last_updated: "2026-07-06"
last_activity: julio 2026 — centro de ayuda 100 % local (retirada del asistente IA), título de pestaña «AEP Tarima», triaje de errores de Sentry
progress:
  total_phases: 6
  completed_phases: 6
  percent: 100
---

## Current Position

Phase: Complete — v2.0 en `main`, producción en Vercel
Last activity: Rediseño del centro de ayuda como buscador local sobre la base de conocimiento (sin IA), retirada del asistente Gemini, título de pestaña simplificado y triaje de errores de Sentry

## Completed (v2.0)

- **Centro de ayuda local** — widget rediseñado: buscador sobre la base de conocimiento (~35 temas) + primeros pasos por rol + temas frecuentes. Todo en cliente, sin IA ni red
- **Retirada del asistente IA** — eliminados la ruta `POST /api/v1/assistant`, el cliente Gemini, el prompt de anclaje y el rate-limit; base de conocimiento conservada para el buscador local
- **Título de pestaña** — «AEP Tarima» (antes «AEP Tarima — Gestión de Jueces»)
- **Sentry** — 3 issues del 28-jun triados y resueltos (PGRST204 transitorio de la migración 027 y ENOENT de pdfkit ya corregido con `serverExternalPackages`); ruido del refresh token en middleware capturado (PR #69)
- 337 tests Vitest (338 con 1 skip), 59 archivos

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
