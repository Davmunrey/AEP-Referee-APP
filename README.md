<h1 align="center">AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa interna para la gestión de jueces AEP</strong><br/>
  Campeonatos · Tarimas · Cuadrantes · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/producción-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v1.3-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-198%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
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

- **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- **Import inteligente** de horarios y cuadrantes desde PDF con preview antes de aplicar.
- **Asignación visual** drag-and-drop con validación de roles, zonas y solapamientos en tiempo real.
- **Disponibilidad por campeonato** — confirma jueces vía WhatsApp, filtra solo confirmados en tarima.
- **Cruce de zonas** — detecta y marca automáticamente jueces asignados fuera de su zona habitual.
- **Analytics** — cobertura nacional, carga de trabajo, workload warnings, export CSV.

---

## De un vistazo

| Área | Capacidades |
|---|---|
| **Campeonatos** | Creación manual, import calendario anual PDF/CSV, edición inline, deduplicación |
| **Tarima** | Plantilla por tipo/campeonato, import horario PDF, **import cuadrante PDF (4 formatos AEP)**, drag-and-drop, flags, borrador → aprobación |
| **Export cuadrante** | **PDF formato oficial AEP** (colores por rol), **Excel**, compartir por **WhatsApp** |
| **Jueces** | Directorio, ficha completa, sanciones, disponibilidad, historial de tarimas |
| **Disponibilidad** | Por campeonato, confirmación manual, filtro "solo confirmados" en asignación |
| **Cross-zone** | Auto-detección servidor, badge naranja, columna analytics, banner en tarima |
| **Exámenes** | IPF, recertificación, nuevo juez — gestión y seguimiento |
| **Informes** | Por juez o competición, visibilidad por zona o nacional |
| **Ascensos** | Solicitud, revisión nacional, historial |
| **Analytics** | Histórico anual, KPIs (cobertura, carga, cross-zone), export CSV |
| **Usuarios** | Gestión de roles (`super_admin`/`delegado_jueces`), **reset de contraseñas** |
| **Contraseñas** | Cambio propio (cualquier rol) + reset por admin (sin conocer la actual) |

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Equivalente operativo a superadmin |
| `delegado_zona` | Jueces, informes y tarimas de su zona |
| `solo_ver` | Lectura — sin mutaciones |

---

## Stack técnico

```
Browser
  └── Next.js 15 App Router (RSC + Client Components)
        └── /api/v1  →  Route Handlers (TypeScript strict)
              └── dataService  →  supabase-service (barrel) / memory-service (dev)
                    └── Supabase Postgres (RLS deny-by-default, service role en servidor)
```

- **UI**: Next.js 15, Tailwind CSS, Radix UI, Lucide, design tokens centralizados
- **Auth**: Supabase email/contraseña — sin registro público
- **DB**: Supabase Postgres — migraciones en `supabase/migrations/`
- **Tests**: Vitest — 198 tests, 35 archivos
- **CI**: GitHub Actions — verify, Playwright smoke, Supabase readiness
- **Deploy**: Vercel (automático desde `main`)

---

## Desarrollo local

```bash
npm ci
npm run dev          # localhost:3000
```

Variables de entorno necesarias — ver [Deploy](./docs/DEPLOY.md) para la lista completa.

> Sin variables Supabase, `dataService` usa memoria en proceso. No usar en producción.

---

## Verificación

```bash
npm run verify       # readiness + audit + lint + tests + build
npm run e2e          # Playwright smoke
npm run audit:remote # auditoría seguridad
```

---

## Base de datos

Supabase Postgres. Migraciones en `supabase/migrations/`.

Para aplicar en entorno nuevo, ejecutar en orden en el SQL editor de Supabase (`001_` → `019_competition_availability.sql`).

> La migración **019** crea `competition_availability` — necesaria para confirmación de disponibilidad de jueces.

---

## Documentación

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos paso a paso |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, decisiones de diseño |
| [API](./docs/API.md) | Referencia completa `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles, permisos, middleware |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI |
| [Diseño](./docs/DESIGN.md) | Tokens, componentes, layout |
| [QA y seguridad](./docs/AUDIT.md) | Tests, auditoría, validaciones |
| [Readiness producción](./docs/PRODUCTION-READINESS.md) | Checklist pre-release |

---

<p align="center">
  <sub>AEP Tarima · v1.2 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
