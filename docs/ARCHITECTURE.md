# Arquitectura

```text
Browser -> Vercel (Next.js App Router) -> /api/v1 -> dataService -> Supabase service
                                      \-> memory service solo si faltan credenciales Supabase (no producción)
```

## Capas

| Capa | Ruta |
|---|---|
| UI server/client | `src/app`, `src/components` |
| API | `src/app/api/v1/**/route.ts` |
| Auth/RBAC | `src/lib/auth`, `src/lib/supabase` |
| Dominio | `src/lib` |
| Servicios | `src/server/services` |
| DB | `supabase/migrations` |
| Tests | `tests` |

## Dominio principal

- `Competition`: campeonato real AEP.
- `RosterSession`: sesión de tarima dentro de un campeonato.
- `RosterAssignment`: juez asignado a slot.
- `Referee`: juez.
- `Report`: informe de juez o competición.
- `Exam`: nuevo juez, IPF, recertificación.
- `PromotionRequest`: ascenso.
- `CompensationClaim`: compensación económica por juez × campeonato (sin IBAN).

Dominio compensación: `src/lib/judge-compensation/` (baremo, classify, calculate, recibo PDF). El recibo admite 3 tipos de organizador (club / aep / custom) y genera PDF con logo (`receipt-document.ts` + `receipt-pdf.ts`, logo en `receipt-logo.ts`; migración `031`). Geocoding: **Photon** en servidor (`/api/v1/geocode/search`, `src/lib/geocoding/photon-search.ts`) + **Nominatim/OSRM** para geocode puntual y distancias (`osm-distance.ts`). El cliente no llama a APIs externas de mapas (CSP).
Servicios: `supabase-compensation.ts`, `memory-compensation.ts`.

## Tarima

1. Campeonato obtiene plantilla guardada (`competitions.template`) o preset por tipo.
2. Usuario puede importar horario PDF o editar plantilla manual.
3. Usuario importa cuadrante PDF o asigna manual.
4. API valida zona, rol y solapes; badges de nivel en tarima abreviados (R, N, I, II).
5. Borrador, historial y aprobación quedan trazados. Tarima aprobada: modo **imprevisto** para cambios urgentes.

## Selección rápida de jueces

Al elegir un hueco, la lista de jueces se ordena por **idoneidad** para ese slot.

- Helpers en `src/lib/roster-ui.ts`: `scoreRefereeForSlot`, `rankRefereesForSlot` y el contexto `SlotSuggestionContext`.
- La selección rápida aplica **solo a los jueces disponibles**: va DESPUÉS del paso de disponibilidad, así que si hay disponibilidad confirmada para la competición, se ocultan los no confirmados (`availableReferees` en `src/components/competitions/roster-builder.tsx`).
- Criterio **dominante**: la disponibilidad confirmada. Luego desempatan misma zona, nivel adecuado y solapes (los forzables restan puntos; los bloqueos duros quedan al fondo).
- El nivel recomendado es un **aviso**, no un bloqueo (`getRecommendationWarning`); el ranking lo penaliza pero no excluye al juez.
- El panel `src/components/competitions/roster-referee-panel.tsx` aplica `rankRefereesForSlot` para pintar la lista ordenada.

## Ayuda y documentación in-app

- Widget flotante (`HelpWidget`): primeros pasos por rol (quick-start) + buscador local sobre la base de conocimiento. 100 % en cliente, sin IA ni red.
- Base de conocimiento: `src/lib/help/knowledge-base.ts` (~40 entradas).
- Documentación web: `/docs` (pública en parte legal; guía operativa con sesión).
- Normativa: `/regulations` — Guía AEP 2026, plazas en tarima, compensación jueces, reglamento IPF.

## Temporada y multi-año

- Las competiciones almacenan `fecha` / `fechaFin` en ISO (`YYYY-MM-DD`).
- Analytics agrupa por año detectado en fechas — no hay año hardcodeado en servidor.
- UI usa `src/lib/season.ts`: `currentSeasonYear()`, `seasonLabel()`, `operationalQuarterLabel()`.
- Documentos normativos por temporada (p. ej. `aep-guide-2026.ts`) son referencia estática; actualizar al publicar nueva guía AEP.

## Historial de juez

- Fuente única: `roster_assignments`.
- Cada slot se interpreta como `sesion_rol_indice`.
- La ficha de juez agrega por campeonato y conserva posiciones exactas: sesión, rol, hueco y flags de compartido/intercambio.
- El mismo helper de dominio alimenta Supabase y memoria dev para evitar divergencias.

