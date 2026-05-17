# Rutas de la aplicación

## Autenticación

| Ruta | Descripción |
|------|-------------|
| `/sign-in` | Login y registro email/contraseña |
| `/sign-up` | Redirección a `/sign-in` |
| `/auth/callback` | Confirmación email / exchange code |
| `/login` | Legacy → `/sign-in` |

## Dashboard (autenticadas)

Layout: `AppShell`. Middleware + `(dashboard)/layout.tsx` redirigen a `/sign-in` sin sesión.

| Ruta | Módulo | Componentes principales |
|------|--------|------------------------|
| `/` | Dashboard | `DashboardLive`, `KpiCards`, `HealthGauge`, `InsightsPanel`, `CoverageForecast`, … |
| `/events` | Campeonatos | `EventsTable`, `OpenRostersPanel`, `CalendarImportDialog` |
| `/events/new` | Nuevo campeonato | `NewCompetitionForm` |
| `/events/[id]` | Tarima | `RosterStepper`, `RosterTemplateEditor`, `RosterBuilder`, `RosterHeaderActions`, `ScheduleImportDialog`, `ExportPreviewDialog`, `RosterHelpPanel`, `RosterRevisionPanel`, `RosterHistoryPanel` |
| `/referees` | Directorio | `RefereesDirectory`, `JudgesRegistryImport` |
| `/referees/[id]` | Ficha juez | `ExamsManager`, `ReportsManager`, `RefereeEditForm`, … |
| `/exams` | Exámenes | `ExamsManager` (global) |
| `/reports` | Informes | `ReportsManager` (global) |
| `/approvals` | Aprobaciones | `ApprovalsBoard` |
| `/promotions` | Ascensos | `PromotionsBoard`, `NewPromotionDialog` |
| `/analytics` | Estadísticas | `AnalyticsDashboard` |
| `/regulations` | Normativa | `RegulationsView`, `IpfArticleList` |
| `/admin/users` | Usuarios | `UsersAdmin` — `canManageUsers` |

## Tarima (`/events/[id]`)

- **Modo lectura** (`solo_ver`): sin arrastre ni guardado.
- **Modo edición** (`canEditRoster`): editor de plantilla, asignaciones, flags `*` / `↑↓`, borrador, envío.
- Props clave: `canEdit`, `initialTemplate`, `initialAssignments`, `initialFlags`.

## Sidebar

**Operaciones:** Dashboard, Campeonatos, Tarima activa (enlace dinámico al campeonato operativo más próximo), Directorio.

`Tarima activa` ya no duplica la URL de Campeonatos: apunta a `/events/[id]` del evento prioritario (incompleto y futuro, o el primero disponible).

**Gestión:** Aprobaciones (badge contador), Ascensos, Exámenes, Informes, Estadísticas, Normativa IPF, Usuarios (visible para `super_admin` y `delegado_jueces`).

Estado de colapso del sidebar persiste en `localStorage` (`aep-tarima:sidebar-collapsed`).

Org switcher muestra etiqueta AEP según rol (`orgLabelForUser`).

## Middleware

`src/middleware.ts` — `updateSession`, protege rutas privadas, 401 en `/api/*` sin sesión.

## Errores

| Archivo | Uso |
|---------|-----|
| `loading.tsx` | Spinner dashboard |
| `not-found.tsx` | 404 |
| `error.tsx` | Boundary con reintento |

Guía de usuario: [`GUIA-USO.md`](./GUIA-USO.md).
