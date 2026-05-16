# Arquitectura — AEP Tarima

## Visión general

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser    │────▶│  Next.js 15 App  │────▶│  /api/v1/*      │
│  (React 19) │     │ Supabase Middlew.│     │  Route Handlers │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  dataService    │
                                              │ (abstracción)   │
                                              └────────┬────────┘
                                                       │
                              ┌────────────────────────┴──────────────┐
                              │                                        │
                     ┌────────▼────────┐                    ┌─────────▼───────┐
                     │  Supabase       │                    │  memory-service │
                     │  (producción)   │                    │  (desarrollo)   │
                     └─────────────────┘                    └─────────────────┘
```

## Capas

### 1. Presentación (`src/app`, `src/components`)

- **App Router** — rutas en `src/app/(dashboard)/*`
- **Server Components** — páginas cargan datos vía `dataService` en servidor
- **Client Components** — formularios, tarima, aprobaciones, filtros (`"use client"`)
- **Layout** — `src/app/(dashboard)/layout.tsx` hace la comprobación de sesión para todas las rutas protegidas

### 2. API (`src/app/api/v1`)

Handlers REST que delegan en `dataService`. Respuestas JSON tipadas con `src/lib/types`:

| Ruta | Métodos |
|------|---------|
| `/referees` | GET, POST |
| `/referees/[id]` | GET, PATCH, DELETE |
| `/competitions` | GET, POST |
| `/competitions/[id]` | GET, PATCH, DELETE |
| `/competitions/[id]/roster` | GET |
| `/competitions/[id]/roster/assign` | POST |
| `/competitions/[id]/roster/clear` | POST |
| `/competitions/[id]/roster/draft` | POST |
| `/competitions/[id]/roster/submit` | POST |
| `/competitions/[id]/roster/export` | GET |
| `/competitions/[id]/roster/history` | GET |
| `/approvals` | GET |
| `/approvals/[id]/review` | POST |
| `/promotions` | GET, POST |
| `/promotions/[id]/review` | POST |
| `/exams` | GET, POST |
| `/exams/[id]` | PATCH, DELETE |
| `/reports` | GET, POST |
| `/reports/[id]` | DELETE |
| `/analytics` | GET |
| `/analytics/export` | GET (CSV) |
| `/regulations` | GET |
| `/meta` | GET |
| `/dashboard` | GET |
| `/auth/login`, `/auth/logout`, `/auth/signout` | POST |
| `/auth/me` | GET |
| `/admin/users` | GET, POST |
| `/admin/users/[id]` | PATCH, DELETE |

### 3. Servicio de datos (`src/server`)

- **`services/index.ts`** — selecciona `supabaseDataService` (prod) o `memoryDataService` (dev) según variables de entorno
- **`services/supabase-service.ts`** — implementación Postgres con cliente admin (service role, bypass RLS)
- **`services/memory-service.ts`** — implementación en memoria para desarrollo sin Supabase
- **`store.ts`** — datos de fixture para desarrollo (árbitros, campeonatos, normativa)
- **`db/mappers.ts`** — conversión filas Postgres → tipos TypeScript

### 4. Infraestructura (`src/lib`)

- **`auth/session.ts`** — `getSession()`, `requireApiUser()`, helpers RBAC (`canEditRoster`, `canManageUsers`)
- **`api/client.ts`** — cliente fetch tipado para componentes cliente
- **`api/config.ts`** — URL base de la API
- **`dashboard-intelligence.ts`** — motor puro que deriva el índice de salud operativa y las recomendaciones a partir del estado actual
- **`judge-stats.ts`** — helper puro que combina árbitro + exámenes + informes en un `JudgeProfile` con métricas
- **`ipf-chapters.ts`** — IPF Technical Rulebook completo (11 capítulos) como dato estructurado
- **`design-tokens.ts`** — clases semánticas Tailwind
- **`types.ts`** — tipos TypeScript compartidos

### Capa de inteligencia (retroalimentación)

El dashboard se alimenta de sus propios datos: `getDashboard()` reúne árbitros,
competiciones, cobertura, aprobaciones y actividad, y `buildIntelligence()`
deriva un índice de salud ponderado y recomendaciones priorizadas — sin entrada
manual. La migración `004_health_snapshots.sql` permite registrar el índice cada
6 h para comparar el estado actual con el pasado.

## Autenticación y RBAC (Supabase Auth)

| Rol | Alcance | Permisos |
|-----|---------|----------|
| `nacional` | Toda la federación | CRUD completo, aprueba rosters y ascensos, gestiona usuarios |
| `regional` | Su zona (`user.zona`) | CRUD en su zona, propone tarimas, solicita ascensos |
| `lectura` | Sin restricción geográfica | Solo lectura, sin crear/editar |

- Auth con Supabase Auth: email/contraseña, sesión por cookies (`@supabase/ssr`)
- Perfiles federativos en tabla `profiles` (1:1 con `auth.users`)
- Primer usuario registrado → rol `nacional`; resto → `lectura` (promoción manual)
- Service role admin client bypassa RLS para operaciones del servidor
- Detalle completo en [`docs/AUTH.md`](./AUTH.md)

## Flujo completo de una tarima

1. **Regional** abre `/events/[id]` y ve la plantilla vacía
2. Arrastra árbitros o selecciona slot + árbitro por clic
3. Cada asignación se persiste inmediatamente vía `POST .../roster/assign`
4. El sistema valida nivel mínimo por rol (normativa IPF/AEP) y muestra alertas
5. **Regional** pulsa "Guardar borrador" o "Enviar a aprobación"
6. El envío crea una `ApprovalProposal` con estado `pendiente`
7. **Nacional** revisa en `/approvals`: ve el diff slot→árbitro
8. Aprueba (sin comentario) o rechaza (con comentario obligatorio)
9. El estado del campeonato se actualiza en tiempo real

## Validaciones de negocio clave

- Nivel mínimo por rol y tipo de campeonato (`RegulationRule`) — alerta visual en tarima
- Un árbitro no puede ocupar dos slots simultáneos (la asignación anterior se libera)
- Solo árbitros `Activo` y `disp: true` aparecen en el pool de la tarima
- RBAC filtra listados y operaciones por zona para rol `regional`
- Nivel destino en ascenso debe ser superior al nivel actual
- Rechazo de aprobación requiere comentario obligatorio
- Confirmación al enviar roster incompleto (< 100%)
- Validación de fecha fin ≥ fecha inicio en creación de campeonato