## Imports

- Calendario anual: PDF/CSV -> preview -> selección -> crear campeonatos.
- Horario competición: PDF -> preview sesiones -> selección -> **merge** en plantilla existente (sesiones no seleccionadas se conservan).
- Cuadrante jueces: PDF -> preview candidatos -> selección -> asignar.
- Registro jueces: XLSX -> preview -> upsert/replace (incluye arbitrajes por año natural, ver abajo).

### Parser de cuadrantes (`src/lib/quadrant-layout-parser.ts`)

Extrae asignaciones de jueces de PDFs AEP por **geometría de columnas**. El cuadrante
es una rejilla: filas = roles, columnas = sesiones. Cada nombre se asigna a la columna
(sesión) más cercana por posición de carácter — robusto ante celdas vacías en cualquier
posición (el parser plano anterior las desplazaba y mezclaba roles).

Pasos:
1. **Columnas reales**: se derivan de los CENTROS del time-row (siempre alineado), no de
   la cabecera — cubre cuadrantes con cabeceras escalonadas en diagonal.
2. **Etiquetas de sesión**: detecta `SESIÓN N` / `SESION N` / `Sn`, acumuladas aunque
   estén en líneas distintas, y se mapean a la columna más cercana.
3. **Pesaje**: el 2º time-row del bloque (o el marcador `PESAJE y REVISIÓN`) inicia el
   bloque de pesaje sobre las mismas columnas.
4. **Fila → rol**: expande los roles de la plantilla en orden
   (Central → Lateral×2 → Ordenador → Speaker/Mesa → Control [→ Jurado×3 en AEP-1]).
5. **Flags**: `*` = compartido, `↑↓` = intercambio.
6. **Match de nombres**: aliases normalizados (sin acentos/puntuación).

Formatos soportados: rejilla `S1 S2 S3` (AEP-1), `SESION N` con pesaje por 2º horario
(AEP-2/3), cabeceras escalonadas (VISODESANJUAN). Los escaneados (imagen, 0 texto) fallan
con aviso accionable. `quadrant-parser.ts` (plano) queda como fallback heurístico.

**Extracción** (`extract-pdf-text.ts`, `extractPdfLayoutText`): prefiere `pdftotext -layout`
(local/CI) → reconstrucción geométrica con **pdf.js** desde las posiciones x/y (JS puro,
funciona en Vercel serverless) → pdf-parse plano + OCR como último recurso.

### Parser de horarios (`src/lib/schedule-parser/`)

Módulo multi-archivo que convierte texto de horarios AEP en `RosterSession[]`:

| Archivo | Rol |
|---|---|
| `parse-aep-horario-text.ts` | Parser determinista: días, sesiones, grupos, horarios |
| `to-roster-template.ts` | Convierte `ParsedHorario` a plantilla de tarima |
| `extract-pdf-text.ts` | Extracción de texto del PDF |
| `types.ts` | Tipos intermedios |

Soporta formatos: sesión única/multi-día, categorías inline o en línea siguiente, grupos con totales, horarios `Pesaje HH:MM - HH:MM / Inicio HH:MM / Fin HH:MM`.

### Registro de jueces y arbitrajes por año (`src/lib/judges-registry/`)

El XLSX del registro trae varias hojas de arbitrajes por año natural
(`Arbitrajes2024`, `Arbitrajes2025`, `Arbitrajes2026`…).

- `parse-xlsx.ts` lee **todas** las hojas `ArbitrajesAAAA` (no solo la del año en curso): construye el desglose por año y el agregado histórico. Cada juez expone `arbitrajeStatsByYear` (desglose) y el total agregado.
- `arbitraje-stats.ts` define el tipo `RefereeArbitrajeStatsByYear` (`{ "2024": {…}, "2025": {…} }`) y los helpers `aggregateArbitrajeYears()` (suma todos los años en un único agregado) y `arbitrajeYears()` (años con actividad, desc).
- Distingue **censo** (arbitrajes de un año natural concreto) de **histórico** (agregado de todos los años): el componente `referee-arbitraje-panel.tsx` ofrece un selector de año natural + «Histórico», y `referees-directory.tsx` filtra el censo por año natural.

## Capa de servicios (v1.2)

`src/server/services/` usa barrel pattern: cada archivo principal re-exporta módulos de dominio.

