# AEP Tarima

Plataforma B2B para la gestión de plantillas arbitrales de la AEP (Asociación Española de Powerlifting): campeonatos, tarima interactiva, directorio de árbitros, aprobaciones nacionales, ascensos y normativa IPF.

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 (App Router) en Vercel |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Datos | Supabase Postgres + Row Level Security |
| Auth | Clerk (email/contraseña) + perfiles `profiles` en Supabase |
| API | Route handlers `/api/v1/*` en el mismo repositorio |

## Inicio rápido (producción)

1. Crea proyectos en [Clerk](https://clerk.com) y [Supabase](https://supabase.com).
2. Activa la integración Clerk ↔ Supabase (ver `docs/AUTH.md`).
3. Ejecuta `supabase/migrations/001_initial_schema.sql` y `002_clerk_auth.sql` en el SQL Editor.
4. Copia `.env.example` → `.env.local` y rellena las claves.
3. Pobla datos y usuarios iniciales:

```bash
npm install
npm run db:seed
```

4. Arranca la app:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con un usuario creado por el seed (ver salida de `db:seed` para la contraseña inicial).

## Despliegue en Vercel

1. Conecta el repositorio en Vercel.
2. Añade las variables de entorno del proyecto (ver [docs/DEPLOY.md](./docs/DEPLOY.md)).
3. Ejecuta la migración SQL y `npm run db:seed` una vez contra el proyecto Supabase de producción.
4. Despliega. La API y la UI comparten el mismo dominio.

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Desarrollo en puerto 3000 |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run db:seed` | Poblar Supabase (zonas, árbitros, usuarios) |
| `npm run lint` | ESLint |

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/DEPLOY.md](./docs/DEPLOY.md) | Vercel, variables de entorno, checklist |
| [docs/DATABASE.md](./docs/DATABASE.md) | Esquema Postgres, RLS, seed |
| [docs/AUTH.md](./docs/AUTH.md) | Login, roles, gestión de usuarios |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Capas y RBAC |
| [docs/DESIGN.md](./docs/DESIGN.md) | Tokens de diseño |
| [docs/API.md](./docs/API.md) | Endpoints REST |
| [docs/ROUTES.md](./docs/ROUTES.md) | Rutas de la aplicación |
| [docs/COMPONENTS.md](./docs/COMPONENTS.md) | Componentes UI |

## Módulos

- **Dashboard** — KPIs, calendario operativo, actividad reciente
- **Campeonatos** — Listado, creación y tarima (drag & drop)
- **Árbitros** — Directorio, filtros y ficha editable
- **Aprobaciones** — Cola nacional con diff de roster
- **Ascensos** — Solicitudes de cambio de nivel
- **Estadísticas** — Cobertura por zona y eventos críticos
- **Normativa** — Matriz rol → nivel mínimo IPF/AEP
- **Usuarios** (nacional) — Alta de representantes regionales

## Roles

| Rol | Alcance |
|-----|---------|
| `nacional` | Toda la federación, aprueba rosters, gestiona usuarios |
| `regional` | Solo su zona, propone tarimas |
| `lectura` | Consulta en su ámbito |

## Estructura

```
src/
  app/              # UI + API /api/v1
  components/       # UI y módulos de dominio
  lib/              # Auth, Supabase, API client, tokens
  server/           # dataService (Postgres o memoria en dev)
supabase/migrations # SQL de esquema y RLS
scripts/seed.ts     # Datos iniciales
docs/               # Documentación técnica
```
