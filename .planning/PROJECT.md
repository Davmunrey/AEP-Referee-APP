# AEP Referee APP — Project

## What This Is

App interna de gestión de jueces AEP: campeonatos, tarimas, cuadrantes, compensación, normativa, ascensos, sanciones, estadísticas.

Stack: Next.js 15, TypeScript, Supabase (Postgres + Auth + RLS + Realtime), Tailwind CSS, Radix UI.

**Producción (único entorno de uso):** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

Solo web en Vercel. Sin app iOS. Sin manual PDF en la app.

## Current Milestone: v2.0 — Centro de ayuda local, sin IA (Complete)

**Shipped (jul 2026):**

- Centro de ayuda rediseñado: buscador local sobre la base de conocimiento (~35 temas) + primeros pasos por rol + temas frecuentes; 100 % en cliente, sin IA ni red
- Retirada del asistente IA (ruta `POST /api/v1/assistant`, cliente Gemini, prompt de anclaje y rate-limit); base de conocimiento conservada
- Título de pestaña simplificado a «AEP Tarima»
- Triaje de Sentry: 3 issues del 28-jun resueltos; refresh token del middleware capturado (PR #69)
- 337 tests Vitest (338 con 1 skip), 59 archivos; migraciones hasta `033` en Supabase prod

**Anterior (v1.9):** censo por año natural (migración `032`), recibo con organizador personalizable (`031`), selección rápida subordinada a disponibilidad, import Excel «reemplazar censo» seguro, RLS endurecido (`033`).

**Backlog menor:** activar Leaked Password Protection (toggle Supabase Auth), OCR client-side (diferido), E2E smoke compensación, E2E profundo, sustitución `xlsx`.

## Architecture

Next.js App Router (Vercel) → `/api/v1` → `dataService` → Supabase (service role) + RBAC + Realtime.

Ver `docs/ARCHITECTURE.md`.