| Barrel | Módulos de dominio |
|---|---|
| `supabase-service.ts` | `supabase-referees`, `supabase-competitions`, `supabase-roster`, `supabase-analytics`, `supabase-exams`, `supabase-compensation`, `supabase-tickets`, `supabase-helpers` |
| `memory-service.ts` | `memory-referees`, `memory-competitions`, `memory-analytics`, `memory-admin`, `memory-compensation`, `memory-tickets`, `memory-helpers` |

Fuera de los barrels: `referee-sanctions.ts` (sanciones, solo Supabase), `admin-users.ts` / `admin-audit.ts` (gestión de cuentas) e `import-judges-registry.ts` (censo XLSX). Los módulos reciben funciones como argumentos para evitar imports circulares.

**Paridad memoria ↔ Supabase.** El backend en memoria (dev local y capturas de documentación con `AEP_DOCS_CAPTURE=1`) debe comportarse igual que el de Supabase: mismas validaciones, mismos errores y mismas reglas de negocio (p. ej. no tocar liquidaciones pagadas al recalcular). Lo que solo existe en Supabase (sanciones) responde un `503` explícito en memoria, nunca una lista vacía.

## Contrato de errores y lecturas

- **Una lectura que falla no es una lista vacía.** Los servicios lanzan cuando Supabase devuelve `error`; presentar «no hay nada» llevaba a decisiones equivocadas (un juez sancionado que sale limpio, un total de 0 € presentado como dato).
- **Errores para el usuario**: `UserFacingServiceError(mensaje, status)` (`src/lib/competitions/service-types.ts`) atraviesa `jsonRouteError` con su mensaje y su código (400/403/409/423/503…). Cualquier otra excepción sale como 500 con un mensaje genérico en español y queda registrada; nunca se filtran mensajes de Postgres al navegador.
- **Paginación**: PostgREST corta en 1000 filas. Toda lectura que pueda crecer usa `fetchAllPagesOf` (`supabase-helpers.ts`) con un orden total (columna de negocio + `id` como desempate); sin desempate, paginar duplica o pierde filas.
- **Fechas de negocio**: `src/lib/business-date.ts` (`todayIso`, `addDaysIso`, `businessDayIso`) calcula el día natural en `Europe/Madrid`. El servidor corre en UTC; usar `new Date().toISOString()` daba el día equivocado entre medianoche y las 01:00–02:00. Las fechas de entrada se validan con `isIsoDate` (`src/app/api/_lib/validation.ts`), que rechaza días que no existen (`2026-02-30`).
- **Zonas**: `resolveZoneCode` / `zonesMatch` / `zoneScopeOf` (`src/lib/aep-zones.ts`) canonicalizan alias y tildes. Los permisos zonales son *fail-closed*: un delegado sin zona o con una zona ilegible no ve nada, en lugar de verlo todo.
- **Dinero congelado**: una liquidación `pagado` no se recalcula, no se borra y no admite cambios de importe (`423 Locked`, `CompensationClaimPaidError`); el juez pagado tampoco puede salir del hueco de la tarima.

## Trabajo simultáneo (varios delegados a la vez)

Ninguna escritura concurrente se pierde en silencio: o se aplica, o la segunda persona recibe un `409` que le pide actualizar.

| Operación | Cómo se protege |
|---|---|
| Asignar un juez a un hueco vacío | `INSERT` (no upsert): la clave primaria `(competition_id, slot_key)` rechaza al segundo (`23505` → conflicto). |
| Sustituir / liberar / marcar `*` o `↑↓` | `UPDATE`/`DELETE … WHERE referee_id = <el que se leyó>` con `.select()`: cero filas afectadas = otro lo cambió. Atómico en Postgres, sin ventana entre leer y escribir. |
| Importar cuadrante | Huecos vacíos con `INSERT … ON CONFLICT DO NOTHING`; ocupados, `UPDATE` condicional. Los que perdieron la carrera vuelven como fallidos con su motivo. |
| Guardar la plantilla | Concurrencia optimista: el cliente envía `baseHash` (`rosterTemplateHash`, FNV-1a sobre JSON con claves ordenadas) de la versión sobre la que editó; si la guardada ya es otra, `409` y el usuario elige sobrescribir o cargar la actual. |
| Liquidaciones | Compare-and-set sobre `updated_at` (`409`). |
| Revisar propuestas y ascensos | Solo pasan si siguen pendientes. |
| Editar campeonato | El diálogo envía solo los campos cambiados: no revierte lo que otro corrigió en otro campo. |

