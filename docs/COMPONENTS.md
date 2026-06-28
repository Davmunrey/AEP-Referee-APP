# Componentes

## Layout

| Componente | Uso |
|---|---|
| `AppShell` | Shell dashboard + `AppRealtimeSync` |
| `Sidebar` | Navegación colapsable (Operaciones + Gestión) |
| `Topbar` | Breadcrumb, menú usuario (cambiar contraseña, cerrar sesión) |
| `HelpWidget` | Ayuda flotante: guía por rol + asistente (Gemini / local) |
| `AppRealtimeSync` | Sincronización en vivo con Supabase (invisible; shell) |

## Dashboard

| Componente | Uso |
|---|---|
| `DashboardLive` | Indicador en vivo (sincronizado con Realtime global) |
| `KpiCards` | KPIs de cobertura y operación |
| `HealthGauge` | Índice de salud operativa (0–100) |
| `InsightsPanel` | Recomendaciones auto-generadas |
| `CoverageForecast` | Cobertura próxima |
| `OperationalCalendar` | Calendario de campeonatos |

## Campeonatos / tarima

| Componente | Uso |
|---|---|
| `CompetitionsTable` | Listado con filtros |
| `OpenRostersPanel` | Tarimas abiertas priorizadas |
| `CalendarImportDialog` | Import calendario anual |
| `EditCompetitionDialog` | Edición inline de campeonato |
| `RosterBuilder` | Asignación (orquestador) |
| `RosterImprevistoBanner` | Desbloqueo tarima aprobada por imprevisto |
| `RosterTemplateEditor` | Plantilla manual |
| `ScheduleImportDialog` | Horario PDF |
| `AssignmentImportDialog` | Cuadrante PDF |
| `ExportPreviewDialog` | Export |
| `RosterRevisionPanel` | Revisión antes de enviar |
| `RosterHistoryPanel` | Historial de cambios |
| `CompetitionAvailabilityDialog` | Confirmación disponibilidad jueces |
| `RequiredSlotsChips` | Resumen plazas requeridas |

### Sub-componentes RosterBuilder

| Componente | Uso |
|---|---|
| `RosterCompetitionHeader` | Cabecera, acciones plantilla/export, enlace compensación |
| `RosterRefereePanel` | Panel jueces; confirm-to-force en conflictos forzables |
| `RefereeCard` | Tarjeta juez compacta; `LevelBadge compact` (R/N/I/II) |
| `SlotGrid` | Grid de plazas (hasta 3 columnas por sesión/pesaje) |
| `SessionBlock` | Bloque sesión expandible |
| `SessionOverviewCard` | Resumen sesión con barra de progreso |

## Compensación

| Componente | Uso |
|---|---|
| `CompensationHub` | Panel `/compensation` |
| `CompensationBoard` | Km manual, comparte, montaje sistema, multi-club |
| `CompensationExportDialog` | IBAN efímero → PDF recibo |
| `CompensationKmInput` / `CompensationEuroInput` | Entradas numéricas optimistas |

## Normativa

| Componente | Uso |
|---|---|
| `RegulationsView` | Pestañas: Guía AEP, plazas tarima, compensación, IPF |
| `AepGuidePanel` | Guía AEP 2026 |
| `RosterRulesPanel` | Requisitos de plazas (`regulation_rules`) |
| `CompensationNormativaPanel` | Baremo y reglas compensación |

## Mapas / domicilio

| Componente / API | Uso |
|---|---|
| `AddressAutocompleteField` | Autocomplete vía `GET /api/v1/geocode/search`; botón **Eliminar ubicación** |
| `src/lib/geocoding/photon-search.ts` | Búsqueda Photon (bbox España) |

## Datos / import-export

| Componente | Uso |
|---|---|
| `TransferDialogShell` | Shell común import/export |
| `FileDropZone` | Subida archivos |
| `ImportPreviewTable` | Vista previa seleccionable |

## Jueces

| Componente | Uso |
|---|---|
| `RefereesDirectory` | Directorio (tabla + cards móvil) |
| `RefereeEditForm` | Edición con domicilio OSM y botón **Eliminar ubicación** |
| `ExamsManager` | Exámenes |
| `ReportsManager` | Informes |
| `PromotionsBoard` | Ascensos |
| `UsersAdmin` | Usuarios |
| `PasswordDialog` | Cambiar/resetear contraseña |

## Badges

| Componente | Uso |
|---|---|
| `LevelBadge` | Nivel arbitral; prop `compact` en tarima (R, N, I, II) |
| `StatusBadge` | Estado juez |
| `EventTypeBadge` | Tipo campeonato AEP-1/2/3 |

## Export de cuadrante

| Lib / Ruta | Uso |
|---|---|
| `quadrant-html.ts` | HTML formato oficial AEP |
| `quadrant-excel.ts` | `.xlsx` por día |
| `quadrant-layout-parser.ts` | Import PDF por geometría de columnas |
| UI | Menú Exportar en tarima; icono PDF en lista campeonatos |

## Responsive

- Sidebar auto-colapsa en `< 1024px`; preferencia en `localStorage`.
- Breakpoints críticos en `xl` (1280px) para layouts de dos columnas en portátil 14".

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v1.8
