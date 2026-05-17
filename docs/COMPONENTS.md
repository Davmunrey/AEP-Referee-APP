# Componentes UI — AEP Tarima

## Layout

| Componente | Archivo | Uso |
|------------|---------|-----|
| `AppShell` | `layout/app-shell.tsx` | Sidebar + topbar + main |
| `Sidebar` | `layout/sidebar.tsx` | Navegación, org switcher, usuario, collapse |
| `TopBar` | `layout/topbar.tsx` | Breadcrumbs y título de página |
| `PageShell` | `layout/page-shell.tsx` | Contenedor con `max-w` y padding unificado |
| `PageHeader` | `layout/page-shell.tsx` | Eyebrow + título + descripción + slot de acciones |

## UI genéricos (shadcn/ui)

| Componente | Notas |
|------------|-------|
| `Button` | Variantes: default, outline, ghost, destructive. `focus-ring` y `rounded-xl` |
| `Card` | Superficie base. Variantes `glass-panel-soft` para destacados |
| `Input` | `focus-visible:ring-2`, borde semántico |
| `Badge` | Colores por tipo de nivel y estado |
| `Progress` | Barra de progreso con color dinámico |
| `DataTable` | Tabla estructurada con head, body, row, cell, headcell |
| `StatCard` | Tarjeta KPI con acento de color (dashboard + analytics) |
| `StatusPill` | Indicador de estado de workflow (pendiente/aprobado/rechazado) |
| `EmptyState` | Estado vacío con icono, título y descripción opcionales |
| `ScrollArea` | Área scrollable con scrollbar personalizado |
| `Avatar` | Avatar con fallback de iniciales |
| `DropdownMenu` | Menú desplegable (Radix) |

## Badges de dominio AEP (`components/aep/badges.tsx`)

| Componente | Descripción |
|------------|-------------|
| `LevelBadge` | Nivel de jueces (Regional / Nacional / IPF Cat. 2 / IPF Cat. 1) |
| `StatusBadge` | Estado de juez (Activo / Inactivo / Sancionado) |
| `EventTypeBadge` | Tipo de campeonato (AEP-1 / AEP-2 / AEP-3) |
| `EventStatusBadge` | Estado de campeonato (Completo / Incompleto / Crítico / Borrador) |
| `ActivityTypeBadge` | Tipo de actividad en el feed (propuesta / aprobación / ascenso…) |

## Componentes de módulo

### Dashboard
| Componente | Descripción |
|------------|-------------|
| `DashboardHero` | Saludo personalizado, acciones rápidas (exportar, nuevo campeonato) |
| `KpiCards` | Grid de 4 KPIs con tendencia y acento de color |
| `OperationalCalendar` | Calendario mensual navegable, eventos marcados por estado |
| `ActivityFeed` | Feed de últimas acciones (asignaciones, aprobaciones, ascensos) |
| `EventsTable` (dashboard) | Tabla de próximos eventos con cobertura |
| `DashboardLive` | Barra de control en vivo: auto-refresca el árbol de servidor cada 60 s, con pausa y refresco manual |
| `HealthGauge` | Anillo SVG del índice de salud operativa 0–100 con 5 factores ponderados y delta vs. captura previa |
| `InsightsPanel` | Recomendaciones auto-generadas, priorizadas por severidad, con enlaces de acción |
| `CoverageForecast` | Previsión de cobertura por evento: barra de progreso y días restantes con color de riesgo |

### Campeonatos
| Componente | Descripción |
|------------|-------------|
| `EventsTable` (events) | Tabla completa con filtros, paginación y borrado |
| `NewCompetitionForm` | Formulario de creación con validación de fechas y guard de unload |
| `RosterTemplateEditor` | Editor inline de plantilla: sesiones, días, categorías, horarios, roles de pista y pesaje |
| `RosterBuilder` | Constructor: drag & drop, flags `*`/`↑↓`, validación normativa, historial. `canEdit` desactiva edición |
| `RosterHeaderActions` | Cabecera: cobertura, editar plantilla, borrador, exportar TXT, enviar aprobación |
| `RosterHistoryPanel` | Historial de cambios (fetch lazy) |
| `SessionBlock` | Bloque de sesión con slots y progreso |

### Jueces / Jueces
| Componente | Descripción |
|------------|-------------|
| `RefereesDirectory` | Directorio con filtros (zona/nivel/estado/búsqueda) y paginación |
| `NewRefereeDialog` | Modal de alta de juez (Escape/backdrop para cerrar) |
| `RefereeEditForm` | Formulario de edición de ficha de jueces |
| `RefereePromotionButton` | Botón + modal para solicitar ascenso (valida nivel superior) |
| `ExamsManager` | Registro y calificación de exámenes de jueces. Reusable: acoplado a un juez (ficha) o global (`/exams`) |
| `ReportsManager` | Subida y consulta de informes de juez (sandbox). Reusable: acoplado o global (`/reports`) |

### Aprobaciones
| Componente | Descripción |
|------------|-------------|
| `ApprovalsBoard` | Cola de propuestas + diff de asignaciones + revisión |

### Ascensos
| Componente | Descripción |
|------------|-------------|
| `PromotionsBoard` | Lista de solicitudes con acciones de revisión |
| `NewPromotionDialog` | Modal de nueva solicitud de ascenso |

### Normativa
| Componente | Descripción |
|------------|-------------|
| `RegulationsView` | Dos pestañas: (1) Matriz AEP filtrable por tipo de evento, (2) Reglamento IPF completo (11 capítulos) con búsqueda full-text |
| `IpfArticleList` | Lista acordeón de artículos de un capítulo IPF con expand/collapse (auto-expandido al buscar) |

### Estadísticas
| Componente | Descripción |
|------------|-------------|
| `AnalyticsDashboard` | Cobertura por zona, top jueces, críticos, totales + exportar |

### Administración
| Componente | Descripción |
|------------|-------------|
| `UsersAdmin` | Alta/baja/activación + edición (rol, zona, nombre), búsqueda, filtros (rol/zona/estado), columna `created_at`, modal de credenciales generadas tras crear usuario (`canManageUsers`: `super_admin`, `delegado_jueces`) |

### Sign-in / auth
| Componente | Descripción |
|------------|-------------|
| `SignInPage` | Tabs sign-in / sign-up con micro-animación, aviso de rol `solo_ver` en signup, campo nombre obligatorio en signup, enlace "¿Olvidaste tu contraseña?" → flujo `resetPasswordForEmail` |

## Accesibilidad

- Todos los modales tienen `role="dialog"`, `aria-modal="true"`, `aria-labelledby` y **focus trap** (Tab cycle dentro del diálogo)
- Escape y click en backdrop cierran todos los modales
- `focus-ring` en todos los elementos interactivos (inputs, selects, botones)
- `aria-label` en botones sin texto visible (iconos), `aria-pressed` en toggles
- Skip link "Saltar al contenido principal" → `#main-content`
- `htmlFor`/`id` correctos en todos los formularios (`referee-edit-form`, etc.)
- `Empty states` descriptivos que distinguen "lista vacía" de "sin resultados con filtro"
