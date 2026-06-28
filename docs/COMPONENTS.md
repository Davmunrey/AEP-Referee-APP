# Componentes

## Layout

| Componente | Uso |
|---|---|
| `AppShell` | Shell dashboard |
| `Sidebar` | Navegación colapsable (Documentación, Compensación, sin avatar en pie) |
| `Topbar` | Breadcrumb, menú usuario (cambiar contraseña, cerrar sesión) |

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
| `CompensationHub` | Panel `/compensation` — lista campeonatos, km pendientes, enlace directo |
| `CompensationBoard` | Compensación por campeonato: km manual, desglose por posición, montaje ordenador, multi-club |
| `CompensationExportDialog` | Modal IBAN efímero → descarga recibo PDF (desglose por sesión) |
| `AddressAutocompleteField` | Photon/OpenStreetMap autocomplete (sede, domicilio juez) |

### Sub-componentes RosterBuilder (v1.2)

| Componente | Uso |
|---|---|
| `RosterCompetitionHeader` | Cabecera con info competición, enlace compensación (rol financiero) y acciones |
| `RequiredSlotsChips` | Resumen plazas requeridas (tarima, mesa, control, pesaje) |
| `RosterRefereePanel` | Panel jueces con confirm-to-force en conflictos overridable |
| `RefereeCard` | Tarjeta individual juez con badges y drag |
| `SlotGrid` | Grid de slots por sesión/rol (3 columnas: tarima, mesa, jurado) |
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
| `RefereesDirectory` | Directorio (con vista card en móvil) |
| `RefereeEditForm` | Edición (domicilio con autocomplete OpenStreetMap) |
| `ExamsManager` | Exámenes |
| `ReportsManager` | Informes |
| `PromotionsBoard` | Ascensos |
| `UsersAdmin` | Usuarios |
| `EditUserDialog` | Editar usuario (nombre, rol, zona) |
| `PasswordDialog` | Cambiar/resetear contraseña (modo `self` / `admin`) |

## Export de cuadrante

| Lib / Ruta | Uso |
|---|---|
| `quadrant-html.ts` | Genera HTML formato oficial AEP (colores por rol, portrait, leyenda) |
| `quadrant-excel.ts` | Genera `.xlsx` (hoja por día, roles=filas, sesiones=columnas) |
| `quadrant-layout-parser.ts` | Parser de import por geometría de columnas (4 formatos AEP) |
| Botones | "Cuadrante PDF" / "Excel" / "WhatsApp" en cabecera de tarima; icono PDF en lista de campeonatos |

## Responsive

El `AppShell` auto-colapsa el sidebar en `< 1024px` (primer render en tablet/iPad) para liberar espacio. El usuario puede expandirlo manualmente y la preferencia se persiste en localStorage (`aep-tarima:sidebar-collapsed`).
