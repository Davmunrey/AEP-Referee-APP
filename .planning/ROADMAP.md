# Roadmap — AEP Tarima

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) — deploy automático en Vercel desde `main`.

## v1.9 — Censo anual, selección rápida y seguridad ✅

| Área | Entregado |
|---|---|
| Censo por año | Parser hojas `ArbitrajesAAAA`; columna `arbitraje_stats_by_year` (migración `032`); ficha con selector de año + Histórico; directorio con filtro de censo por año |
| Compensación | Recibo con organizador de 3 opciones (club / «Asociación Española de Powerlifting» / personalizable, migración `031`); PDF con logo; pie de correo variable |
| Selección rápida | Aplica solo a jueces disponibles; orden por idoneidad; nivel recomendado como aviso |
| Import | «Reemplazar censo» seguro: conserva campeonatos, cuadrantes y asignados |
| Seguridad | RLS endurecido (migración `033`, elimina políticas permisivas) |
| Tests | 354 pasan (355 con 1 skip), 61 archivos |

## v1.8 — Producción, realtime y rendimiento ✅

| Área | Entregado |
|---|---|
| Vercel | Plataforma operativa; usuarios acceden solo vía web |
| Realtime | Migración `029` (`app_sync_state`); sync entre usuarios |
| Rendimiento | Consultas optimizadas, React.cache, hub batch, nav counts |
| Caché | Zonas y normativa TTL 1 h |
| DB | Índices migración `030` |
| UX | Botón eliminar ubicación domicilio |
| Docs | Todos los `.md` v1.8 |

## v1.7 — Normativa, docs y UX ✅

| Área | Entregado |
|---|---|
| URL | `aep-tarima.vercel.app` en app, Vercel, Supabase Auth, correos |
| Normativa | `/regulations` — Guía AEP, plazas, compensación, IPF |
| Ayuda | Asistente ~35 entradas, guía por rol, Gemini opcional |
| Geocode | `/api/v1/geocode/search` (Photon servidor) |
| Tarima UX | Badges nivel compactos R/N/I/II |
| Docs | Todos los `.md` actualizados |
| DB | Migración `028` (drop device_tokens) |

## v1.6 — Hub compensación y km manual ✅

| Área | Entregado |
|---|---|
| Compensación | Panel `/compensation`, km manual, montaje sistema |
| Clubes | ~180 clubes curados AEP |
| UI | Sidebar Documentación + Compensación |

## v1.5 — Compensación y UI tarima ✅

Migraciones 023–027, rol financiero, export PDF IBAN efímero.

## v1.4 — Production Hardening ✅

Roster rules, privacidad zonal, login server-side, multi-temporada.

## Backlog

| Ítem | Estado |
|---|---|
| Activar Leaked Password Protection (Supabase Auth) | Pendiente (toggle manual) |
| OCR client-side cuadrantes escaneados | Diferido |
| E2E smoke compensación | Pendiente |
| E2E profundo import → export | Pendiente |
| Sustitución `xlsx` | Pendiente |

Plan detallado: [`.planning/phases/08-backlog-detailed/PLAN.md`](./phases/08-backlog-detailed/PLAN.md)
