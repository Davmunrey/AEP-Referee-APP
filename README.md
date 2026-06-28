<h1 align="center">AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa de jueces AEP — en producción en Vercel</strong><br/>
  Campeonatos · Tarimas · Cuadrantes · Compensación · Normativa · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/entrar-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v1.8-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-331%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js%2015-black?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
</p>

---

## Acceso

| | |
|---|---|
| **URL** | [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) |
| **Login** | [https://aep-tarima.vercel.app/sign-in](https://aep-tarima.vercel.app/sign-in) |
| **Documentación** | [https://aep-tarima.vercel.app/docs](https://aep-tarima.vercel.app/docs) |

La plataforma **funciona íntegramente en Vercel + Supabase**. Cada push a `main` despliega automáticamente. No hace falta entorno local para operar: los delegados y el comité acceden directamente desde el navegador.

Las cuentas las crea AEP Nacional (sin registro público). Correos de acceso y recuperación con branding AEP Tarima.

---

## ¿Qué es?

AEP Tarima centraliza toda la operativa de jueces de la Asociación Española de Powerlifting: campeonatos, tarimas, compensación económica, normativa, exámenes, informes, ascensos y estadísticas nacionales.

**Solo aplicación web** — sin app móvil ni manual PDF descargable. La documentación vive en `/docs` y en el widget de Ayuda.

Diseñada para **varias temporadas**: fechas ISO en competiciones, analytics por año detectado y etiquetas de UI derivadas del calendario actual.

### Capacidades principales

- **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- **Sincronización en tiempo real** — cambios en tarima, aprobaciones o compensación se propagan a todos los usuarios conectados (Supabase Realtime + respaldo cada 30 s).
- **Rendimiento optimizado** — consultas batch, caché de zonas/normativa, filtros SQL en directorio de jueces, índices en Postgres.
- **Panel de compensación** central para el responsable financiero.
- **Normativa integrada** — Guía AEP 2026, plazas en tarima, baremo de compensación y reglamento IPF.
- **OpenStreetMap gratuito** — autocomplete de domicilio (Photon en servidor) + geocodificación al guardar; botón para eliminar ubicación guardada.
- **Import inteligente** de horarios y cuadrantes desde PDF con preview y selección granular.
- **Asignación visual** con validación de roles, zonas, solapamientos e imprevistos en tarimas aprobadas.
- **Asistente de ayuda** con guía por rol y base de conocimiento (~35 entradas) + Gemini opcional.
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
| **Jueces** | Directorio, ficha, domicilio OSM (autocomplete + eliminar ubicación), sanciones, historial |
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

## Stack (producción)

```
Navegador
  └── Vercel — Next.js 15 App Router
        └── /api/v1  →  Route Handlers
              └── dataService  →  Supabase Postgres (service role + RBAC)
                    └── Realtime: app_sync_state (migración 029)
```

| Capa | Tecnología |
|---|---|
| **Hosting** | Vercel (deploy automático desde `main`) |
| **Base de datos** | Supabase Postgres — migraciones `001`–`030` |
| **Auth** | Supabase email/contraseña — sin registro público |
| **UI** | Tailwind CSS, Radix UI, Lucide |
| **Geocoding** | Photon + Nominatim/OSRM — todo en servidor |
| **Realtime** | Supabase Realtime en `app_sync_state` |
| **Tests** | Vitest — 331 tests, 57 archivos |

---

## Base de datos (Supabase)

Migraciones recientes:

| Migración | Contenido |
|---|---|
| `024`–`027` | Compensación jueces, rol financiero, multi-club, montaje sistema |
| `028` | Eliminación `device_tokens` (app iOS descontinuada) |
| `029` | **Realtime** — `app_sync_state` + triggers en 13 tablas operativas |
| `030` | **Índices** — `roster_assignments(competition_id, referee_id)`, `referees(nivel, estado)` |

Estado producción: migraciones hasta `030` aplicadas en proyecto Supabase `foaemadggmpbcrhtpems` (eu-west-2).

---

## Documentación del repositorio

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos con capturas |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI, Supabase |
| [Compensación](./docs/JUDGE-COMPENSATION.md) | Baremo, km manual, recibos, panel hub |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, parsers, realtime |
| [API](./docs/API.md) | Referencia `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles y permisos |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Rutas](./docs/ROUTES.md) | Mapa de páginas |
| [Componentes](./docs/COMPONENTS.md) | Inventario UI |
| [Diseño](./docs/DESIGN.md) | Tokens y principios UX |
| [Auditoría](./docs/AUDIT.md) | QA y seguridad |
| [Production readiness](./docs/PRODUCTION-READINESS.md) | Gates de calidad |

---

## Mantenedores (CI / releases)

El despliegue es automático en Vercel. Para validar cambios antes de merge:

```bash
npm run verify    # audit + lint + test + build
```

Detalle de variables, Supabase y checklist de release: [docs/DEPLOY.md](./docs/DEPLOY.md).

---

<p align="center">
  <sub>AEP Tarima · v1.8 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
