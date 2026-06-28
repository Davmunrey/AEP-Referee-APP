<h1 align="center">AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa interna para la gestión de jueces AEP</strong><br/>
  Campeonatos · Tarimas · Cuadrantes · Compensación · Normativa · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/producción-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v1.7-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-331%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
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

AEP Tarima centraliza toda la operativa de jueces de la Asociación Española de Powerlifting: campeonatos, tarimas, compensación económica, normativa, exámenes, informes, ascensos y estadísticas nacionales.

**Solo aplicación web** en [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app). Sin app móvil ni manual PDF descargable: la documentación vive en `/docs` y en el widget de Ayuda.

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año detectado y etiquetas de UI derivadas del calendario actual (`src/lib/season.ts`).

- **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- **Panel de compensación** central para el responsable financiero.
- **Normativa integrada** — Guía AEP 2026, plazas en tarima, baremo de compensación y reglamento IPF.
- **OpenStreetMap gratuito** — autocomplete de domicilio vía API servidor (Photon) + Nominatim/OSRM en servidor.
- **Import inteligente** de horarios y cuadrantes desde PDF con preview y selección granular.
- **Asignación visual** con validación de roles, zonas, solapamientos e imprevistos en tarimas aprobadas.
- **Asistente de ayuda** con guía por rol y base de conocimiento (35 entradas) + Gemini opcional.
- **Privacidad zonal** — delegados de zona ven solo datos de su macrozona.

---

## De un vistazo

| Área | Capacidades |
|---|---|
| **Campeonatos** | Alta manual, import calendario anual PDF/CSV, edición inline, deduplicación |
| **Tarima** | Plantilla, import horario/cuadrante PDF, drag-and-drop, imprevistos, badges nivel compactos (R/N/I/II) |
| **Compensación** | Panel `/compensation`, km manual, montaje sistema, multi-club, recibo PDF, IBAN efímero |
| **Normativa** | `/regulations` — Guía AEP, plazas, compensación, IPF |
| **Export cuadrante** | PDF formato oficial AEP, Excel, WhatsApp |
| **Jueces** | Directorio, ficha, domicilio OSM, sanciones, historial de tarimas |
| **Disponibilidad** | Por campeonato, filtro «solo confirmados» en tarima |
| **Exámenes / Informes / Ascensos** | Gestión nacional y zonal |
| **Estadísticas** | Histórico anual, KPIs, export CSV |
| **Documentación** | `/docs` web + widget Ayuda (guía + asistente) |
| **Usuarios** | Gestión de roles, reset de contraseñas |

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Autoridad nacional (jueces, tarimas, ascensos, usuarios) |
| `delegado_zona` | Campeonatos, tarimas y jueces de su zona |
| `responsable_financiero_jueces` | Panel compensación, recibos PDF (lectura tarimas/censo) |
| `solo_ver` | Solo lectura |

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
- **Auth**: Supabase email/contraseña — sin registro público; correos con branding AEP
- **DB**: Supabase Postgres — migraciones en `supabase/migrations/` (hasta `028`)
- **Geocoding**: Photon (servidor, `/api/v1/geocode/search`) + Nominatim/OSRM — gratuito
- **Asistente**: Gemini opcional (`GEMINI_API_KEY`) + fallback local (`knowledge-base.ts`)
- **Tests**: Vitest — 331 tests, 57 archivos
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

Migraciones en orden (`001` → `028_drop_device_tokens.sql`). Recientes:

| Migración | Contenido |
|---|---|
| `024` | Compensación jueces (claims, domicilio, sede) |
| `025` | Rol `responsable_financiero_jueces` + metadatos recibo |
| `026` | Varios clubes organizadores (`compensation_clubs`) |
| `027` | Montaje sistema (`is_computer_setup`, `role_key`, `role_label`) |
| `028` | Eliminación `device_tokens` (app iOS descontinuada) |

---

## Documentación

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos con capturas |
| [Compensación](./docs/JUDGE-COMPENSATION.md) | Baremo, km manual, recibos, panel hub |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, parsers |
| [API](./docs/API.md) | Referencia `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles y permisos |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI, Supabase |
| [Rutas](./docs/ROUTES.md) | Mapa de páginas |
| [Componentes](./docs/COMPONENTS.md) | Inventario UI |
| [Diseño](./docs/DESIGN.md) | Tokens y principios UX |
| [Auditoría](./docs/AUDIT.md) | QA y seguridad |

---

<p align="center">
  <sub>AEP Tarima · v1.7 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
