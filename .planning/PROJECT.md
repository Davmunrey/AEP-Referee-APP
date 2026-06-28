# AEP Referee APP — Project

## What This Is

App interna de gestión de jueces AEP: campeonatos, tarimas, cuadrantes, compensación, normativa, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Radix UI.

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

Solo web. Sin app iOS. Sin manual PDF en la app.

## Current Milestone: v1.7 — Docs, normativa y pulido UX (Complete)

**Shipped (jun 2026):**

- URL oficial `aep-tarima.vercel.app` en app, correos Supabase y documentación
- Normativa `/regulations` — 4 pestañas (Guía AEP, plazas, compensación, IPF)
- Asistente de ayuda completo (~35 entradas KB + guía por rol + Gemini opcional)
- Autocomplete domicilio vía API servidor (fix CSP + Photon)
- Badges nivel compactos en tarima (R/N/I/II)
- Migraciones hasta `028`, branding correos aplicado
- 331 tests Vitest

**Pending backlog:** E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## Architecture

Next.js App Router → `/api/v1` → `dataService` → Supabase (service role) + RBAC.

Ver `docs/ARCHITECTURE.md`.
