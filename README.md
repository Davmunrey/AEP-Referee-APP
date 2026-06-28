<h1 align="center">AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa interna para la gestión de jueces AEP</strong><br/>
  Campeonatos · Tarimas · Cuadrantes · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/producción-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v1.4-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-298%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js%2015-black?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind%20CSS-06b6d4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
</p>

---

## ¿Qué es?

AEP Tarima centraliza toda la operativa de jueces de la Asociación Española de Powerlifting: desde la creación de campeonatos hasta la asignación de tarimas, pasando por exámenes, informes de rendimiento, ascensos y estadísticas nacionales.

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año detectado y etiquetas de UI derivadas del calendario actual (`src/lib/season.ts`), sin acoplar la app a un año fijo.

- **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- **Import inteligente** de horarios y cuadrantes desde PDF con preview y selección granular antes de aplicar.
- **Asignación visual** con validación de roles, zonas, solapamientos y confirmación para forzar conflictos (*).
- **Plazas requeridas** resumidas por área (tarima, mesa, control, pesaje).
- **Disponibilidad por campeonato** — confirma jueces, filtra solo confirmados en tarima.
- **Cruce de zonas** — detecta y marca jueces asignados fuera de su zona habitual.
- **Analytics multi-año** — histórico anual, cobertura, carga de trabajo, export CSV.
- **Privacidad zonal** — delegados de zona ven solo datos de su macrozona en dashboard y estadísticas.

---

## De un vistazo

| Área | Capacidades |
|---|---|
| **Campeonatos** | Creación manual, import calendario anual PDF/CSV, edición inline, deduplicación |
| **Tarima** | Plantilla por tipo/campeonato, import horario PDF (merge parcial), import cuadrante PDF (4 formatos AEP), drag-and-drop, flags *, borrador → aprobación |
| **Export cuadrante** | PDF formato oficial AEP, Excel, compartir por WhatsApp |
| **Jueces** | Directorio, ficha completa, sanciones, disponibilidad, historial de tarimas |
| **Disponibilidad** | Por campeonato, confirmación manual, filtro "solo confirmados" |
| **Cross-zone** | Auto-detección servidor, badge naranja, columna analytics, banner en tarima |
| **Exámenes** | IPF, recertificación, nuevo juez |
| **Informes** | Por juez o competición, visibilidad por zona o nacional |
| **Ascensos** | Solicitud, revisión nacional con comentario de rechazo obligatorio |
| **Analytics** | Histórico anual, KPIs, cobertura zonal/nacional, export CSV |
| **Usuarios** | Gestión de roles, reset de contraseñas |
| **Auth** | Login server-side con rate-limit (`POST /auth/login`) |

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Equivalente operativo a superadmin |
| `delegado_zona` | Jueces, informes y tarimas de su zona (dashboard y analytics acotados) |
| `solo_ver` | Lectura — sin mutaciones |

---

## Stack técnico

```
Browser
  └── Next.js 15 App Router (RSC + Client Components)
        └── /api/v1  →  Route Handlers (TypeScript strict)
              └── dataService  →  supabase-service / memory-service (dev)
                    └── Supabase Postgres (RLS deny-by-default, service role en servidor)
```

- **UI**: Next.js 15, Tailwind CSS, Radix UI, Lucide
- **Auth**: Supabase email/contraseña — sin registro público
- **DB**: Supabase Postgres — migraciones en `supabase/migrations/` (hasta `023`)
- **Tests**: Vitest — 298 tests, 47 archivos
- **CI**: GitHub Actions — verify, Playwright smoke, Supabase readiness
- **Deploy**: Vercel (automático desde `main`)

---

## Desarrollo local

```bash
npm ci
npm run dev          # localhost:3000
```

Variables de entorno necesarias — ver [Deploy](./docs/DEPLOY.md).

> Sin variables Supabase, `dataService` usa memoria en proceso. No usar en producción.

---

## Verificación

```bash
npm run verify       # readiness + audit + lint + tests + build
npm run e2e          # Playwright smoke
npm run audit:remote # auditoría seguridad remota
```

---

## Base de datos

Supabase Postgres. Aplicar migraciones en orden (`001` → `023_promotion_review_comment.sql`).

Migraciones recientes relevantes:

| Migración | Contenido |
|---|---|
| `019` | `competition_availability` |
| `022` | `approval_submitter_id` |
| `023` | `promotion_requests.review_comment` |

---

## Documentación

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos paso a paso |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, decisiones de diseño |
| [API](./docs/API.md) | Referencia completa `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles, permisos, login server-side |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI |
| [Diseño](./docs/DESIGN.md) | Tokens, componentes, layout |
| [QA y seguridad](./docs/AUDIT.md) | Tests, auditoría, validaciones |
| [Readiness producción](./docs/PRODUCTION-READINESS.md) | Checklist pre-release |
| [Rutas](./docs/ROUTES.md) | Mapa de páginas |
| [Componentes](./docs/COMPONENTS.md) | Inventario UI |

---

<p align="center">
  <sub>AEP Tarima · v1.4 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
