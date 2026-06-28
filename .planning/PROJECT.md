# AEP Referee APP — Project

## What This Is

App interna gestión jueces AEP: campeonatos, tarimas, cuadrantes, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Radix UI.
Producción: https://aep-tarima.vercel.app/

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año, etiquetas UI dinámicas (`src/lib/season.ts`).

## Current Milestone: v1.4 — Production Hardening (Complete)

**Goal:** Auditoría completa, privacidad zonal, robustez roster/auth, multi-año, documentación al día.

**Shipped:**
- Roster: plazas requeridas, conflictos sesión, confirm-to-force *, merge import horario
- Zone scoping dashboard/analytics para `delegado_zona`
- Login server-side + rate-limit endurecido
- Validación slot keys, countOpenSlots sin huérfanos, revalidación assign (TOCTOU)
- Comentario rechazo ascensos (`review_comment`, migration 023)
- 298 tests Vitest

## Previous: v1.2 — Quality & Completeness (Complete)

Competition edit, test correctness, refactor archivos grandes.

## Architecture

- `/src/app` — Next.js App Router (dashboard + API v1)
- `/src/components` — UI
- `/src/lib` — dominio, parsers, season, roster-rules
- `/src/server` — services, mappers
- `/supabase/migrations` — schema (hasta 023)

## Roles

- `super_admin` / `delegado_jueces` — control total
- `delegado_zona` — su macrozona (dashboard/analytics acotados)
- `solo_ver` — lectura
