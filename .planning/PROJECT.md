# AEP Referee APP — Project

## What This Is

App interna de gestión de jueces AEP: campeonatos, tarimas, cuadrantes, compensación, normativa, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS + Realtime), Tailwind CSS, Radix UI.

**Producción (único entorno de uso):** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

Solo web en Vercel. Sin app iOS. Sin manual PDF en la app.

## Current Milestone: v1.9 — Censo anual, selección rápida y seguridad (Complete)

**Shipped (jul 2026):**

- Arbitrajes por año natural: censo vigente vs histórico (migración `032`), selector de año en ficha y filtro en directorio
- Recibo de compensación con organizador personalizable (migración `031`), PDF con logo y pie de correo variable
- Selección rápida de jueces subordinada a la disponibilidad; nivel recomendado como aviso
- Import Excel maestro «reemplazar censo» seguro (conserva campeonatos, cuadrantes y asignados)
- Seguridad: RLS endurecido (migración `033`)
- 354 tests Vitest (355 con 1 skip), 61 archivos; migraciones hasta `033` en Supabase prod

**Backlog menor:** activar Leaked Password Protection (toggle Supabase Auth), OCR client-side (diferido), E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## Architecture

Next.js App Router (Vercel) → `/api/v1` → `dataService` → Supabase (service role) + RBAC + Realtime.

Ver `docs/ARCHITECTURE.md`.
