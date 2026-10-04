# Componentes

## Layout

| Componente | Uso |
|---|---|
| `AppShell` | Shell dashboard + `AppRealtimeSync`; en móvil, cajón de navegación con buscador (se cierra al navegar o con Escape) |
| `Sidebar` | Navegación colapsable en 5 grupos (General, Competiciones, Jueces, Referencia, Administración); plegada, los contadores son un punto |
| `Topbar` | Migas (en móvil, nombre de la página o del campeonato y botón ☰), buscador, menú usuario (cambiar contraseña, cerrar sesión) |
| `PageShell` / `PageHeader` | Contenedor de página y cabecera canónica (`h1`, descripción, acciones; sin rótulo encima) |
| `MetricStrip` / `MetricTile` | Franja de cifras de una pantalla (`ui/metric-tile.tsx`) |
| `confirmar()` / `ConfirmHost` | Confirmación dentro de la app en lugar de `window.confirm` (`ui/confirm-dialog.tsx`) |
| `HelpWidget` | Ayuda flotante: primeros pasos por rol + buscador local de temas (sin IA) |
| `AppRealtimeSync` | Sincronización en vivo con Supabase (invisible; shell) |

## Primitivas UI (`src/components/ui`)

| Componente | Uso |
|---|---|
| `MetricTile` | Cifra con icono y tono (`neutral`, `primary`, `success`, `warning`, `danger`). Única pieza para las tiras de cifras de Aprobaciones, Ascensos, Exámenes y el hub de Compensación |
| `EmptyState` | Estado vacío con icono, título, descripción y acción opcional |
| `StatusPill` | Estado de propuestas/solicitudes (pendiente, aprobado, rechazado…) |
| `Skeleton` | Pantallas esqueleto de carga (todas las rutas tienen `loading.tsx`) |
| `Button`, `Card`, `Input`, `Badge`, `DropdownMenu`, `DataTable`… | Base Radix/Tailwind |

Textos con número: `contar(n, "juez", "jueces")` y `palabra(n, …)` de `src/lib/plural.ts` (nada de «1 jueces» ni «juez(es)»).

## Dashboard

| Componente | Uso |
|---|---|
| `DashboardHeader` | Saludo, frase de resumen con cifras, indicador de actualización y acciones |
| `DashboardLive` | Indicador compacto de actualización con pausa real y refresco manual |
| `KpiCards` | Franja de cuatro cifras enlazadas (`buildDashboardKpis`); color solo si la cifra pide acción |
| `UpcomingCompetitions` | Próximos campeonatos con cobertura viva (plantilla + asignaciones) |
| `PendingPanel` | Acciones pendientes (`insights`) y sanciones activas |
| `ActivityFeed` | Actividad reciente filtrada por zona |
| `OperationalCalendar` | Calendario de campeonatos: rejilla mensual (escritorio) con barras continuas para varios días, color de estado en el borde, celebrados en gris y «+N más» como menú con enlaces; agenda del mes en móvil |

## Campeonatos / tarima

| Componente | Uso |
|---|---|
| `ConvocatoriaDialog` | Lanzar y llevar la convocatoria del campeonato (sesiones, fecha límite, inscritos por sesión, cerrar/reabrir/cancelar) |
| `CompetitionsTable` | Listado con filtros |
| `OpenRostersPanel` | «Tarimas por completar»: las próximas con huecos o sin plantilla, de menor a mayor cobertura |
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
| `RosterHeaderActions` | Cobertura, guardar borrador, exportar y «Enviar a aprobación» (desactivado con el motivo si no hay plantilla o ningún juez) |
| `RosterStepper` | Pasos Plantilla → Asignación → Revisión como pestañas segmentadas; un paso solo sale como hecho si lo está de verdad |
| `RosterHelpPanel` | Fila de pasos + «Cómo montar una tarima» (envuelve a `RosterStepper`; la ayuda se despliega debajo) |
| `RosterRefereePanel` | Panel jueces; selección rápida (ranking por idoneidad, `rankRefereesForSlot`); confirm-to-force en conflictos forzables; aviso de cuántos jueces no disponibles se ocultan y «Quitar filtros» |
| `RefereeCard` | Tarjeta juez compacta; `LevelBadge compact` (R/N/I/II) |
| `SlotGrid` | Grid de plazas (hasta 3 columnas por sesión/pesaje); cada hueco ocupa una fila: nivel, nombre, avisos, compartido/intercambio y quitar |
| `SessionBlock` | Bloque sesión expandible |
| `SessionOverviewCard` | Resumen sesión con barra de progreso |

