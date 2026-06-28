# AEP Referee APP — Project

## What This Is

App interna gestión jueces AEP: campeonatos, tarimas, cuadrantes, compensación, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Radix UI.
Producción: https://aep-tarima.vercel.app/

## Current Milestone: v1.6 — Compensation Hub & km manual (In progress)

**Shipped:**
- Panel `/compensation`, API hub, sidebar actualizado
- OpenStreetMap gratuito (sin Google Maps)
- Manual PDF exportable con capturas
- Migraciones hasta `026`, 180 clubes AEP
- 344 tests Vitest

**Pending:** E2E smoke compensación, E2E profundo, sustitución xlsx.

## Architecture

Next.js App Router → `/api/v1` → `dataService` → Supabase (service role) + RBAC.

Ver `docs/ARCHITECTURE.md`.
