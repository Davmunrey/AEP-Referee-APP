<h1 align="center">🏋️ AEP Tarima</h1>

<p align="center">
  <strong>Plataforma operativa de jueces de la Asociación Española de Powerlifting</strong><br/>
  <em>En producción sobre Vercel + Supabase · deploy continuo desde <code>main</code></em>
</p>

<p align="center">
  Campeonatos · Tarimas · Cuadrantes · Compensación · Normativa · Informes · Exámenes · Estadísticas
</p>

<p align="center">
  <a href="https://aep-tarima.vercel.app/"><img alt="Producción" src="https://img.shields.io/badge/entrar-aep--tarima.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117" /></a>
  <img alt="Versión" src="https://img.shields.io/badge/versión-v2.0-22c55e?style=for-the-badge&labelColor=0d1117" />
  <img alt="Tests" src="https://img.shields.io/badge/tests-337%20passing-16a34a?style=for-the-badge&logo=vitest&logoColor=white&labelColor=0d1117" />
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js%2015-black?style=flat-square&logo=next.js&logoColor=white" />
  <img alt="React" src="https://img.shields.io/badge/React%2019-149eca?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript%20strict-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white" />
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-38bdf8?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" />
</p>

---

## 🔗 Acceso

| | |
|---|---|
| **Aplicación** | [aep-tarima.vercel.app](https://aep-tarima.vercel.app) |
| **Login** | [/sign-in](https://aep-tarima.vercel.app/sign-in) |
| **Documentación** | [/docs](https://aep-tarima.vercel.app/docs) |

La plataforma **funciona íntegramente en Vercel + Supabase**. Cada push a `main` despliega solo. No hace falta entorno local para operar: delegados y comité entran directamente desde el navegador. Las cuentas las crea AEP Nacional (sin registro público), con correos de acceso y recuperación con branding AEP Tarima.

---

## ✨ ¿Qué es?

**AEP Tarima** centraliza toda la operativa de jueces de la Asociación Española de Powerlifting: campeonatos, tarimas, compensación económica, normativa, exámenes, informes, ascensos y estadísticas nacionales — en un único lugar, a nivel nacional y por zonas.

**Solo aplicación web** — sin app móvil ni manual PDF descargable. La documentación vive en `/docs` y en el widget de Ayuda. Diseñada para **varias temporadas y años naturales**: fechas ISO en competiciones, analítica por año y separación de **censo vigente vs histórico** de jueces.

### Capacidades principales

- 🗂️ **Un solo lugar** para gestionar jueces, campeonatos y cuadrantes a nivel nacional y por zonas.
- ⚡ **Selección rápida de jueces** — al elegir un hueco, ordena los candidatos por idoneidad **entre los disponibles** (la disponibilidad confirmada manda; zona, nivel y solapes desempatan).
- 🔄 **Sincronización en tiempo real** — tarima, aprobaciones y compensación se propagan a todos los conectados (Supabase Realtime + respaldo cada 30 s).
- 💶 **Panel de compensación** para el responsable financiero, con **recibo PDF** (logo, IBAN efímero) y organizador configurable.
- 📅 **Censo por año natural** — arbitrajes de cada juez desglosados por año, con vista de censo vigente e histórico.
- 📖 **Normativa integrada** — Guía AEP 2026, plazas en tarima, baremo de compensación y reglamento IPF.
- 🗺️ **OpenStreetMap gratuito** — autocomplete de domicilio (Photon en servidor) + geocodificación al guardar.
- 📄 **Import inteligente** de horarios y cuadrantes desde PDF con preview y selección granular.
- 🛡️ **Privacidad zonal** — los delegados de zona ven solo datos de su macrozona.
- 🔐 **Acceso solo por servidor** a los datos sensibles (Supabase `service_role` + RBAC); RLS endurecido.

---

## 🆕 Novedades v2.0

> Historial completo de versiones desplegadas en [CHANGELOG.md](CHANGELOG.md).

| Novedad | Detalle |
|---|---|
| **Centro de ayuda local** | Widget rediseñado: buscador sobre ~35 temas curados + primeros pasos por rol + temas frecuentes. 100 % en el navegador, sin IA ni red. |
| **Sin asistente IA** | Retirada del asistente Gemini (ruta, cliente, prompt y rate-limit); la base de conocimiento se conserva para el buscador local. |
| **Título de pestaña** | La pestaña del navegador muestra simplemente «AEP Tarima». |
| **Censo por año natural** | Arbitrajes de cada juez separados por año; ficha con selector de año + «Histórico»; filtro de censo por año en el directorio. |
| **Recibo configurable** | Organizador del recibo con 3 opciones — club(es) organizador(es) · Asociación Española de Powerlifting · personalizable. PDF con logo. |
| **Endurecimiento de seguridad** | Políticas RLS permisivas eliminadas; los datos sensibles solo se leen desde el servidor. |

---

## 🧭 De un vistazo

| Área | Capacidades |
|---|---|
| **Campeonatos** | Alta manual, import calendario anual PDF/CSV, edición inline, deduplicación |
| **Tarima** | Plantilla, import horario/cuadrante PDF, drag-and-drop, selección rápida, imprevistos, badges de nivel compactos (R/N/I/II) |
| **Compensación** | Panel `/compensation`, km manual, montaje del sistema, multi-club, recibo PDF, IBAN efímero, organizador configurable |
| **Jueces** | Directorio, ficha, arbitrajes por año, domicilio OSM, sanciones, historial |
| **Disponibilidad** | Por campeonato; la selección rápida y el filtro «confirmados» trabajan sobre ella |
| **Normativa** | `/regulations` — Guía AEP, plazas, compensación, IPF |
| **Export cuadrante** | PDF formato oficial AEP, Excel, WhatsApp |
| **Exámenes / Informes / Ascensos** | Gestión nacional y zonal |
| **Estadísticas** | Histórico por año natural, KPIs, export CSV |
| **Documentación** | `/docs` web + widget Ayuda (guía por rol + buscador local) |
| **Usuarios** | Gestión de roles, reset de contraseñas |

## 👥 Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Autoridad nacional (jueces, tarimas, ascensos, usuarios) |
| `delegado_zona` | Campeonatos, tarimas y jueces de su zona |
| `responsable_financiero_jueces` | Panel de compensación y recibos PDF (lectura de tarimas/censo) |
| `solo_ver` | Solo lectura |

---

## 🏗️ Stack (producción)

```
Navegador
  └── Vercel — Next.js 15 App Router (React 19)
        └── /api/v1  →  Route Handlers
              └── dataService  →  Supabase Postgres (service role + RBAC)
                    └── Realtime: app_sync_state (migración 029)
```

| Capa | Tecnología |
|---|---|
| **Hosting** | Vercel (deploy automático desde `main`) |
| **Base de datos** | Supabase Postgres — migraciones `001`–`033` |
| **Auth** | Supabase email/contraseña — sin registro público |
| **UI** | Tailwind CSS, Radix UI, Lucide |
| **Geocoding** | Photon + Nominatim/OSRM — todo en servidor |
| **Realtime** | Supabase Realtime en `app_sync_state` |
| **Tests** | Vitest — 337 tests, 59 archivos |

---

## 🗄️ Base de datos (Supabase)

Migraciones recientes:

| Migración | Contenido |
|---|---|
| `024`–`027` | Compensación jueces, rol financiero, multi-club, montaje del sistema |
| `028` | Eliminación `device_tokens` (app iOS descontinuada) |
| `029` | **Realtime** — `app_sync_state` + triggers en 13 tablas operativas |
| `030` | **Índices** — `roster_assignments(competition_id, referee_id)`, `referees(nivel, estado)` |
| `031` | **Organizador de recibo** — tercer tipo `custom` (personalizable) además de `club`/`aep` |
| `032` | **Arbitrajes por año** — `referees.arbitraje_stats_by_year` (JSONB, desglose por año natural) |
| `033` | **Seguridad RLS** — elimina políticas permisivas en `referee_sanctions` y `competition_availability` |

Estado en producción: migraciones hasta `033` aplicadas en el proyecto Supabase `foaemadggmpbcrhtpems` (eu-west-2).

> **Modelo de seguridad:** todo el acceso a datos de la app pasa por el servidor con la clave `service_role`. El cliente del navegador (clave anónima) solo se usa para auth y para el contador de sincronización `app_sync_state`. Por eso el esquema sigue el patrón «RLS habilitado, sin políticas» = bloqueado a todo lo que no sea el servidor.

---

## 📚 Documentación del repositorio

| Doc | Contenido |
|---|---|
| [Guía de uso](./docs/GUIA-USO.md) | Flujos operativos con capturas |
| [Deploy](./docs/DEPLOY.md) | Vercel, variables, CI, Supabase |
| [Compensación](./docs/JUDGE-COMPENSATION.md) | Baremo, km manual, recibos, organizador, panel hub |
| [Arquitectura](./docs/ARCHITECTURE.md) | Capas, servicios, parsers, realtime |
| [API](./docs/API.md) | Referencia `/api/v1` |
| [Auth/RBAC](./docs/AUTH.md) | Roles y permisos |
| [Base de datos](./docs/DATABASE.md) | Tablas, RLS, migraciones |
| [Rutas](./docs/ROUTES.md) | Mapa de páginas |
| [Componentes](./docs/COMPONENTS.md) | Inventario UI |
| [Diseño](./docs/DESIGN.md) | Tokens y principios UX |
| [Convenciones de import/export](./docs/CONVENTIONS-IMPORTS.md) | Plantillas de datos |
| [Auditoría](./docs/AUDIT.md) | QA y seguridad |
| [Production readiness](./docs/PRODUCTION-READINESS.md) | Gates de calidad |

---

## 🛠️ Mantenedores (CI / releases)

El despliegue es automático en Vercel. Para validar cambios antes de merge:

```bash
npm run verify    # audit + lint + test + build
```

Detalle de variables, Supabase y checklist de release: [docs/DEPLOY.md](./docs/DEPLOY.md).

---

<p align="center">
  <sub>AEP Tarima · v2.0 · Uso interno AEP · <a href="https://aep-tarima.vercel.app/">aep-tarima.vercel.app</a></sub>
</p>
