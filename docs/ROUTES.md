# Rutas de la aplicación

## Públicas

| Ruta | Descripción |
|------|-------------|
| `/login` | Acceso + selector de personas demo |

## Dashboard (autenticadas)

Layout: `AppShell` (sidebar + topbar + `app-mesh`).

| Ruta | Módulo | Componente principal |
|------|--------|-------------------|
| `/` | Inicio | `DashboardHero`, `KpiCards`, `OperationalCalendar`, `ActivityFeed`, `EventsTable` |
| `/events` | Campeonatos | Tabla con cobertura y enlace a tarima |
| `/events/new` | Nuevo campeonato | `NewCompetitionForm` |
| `/events/[id]` | Tarima | `RosterBuilder` (pantalla completa) |
| `/referees` | Directorio | `RefereesDirectory` |
| `/referees/[id]` | Ficha árbitro | Resumen + `RefereeEditForm` |
| `/approvals` | Aprobaciones | `ApprovalsBoard` |
| `/promotions` | Ascensos | `PromotionsBoard` |
| `/analytics` | Estadísticas | `AnalyticsDashboard` |
| `/regulations` | Normativa | `RegulationsView` |

## Navegación lateral

Grupos definidos en `src/components/layout/sidebar.tsx`:

- **Operaciones** — Inicio, Campeonatos, Árbitros
- **Gestión** — Aprobaciones, Ascensos, Estadísticas, Normativa

Badges de contador en Aprobaciones (pendientes) según rol.

## Middleware

`src/middleware.ts` protege rutas del dashboard y redirige a `/login` sin sesión válida.

## Metadatos de página

`src/lib/navigation.ts` — títulos y breadcrumbs para `TopBar` según `pathname`.
