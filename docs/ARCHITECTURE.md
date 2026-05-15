# Arquitectura — AEP Tarima

## Visión general

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Browser    │────▶│  Next.js App │────▶│  /api/v1/*      │
│  (React)    │     │  Middleware  │     │  Route Handlers │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                          ┌────────▼────────┐
                                          │  dataService    │
                                          │  store (memoria)│
                                          └─────────────────┘
```

La aplicación es un **monolito Next.js** con datos en memoria para demo y desarrollo local. No hay Supabase ni base de datos externa en esta versión.

## Capas

### 1. Presentación (`src/app`, `src/components`)

- **App Router** — rutas en `src/app/(dashboard)/*` y `src/app/login`
- **Server Components** — páginas cargan datos vía `dataService` en servidor
- **Client Components** — formularios, tarima, aprobaciones (`"use client"`)

### 2. API (`src/app/api/v1`)

Handlers REST que delegan en `dataService`. Respuestas JSON tipadas con `src/lib/types`.

### 3. Dominio (`src/server`)

- **`store.ts`** — estado mutable en memoria (árbitros, campeonatos, propuestas, etc.)
- **`services/index.ts`** — `dataService` con reglas de negocio y filtrado RBAC

### 4. Infraestructura (`src/lib`)

- **`auth/`** — sesión cookie, usuarios demo, middleware RBAC
- **`api/client.ts`** — cliente fetch para componentes cliente
- **`design-tokens.ts`** — clases semánticas Tailwind
- **`navigation.ts`** — metadatos de rutas para sidebar/topbar

## Autenticación y RBAC

| Rol | Alcance | Permisos |
|-----|---------|----------|
| `nacional` | Todas las zonas | CRUD completo, aprobar propuestas y ascensos |
| `regional` | Su zona (`user.zona`) | CRUD en su zona, enviar propuestas |
| `lectura` | Filtrado lectura | Sin crear/editar |

- Cookie: `aep_session`
- Middleware: `src/middleware.ts` redirige a `/login` si no hay sesión
- Demo: `POST /api/v1/auth/switch` cambia persona sin re-login

## Flujo de tarima

1. Regional asigna árbitros en `/events/[id]` (drag & drop o clic)
2. Asignaciones persisten vía `POST .../roster/assign`
3. Envío a nacional: `POST .../roster/submit` crea `ApprovalProposal`
4. Nacional revisa en `/approvals` con diff
5. Aprobar/rechazar actualiza estado del campeonato

## Validaciones de negocio (resumen)

- Nivel mínimo por rol según normativa (`RegulationRule`)
- Un árbitro no puede ocupar dos slots simultáneos en el mismo evento
- Solo árbitros `Activo` y `disp: true` en pool de tarima
- RBAC filtra listados por zona según rol regional

## Extensión futura

Para producción se sustituiría `store.ts` por:

- PostgreSQL / Supabase con migraciones
- Persistencia de sesiones y auditoría
- Storage para PDFs de normativa
- Notificaciones (email) en aprobaciones

La capa `dataService` actúa como frontera para minimizar cambios en UI y API routes.
