# AEP Referee APP — Project

## What This Is

App interna de gestión de jueces AEP: campeonatos, tarimas, cuadrantes, compensación, normativa, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS + Realtime), Tailwind CSS, Radix UI.

**Producción (único entorno de uso):** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

Solo web en Vercel. Sin app iOS. Sin manual PDF en la app.

## Current Milestone: v1.8 — Producción, realtime y rendimiento (Complete)

**Shipped (jun 2026):**

- Plataforma operativa en Vercel — deploy automático desde `main`
- Sincronización en tiempo real (migración `029`, `AppRealtimeSync`)
- Optimización rendimiento (consultas, caché, índices `030`)
- Caché TTL zonas/normativa; filtros SQL árbitros
- Botón eliminar ubicación domicilio en ficha juez
- 331 tests Vitest; migraciones hasta `030` en Supabase prod

**Backlog menor:** E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## Architecture

Next.js App Router (Vercel) → `/api/v1` → `dataService` → Supabase (service role) + RBAC + Realtime.

Ver `docs/ARCHITECTURE.md`.
