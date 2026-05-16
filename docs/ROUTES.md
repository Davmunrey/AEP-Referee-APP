# Rutas de la aplicación

## Autenticación (Supabase Auth)

| Ruta | Descripción |
|------|-------------|
| `/sign-in` | Login y registro: email/contraseña (Supabase Auth) |
| `/sign-up` | Redirección a `/sign-in` (registro unificado) |
| `/auth/callback` | Callback: confirma email / intercambia código por sesión |
| `/login` | Redirección legacy a `/sign-in` |

## Dashboard (autenticadas)

Layout: `AppShell` (sidebar colapsable + `app-mesh`). Protegidas por el middleware Supabase y por `(dashboard)/layout.tsx` → redirige a `/sign-in` si no hay sesión.

| Ruta | Módulo | Componentes principales |
|------|--------|------------------------|
| `/` | Dashboard | `DashboardLive`, `DashboardHero`, `KpiCards`, `HealthGauge`, `InsightsPanel`, `OperationalCalendar`, `CoverageForecast`, `EventsTable`, `ActivityFeed` |
| `/events` | Campeonatos | `EventsTable` (filtros + paginación + eliminar) |
| `/events/new` | Nuevo campeonato | `NewCompetitionForm` (guard unload si hay datos) |
| `/events/[id]` | Tarima | `RosterBuilder` (pantalla completa — drag & drop, validación normativa, historial) |
| `/referees` | Directorio | `RefereesDirectory` (filtros, paginación, nueva alta) |
| `/referees/[id]` | Ficha de juez | Resumen + trayectoria + `ExamsManager` + `ReportsManager` + `RefereeEditForm` + `RefereePromotionButton` |
| `/exams` | Exámenes arbitrales | `ExamsManager` (tablero global) + tarjetas de estadística |
| `/reports` | Sandbox de informes | `ReportsManager` (repositorio global) + tarjetas de estadística |
| `/approvals` | Aprobaciones | `ApprovalsBoard` (cola + diff + comentario obligatorio al rechazar) |
| `/promotions` | Ascensos | `PromotionsBoard` + `NewPromotionDialog` |
| `/analytics` | Estadísticas | `AnalyticsDashboard` (cobertura, top árbitros, críticos) |
| `/regulations` | Normativa IPF | `RegulationsView` (matriz AEP + reglamento IPF completo con búsqueda) |
| `/admin/users` | Usuarios | `UsersAdmin` — solo accesible para rol `nacional` |

## Navegación lateral (sidebar)

**Operaciones** (todos los roles):
- Dashboard (`/`)
- Campeonatos (`/events`)
- Directorio (`/referees`)
- Constructor Tarima → enlace a `/events` (se activa al navegar a `/events/[id]`)

**Gestión** (todos los roles, con restricciones por RBAC):
- Aprobaciones (`/approvals`) — badge contador de pendientes
- Ascensos (`/promotions`)
- Exámenes (`/exams`)
- Informes (`/reports`)
- Estadísticas (`/analytics`)
- Normativa IPF (`/regulations`)
- Usuarios (`/admin/users`) — solo rol `nacional`

## Middleware

`src/middleware.ts` — middleware Supabase (`updateSession`) activo en todas las rutas: refresca la sesión por cookies, redirige a `/sign-in` las rutas privadas sin sesión y devuelve 401 en `/api/*`. El layout `(dashboard)/layout.tsx` repite la comprobación en servidor.

## Páginas especiales

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` (loading) | `loading.tsx` | Spinner mientras carga el dashboard |
| 404 | `not-found.tsx` | Página genérica de recurso no encontrado |
| Error | `error.tsx` | Boundary de error global con botón de reintento |
