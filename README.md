# AEP Tarima

Plataforma B2B para la gestión de plantillas arbitrales de la AEP (Asociación Española de Powerlifting): campeonatos, tarima interactiva, directorio de árbitros, aprobaciones nacionales, ascensos y normativa IPF.

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Tipado | TypeScript 5 |
| Datos (demo) | API REST en memoria (`/api/v1`) |
| Auth | Cookie de sesión + RBAC por rol |

## Inicio rápido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

En desarrollo, `.env.development` activa modo local y demo automáticamente.

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Servidor de desarrollo en puerto 3000 |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [DEMO.md](./DEMO.md) | Guía de presentación, personas demo y flujos |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Arquitectura, capas y RBAC |
| [docs/DESIGN.md](./docs/DESIGN.md) | Sistema de diseño y tokens |
| [docs/API.md](./docs/API.md) | Referencia de endpoints REST |
| [docs/ROUTES.md](./docs/ROUTES.md) | Rutas de la aplicación |
| [docs/COMPONENTS.md](./docs/COMPONENTS.md) | Inventario de componentes UI |

## Módulos

- **Dashboard** — KPIs, calendario operativo, actividad reciente
- **Campeonatos** — Listado, creación y tarima (drag & drop)
- **Árbitros** — Directorio, filtros y ficha editable
- **Aprobaciones** — Cola nacional con diff de roster
- **Ascensos** — Solicitudes de cambio de nivel
- **Estadísticas** — Cobertura por zona y eventos críticos
- **Normativa** — Matriz rol → nivel mínimo IPF/AEP

## Demo

Contraseña universal: `aep2026`

Personas disponibles en login y en el selector lateral (ver [DEMO.md](./DEMO.md)).

## Variables de entorno

Copia `.env.example` a `.env.local` si necesitas personalizar:

```env
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_RUN_LOCAL=true
NEXT_PUBLIC_LOCAL_API_URL=http://localhost:3000/api/v1
```

## Estructura del proyecto

```
src/
  app/              # Rutas App Router + API /api/v1
  components/       # UI, layout, módulos de dominio
  lib/              # Auth, API client, design-tokens, tipos
  server/           # dataService + store en memoria
  styles/           # tokens.css (fuente de verdad de color)
docs/               # Documentación técnica
```

## Licencia

Proyecto privado — uso interno AEP / FECHAP.