## Compensación

| Componente | Uso |
|---|---|
| `CompensationHub` | Panel `/compensation` |
| `CompensationBoard` | Km manual, comparte, montaje sistema, multi-club; organizador club/aep/custom (tarjeta plegable una vez guardado); filas pagadas en solo lectura con distintivo «pagada» |
| `CompensationExportDialog` | IBAN efímero → PDF recibo (3 tipos de organizador, logo AEP) |
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
| `RefereesDirectory` | Directorio (tabla + cards móvil); filtro de censo por año natural |
| `RefereeArbitrajePanel` | Arbitrajes por año natural: selector de año + **Histórico** |
| `RefereeEditForm` | Edición con domicilio OSM y botón **Eliminar ubicación** |
| `ExamsManager` | Exámenes |
| `ReportsManager` | Informes |
| `PromotionsBoard` | Ascensos |
| `UsersAdmin` | Usuarios |
| `RefereeSanctionsPanel` | Sanciones de la ficha de juez |

## Soporte

| Componente | Uso |
|---|---|
| `TicketsBoard` | Bandeja `/tickets` con filtros de estado |
| `NewTicketDialog` | Alta de ticket con hasta 5 fotos |
| `TicketDetail` | Hilo de comentarios, adjuntos y cambio de estado |
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

- `< 768px`: cajón de navegación en lugar del sidebar.
- Sidebar auto-colapsa en `< 1024px`; preferencia en `localStorage`.
- Breakpoints críticos en `xl` (1280px) para layouts de dos columnas en portátil 14".

## Accesibilidad

- Cada `<label>` está enlazada a su control (`htmlFor` + `id`); los ids dentro de listas se derivan de `useId()` + índice, nunca de valores aleatorios (rompen la hidratación).
- Grupos de botones que actúan como selector (nivel destino de un ascenso) usan `role="group"` con nombre y `aria-pressed`.
- Un solo `h1` por página: el de `PageHeader` o, en la ficha de juez, el de la tarjeta de identidad.
- Diálogos modales: `useEscapeClose(onClose, active?)` (`src/hooks/use-escape-close.ts`) da Escape, foco atrapado dentro, foco devuelto al que abrió y scroll bloqueado detrás. Todo diálogo con velo lo usa (un test lo comprueba); `TransferDialogShell` trae su propia trampa.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4

## Portal del juez

| Componente | Uso |
|---|---|
| `PortalShell` | Marco del portal: cabecera y pestañas (abajo en móvil) |
| `DesignationCard` | Una designación aprobada, sesión a sesión |
| `ConvocatoriaCard` | Convocatoria abierta en la lista (cierre, sesiones apuntadas, «Otra zona») |
| `ConvocatoriaSignup` | Apuntarse / retirarse por sesión, con bloqueos y avisos |
| `DesignationResponse` | Confirmar la designación o avisar de que no puede ir (con motivo) |

## Avisos

| Componente | Uso |
|---|---|
| `NotificationBell` | Campana con no leídas; al abrirla marca como leídos. En la barra superior y en el portal |
| `ZoneRequestActions` | Aceptar o rechazar que tus jueces vean la convocatoria de otra zona (en «Pendiente») |
