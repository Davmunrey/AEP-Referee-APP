# Componentes UI compartidos

## Layout

| Componente | Ruta | Uso |
|------------|------|-----|
| `AppShell` | `components/layout/app-shell.tsx` | Sidebar + topbar + main con `app-mesh` |
| `Sidebar` | `components/layout/sidebar.tsx` | Navegación, org switcher, usuario |
| `TopBar` | `components/layout/topbar.tsx` | Breadcrumbs, búsqueda, notificaciones |
| `PageShell` | `components/layout/page-shell.tsx` | Contenedor de página (`max-w-[1600px]`, padding) |
| `PageHeader` | `components/layout/page-header.tsx` | Eyebrow + título + descripción + acciones |

Todas las páginas operativas usan `PageShell` + `PageHeader` para tipografía unificada.

## UI genéricos (shadcn)

| Componente | Notas |
|------------|-------|
| `Button` | Variantes con `focus-ring`, `rounded-xl` |
| `Card` | Base `surface-card`, hover shadow |
| `Input` | Tokens semánticos |
| `Badge` | Variantes IPF/regional/estado vía tokens |
| `Progress` | Barra `bg-primary` |
| `DataTable` | Tabla con thead uppercase unificado |
| `StatCard` | KPI con acento (dashboard + analytics) |
| `StatusPill` | Workflow pendiente/aprobado/rechazado |
| `EmptyState` | Listas vacías con icono |

## Dominio AEP

| Componente | Ruta |
|------------|------|
| `AepLogo` | `components/aep/logo.tsx` |
| `OrgSwitcher` | `components/aep/org-switcher.tsx` |
| `LevelBadge`, `StatusBadge`, `EventStatusBadge`, `EventTypeBadge` | `components/aep/badges.tsx` |

## Módulos

| Módulo | Componente principal |
|--------|---------------------|
| Dashboard | `dashboard-hero`, `kpi-cards`, `operational-calendar`, `activity-feed`, `events-table` |
| Campeonatos | `roster-builder`, `new-competition-form`, `roster-header-actions` |
| Árbitros | `referees-directory`, `referee-edit-form`, `new-referee-dialog` |
| Aprobaciones | `approvals-board` |
| Ascensos | `promotions-board` |
| Analytics | `analytics-dashboard` |
| Normativa | `regulations-view` |
| Auth | `login-form`, `demo-persona-picker` |

## Clases de formulario (`design-tokens.ts`)

- `selectFieldClass` — selects altura 9
- `selectFieldClassSm` — filtros compactos
- `textareaFieldClass` — comentarios en aprobaciones

Siempre importar desde `@/lib/design-tokens`, no duplicar strings de clases.
