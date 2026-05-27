# AEP Referee APP — Project

## What This Is
App interna gestión jueces AEP: campeonatos, tarimas, cuadrantes, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS), Tailwind CSS, Radix UI.
Producción: https://aep-tarima.vercel.app/

## Current Milestone: v1.2 — Quality & Completeness

**Goal:** Eliminar gaps funcionales, errores de tipos en tests, y archivos sobredimensionados para que el código sea correcto y mantenible.

**Target features:**
- Competition edit — formulario para editar datos básicos de campeonato después de crearlo
- Test type correctness — corregir fixtures obsoletos que fallan tsc
- File refactoring — dividir roster-builder, supabase-service y memory-service (>500 líneas)
- GSD artifacts — crear MILESTONES.md para tracking de historial

## Previous Milestone: v1.1 — Full Feature Upgrade (Complete)

**Goal:** Añadir selección cross-zona, creación manual horarios, mejoras importación y UX.

**Features shipped:**
- Cross-zone judge selection — jueces de fuera de zona con flag visual y workflow
- Schedule builder — crear/editar horarios manualmente (sin PDF)
- Import improvements — reconocer todos los campos de Excel/PDF
- Judge availability (per-competition) — disponibilidad por competición vía WhatsApp
- Analytics enhancements — cross-zona, KPI cobertura nacional
- UX refinements — filtros, badges, warnings mejorados

## Architecture
- `/src/app` — Next.js App Router (dashboard + API v1)
- `/src/components` — UI components (competitions, referees, aep, ui)
- `/src/lib` — types, permissions, roster-rules, schedule-parser, validations
- `/src/server` — services, DB mappers
- `/supabase/migrations` — schema migrations

## Roles
- `super_admin` / `delegado_jueces` — control total
- `delegado_zona` — su zona únicamente (jueces, tarimas, informes)
- `solo_ver` — solo lectura

## Zones (5 macro)
NOROESTE, CENTRO, MEDITERRANEO, ANDALUCIA, CANARIAS
