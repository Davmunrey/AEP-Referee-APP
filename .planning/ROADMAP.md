# Roadmap — AEP Tarima

Producción: [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

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
| E2E smoke compensación | Pendiente |
| E2E profundo import → export | Pendiente |
| Sustitución `xlsx` | Pendiente |

Plan detallado: [`.planning/phases/08-backlog-detailed/PLAN.md`](./phases/08-backlog-detailed/PLAN.md)
