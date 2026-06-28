# AEP Referee APP — Project

## What This Is

App interna gestión jueces AEP: campeonatos, tarimas, cuadrantes, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Radix UI.
Producción: https://aep-tarima.vercel.app/

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año, etiquetas UI dinámicas (`src/lib/season.ts`).

## Current Milestone: v1.5 — Compensation & UI (In progress)

**Goal:** Compensación de gastos end-to-end, migraciones prod, UI tarima densa.

**Shipped:**
- Migraciones 023–025 en Supabase producción
- Compensación: servicios, API, UI, export PDF, IBAN efímero
- Rol `responsable_financiero_jueces`
- UI tarima densa; footer fuera de dashboard
- 312 tests Vitest

**Pending:** E2E smoke compensación, E2E profundo, sustitución xlsx.

## Previous: v1.4 — Production Hardening (Complete)

Competition edit, test correctness, refactor archivos grandes.

## Architecture

- `/src/app` — Next.js App Router (dashboard + API v1)
- `/src/components` — UI
- `/src/lib` — dominio, parsers, season, roster-rules
- `/src/server` — services, mappers
- `/supabase/migrations` — schema (hasta 025)

## Roles

- `super_admin` / `delegado_jueces` — control total
- `delegado_zona` — su macrozona (dashboard/analytics acotados)
- `responsable_financiero_jueces` — compensación y recibos PDF
- `solo_ver` — lectura