**Sincronización en vivo:** cada escritura sube `app_sync_state.version`; los clientes refrescan agrupando ráfagas (600 ms, máximo 2 s). Una pestaña oculta no refresca: apunta el cambio y se pone al día al volver. Mientras alguien edita la plantilla o tiene una operación en curso, el constructor de la tarima aparta los datos que llegan y, al terminar, pide los actuales (nunca aplica una instantánea vieja).

## Responsive / breakpoints

Tailwind breakpoints utilizados:

| Breakpoint | Ancho mínimo | Dispositivo referencia |
|---|---|---|
| `sm` | 640px | — |
| `md` | 768px | iPad portrait |
| `lg` | 1024px | iPad landscape |
| `xl` | 1280px | MacBook Pro M1 14" (~1512px CSS) |
| `2xl` | 1536px | Pantallas grandes |

**Importante**: MacBook Pro M1 14" genera ~1512px CSS — alcanza `xl` pero **no** `2xl`. Los layouts de dos columnas del dashboard y la fila de KPIs usan `xl:` (no `2xl:`) para que se vean correctamente en portátil pequeño. La rejilla de KPIs ajusta sus columnas al número de tarjetas.

- **< 768 px (`md`)**: no hay menú lateral; un cajón (`app-shell.tsx`) se abre desde el botón ☰ de la barra superior, incluye el buscador y se cierra al navegar o con Escape.
- **768–1024 px**: el sidebar se auto-colapsa en el primer render si el usuario no eligió antes; la preferencia se persiste en `localStorage`.
- Las tablas anchas (compensación, directorio) viven dentro de contenedores con `overflow-x-auto`: la página nunca desborda en horizontal (comprobado a 375 px en todas las rutas).

## Seguridad

- Middleware protege rutas privadas.
- API privada exige `requireApiUser`.
- Mutaciones exigen RBAC explícito.
- Supabase cliente anon/authenticated no lee tablas sensibles por RLS.
- Service role solo en servidor.
- `parseApiResponse` valida `content-type: application/json` antes de llamar `.json()` para evitar crash en respuestas HTML de error.

## Sincronización en tiempo real (v1.8)

- Tabla `app_sync_state` (migración `029`) con triggers en 13 tablas operativas.
- Cliente: `AppRealtimeSync` en el shell — escucha Realtime + poll de respaldo cada 30 s.
- Al cambiar versión: `router.refresh()` para RSC; estado cliente (tarima, compensación) se sincroniza vía props SSR.
- Archivos: `src/components/realtime/`, `src/hooks/use-app-data-sync.ts`, `src/lib/realtime/sync-events.ts`.

## Rendimiento (v1.8)

- `getCompetition` carga solo asignaciones del campeonato (no toda la tabla).
- Hub compensación en batch (plantillas, claims, árbitros en pocas consultas).
- `getNavCountsFast` — contadores de navegación sin plantillas JSON.
- `cachedLoadAllAssignments` y `getSession` con `React.cache` por petición SSR.
- `loadRosterAssignmentData` — una consulta para assignments/flags/cross-zone.
- Caché TTL 1 h para `zones` y `regulation_rules` (`src/server/cache/static-data.ts`).
- Filtros SQL en directorio de jueces (zona, nivel, estado, búsqueda `ilike`).
- Índices Postgres (migraciones `030` y `039`).

## Rendimiento (v2.4)

- **Sentry bajo demanda**: `src/instrumentation-client.ts` solo importa el SDK si hay DSN; los `error.tsx` reportan con `reportClientError`. El JS compartido de cada página bajó de 185 kB a 105 kB.
- **Recalcular compensación** en paralelo acotado (`mapWithConcurrency`, `src/lib/async-pool.ts`, 6 a la vez), saltando las liquidaciones pagadas y borrando huérfanas en una sola consulta.
- **Contadores de navegación** (`getNavCountsFast`): `count` con `head: true` y lectura acotada de campeonatos vigentes, sin descargar el calendario entero.
- Alta de campeonato y desplegables de campeonatos paginados con `fetchAllPagesOf`.
- **Tarima**: la página carga campeonato y tarima con `getCompetitionWithRoster` (2 consultas; antes 6). Las escrituras validan con `getCompetitionRow` (sin recalcular la cobertura) y, al asignar, la cobertura se calcula con los datos releídos tras escribir y se guarda en paralelo con el historial.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
