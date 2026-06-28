<h1 align="center">AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa interna para la gestión de jueces AEP</strong><br/>
  Campeonatos · Tarimas · Cuadrantes · Compensación · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/producción-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v1.6-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-344%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
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

AEP Tarima centraliza toda la operativa de jueces de la Asociación Española de Powerlifting: desde la creación de campeonatos hasta la asignación de tarimas, compensación económica, exámenes, informes de rendimiento, ascensos y estadísticas nacionales.

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año detectado y etiquetas de UI derivadas del calendario actual (`src/lib/season.ts`), sin acoplar la app a un año fijo.

- **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- **Panel de compensación** central para el responsable financiero — sin ir tarima a tarima.
- **Kilometraje gratuito** con OpenStreetMap (Photon, Nominatim, OSRM) — sin API keys de pago.
- **Import inteligente** de horarios y cuadrantes desde PDF con preview y selección granular.
- **Asignación visual** con validación de roles, zonas, solapamientos y confirmación para forzar conflictos (*).
- **Analytics multi-año** — histórico anual, cobertura, carga de trabajo, export CSV.
- **Privacidad zonal** — delegados de zona ven solo datos de su macrozona.

---

## De un vistazo

| Área | Capacidades |
|---|---|
| **Campeonatos** | Creación manual, import calendario anual PDF/CSV, edición inline, deduplicación |
| **Tarima** | Plantilla, import horario/cuadrante PDF, drag-and-drop, flags *, borrador → aprobación |
| **Compensación** | Panel `/compensation`, baremo AEP, km OSM, desglose Sx, multi-club, recibo PDF |
| **Export cuadrante** | PDF formato oficial AEP, Excel, compartir por WhatsApp |
| **Jueces** | Directorio, ficha, domicilio OSM, sanciones, historial de tarimas |
| **Disponibilidad** | Por campeonato, filtro "solo confirmados" en tarima |
| **Exámenes / Informes / Ascensos** | Gestión nacional y zonal |
| **Analytics** | Histórico anual, KPIs, cobertura, export CSV |
| **Documentación** | `/docs` web + manual PDF descargable |
| **Usuarios** | Gestión de roles, reset de contraseñas |

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Equivalente operativo a superadmin |
| `delegado_zona` | Jueces, informes y tarimas de su zona |
| `responsable_financiero_jueces` | Panel compensación, recibos PDF (sin editar tarima) |
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
- **DB**: Supabase Postgres — migraciones en `supabase/migrations/` (hasta `026`)
- **Geolocalización**: Photon (cliente) + Nominatim/OSRM (servidor) — gratuito
- **Tests**: Vitest — 344 tests, 57 archivos
- **Deploy**: Vercel (automático desde `main`)

---

## Desarrollo local

```bash
npm ci
npm run dev          # localhost:3000
```

Variables de entorno — ver [Deploy](./docs/DEPLOY.md). Sin Supabase, `dataService` usa memoria en proceso (solo dev).

---

## Verificación

```bash
npm run verify       # readiness + audit + lint + tests + build
npm run e2e          # Playwright smoke
npm run docs:screenshots  # regenera capturas en docs/images/
```

---

## Base de datos

Migraciones en orden (`001` → `026_compensation_clubs.sql`). Recientes:

| Migración | Contenido |
|---|---|
| `024` | Compensación jueces (claims, domicilio, sede) |
| `025` | Rol `responsable_financiero_jueces` + metadatos recibo |
| `026` | Varios clubes organizadores (`compensation_clubs`) |

---

## Documentación

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos con capturas |
| [Manual PDF](./docs/GUIA-USO.md#manual-pdf) | `GET /api/v1/guides/tarima-manual` (requiere sesión) |
| [Compensación](./docs/JUDGE-COMPENSATION.md) | Baremo, OSM, recibos, panel hub |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, parsers |
| [API](./docs/API.md) | Referencia `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles y permisos |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI |
| [Rutas](./docs/ROUTES.md) | Mapa de páginas |
| [Componentes](./docs/COMPONENTS.md) | Inventario UI |

---

<p align="center">
  <sub>AEP Tarima · v1.6 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
