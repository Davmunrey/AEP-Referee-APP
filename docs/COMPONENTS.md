# Componentes

## Layout

| Componente | Uso |
|---|---|
| `AppShell` | Shell dashboard |
| `Sidebar` | Navegación colapsable |
| `Topbar` | Breadcrumb y usuario |

## Dashboard

| Componente | Uso |
|---|---|
| `DashboardLive` | Refresco |
| `KpiCards` | KPIs |
| `HealthGauge` | Salud operativa |
| `InsightsPanel` | Recomendaciones |
| `CoverageForecast` | Cobertura próxima |
| `OperationalCalendar` | Calendario |

## Campeonatos/tarima

| Componente | Uso |
|---|---|
| `CompetitionsTable` | Listado |
| `OpenRostersPanel` | Tarimas abiertas |
| `CalendarImportDialog` | Import calendario |
| `EditCompetitionDialog` | Edición inline de campeonato |
| `RosterBuilder` | Asignación (orquestador, ≤500 líneas) |
| `RosterTemplateEditor` | Plantilla |
| `ScheduleImportDialog` | Horario PDF |
| `AssignmentImportDialog` | Cuadrante PDF |
| `ExportPreviewDialog` | Export |
| `RosterRevisionPanel` | Revisión |
| `RosterHistoryPanel` | Historial |
| `CompetitionAvailabilityDialog` | Confirmación disponibilidad jueces |

### Sub-componentes RosterBuilder (v1.2)

| Componente | Uso |
|---|---|
| `RosterCompetitionHeader` | Cabecera con info competición y acciones |
| `RosterRefereePanelLeft` | Panel izquierdo: filtros + lista jueces |
| `RefereeCard` | Tarjeta individual juez con badges y drag |
| `SlotGrid` | Grid de slots por sesión/rol |
| `SessionBlock` | Bloque sesión expandible |
| `SessionOverviewCard` | Tarjeta resumen sesión (barra progreso) |

## Datos

| Componente | Uso |
|---|---|
| `TransferDialogShell` | Shell común import/export |
| `FileDropZone` | Subida |
| `ImportPreviewTable` | Vista previa |

## Disponibilidad

| Componente | Uso |
|---|---|
| `CompetitionAvailabilityDialog` | Modal para confirmar/quitar disponibilidad de un juez en un campeonato |
| `RefereeAvailabilityPanel` | Panel en tarima: muestra confirmados, filtra "solo confirmados", llama a `/availability` |

La disponibilidad se gestiona a nivel de campeonato (tabla `competition_availability`, migration 019). El filtro "solo confirmados" en tarima filtra la lista de jueces disponibles a los que confirmaron.

## Jueces

| Componente | Uso |
|---|---|
| `RefereesDirectory` | Directorio |
| `RefereeEditForm` | Edición |
| `ExamsManager` | Exámenes |
| `ReportsManager` | Informes |
| `PromotionsBoard` | Ascensos |
| `UsersAdmin` | Usuarios |

## Responsive

El `AppShell` auto-colapsa el sidebar en `< 1024px` (primer render en tablet/iPad) para liberar espacio. El usuario puede expandirlo manualmente y la preferencia se persiste en localStorage (`aep-tarima:sidebar-collapsed`).
