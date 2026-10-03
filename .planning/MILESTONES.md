# Milestones — AEP Tarima

## v2.4 — Producto pulido (2026-10)

- Auditoría pantalla a pantalla (escritorio y 375 px): flujo de tarima nueva, envío a aprobación con motivo cuando no se puede, panel de jueces que dice qué oculta
- Liquidaciones pagadas congeladas (`423`), revisiones con decisión booleana y motivo obligatorio, fechas y niveles inexistentes rechazados
- Navegación móvil (cajón), menú en cinco grupos, `MetricTile` único, plurales y vocabulario homogéneos, cabeceras sin duplicados
- Rendimiento: Sentry bajo demanda (185 → 105 kB de JS compartido), migración `039` (índices en claves ajenas), recálculo en paralelo acotado
- 1233 tests (1234 con 1 skip), 200 archivos; toda la documentación sincronizada a v2.4

## v2.3 — Cero silencios (2026-09)

- PRs #76–#180: lecturas fallidas que se presentaban como vacías, paginación con desempate, dinero pagado que congela la tarima, compare-and-set contra ediciones simultáneas
- Zonas canonicalizadas y permisos zonales *fail-closed*; fechas de negocio en `Europe/Madrid`
- Migraciones `037` (RLS) y `038` (alta sin bandera `invited`); reproducción de migraciones en CI

## v2.2 — Migraciones automáticas (2026-07/08)

- Workflow «Migraciones Supabase» con registro propio, modo plan y portero anti-destructivo; migraciones `034`–`036`
- CVE de Next.js cerradas; auditoría de la base de datos (`docs/AUDIT-DATABASE.md`)

## v2.1 — La Gran Auditoría (2026-07)

- Cinco rondas de auditoría (bugs, rendimiento, diseño, accesibilidad); zona de Soporte (migración `035`); pantallas esqueleto en todas las rutas

## v2.0 — Centro de ayuda local, sin IA (2026-07)

- Centro de ayuda rediseñado: buscador local sobre la base de conocimiento (~35 temas) + primeros pasos por rol + temas frecuentes; 100 % en cliente, sin IA ni red
- Retirada del asistente IA: eliminados la ruta `POST /api/v1/assistant`, el cliente Gemini, el prompt de anclaje y el rate-limit en memoria; se conserva la base de conocimiento para el buscador
- Título de pestaña simplificado a «AEP Tarima»
- Triaje de Sentry: 3 issues del 28-jun resueltos (PGRST204 transitorio, ENOENT pdfkit ya corregido); refresh token del middleware capturado (PR #69)
- 337 tests (338 con 1 skip), 59 archivos; toda la documentación sincronizada a v2.0

## v1.9 — Censo anual, selección rápida y seguridad (2026-07)

- Arbitrajes por año natural: parser de todas las hojas `ArbitrajesAAAA`, columna `referees.arbitraje_stats_by_year` (migración 032); ficha de juez con selector de año + Histórico; directorio con filtro de censo por año
- Recibo de compensación con organizador de 3 opciones (club / «Asociación Española de Powerlifting» / personalizable, migración 031); PDF con logo; correos de pie variables
- Selección rápida de jueces subordinada a la disponibilidad; orden por idoneidad; nivel recomendado como aviso
- Import Excel maestro «reemplazar censo» seguro (conserva campeonatos, cuadrantes y asignados)
- Seguridad: RLS endurecido (migración 033, elimina políticas permisivas en `referee_sanctions` y `competition_availability`)
- PRs #48–#52; 354 tests (355 con 1 skip), 61 archivos; migraciones hasta 033 en producción
- Pendiente: activar Leaked Password Protection en Supabase Auth (toggle manual)

## v1.8 — Producción Vercel, realtime y rendimiento (2026-06)

- Plataforma operativa en **https://aep-tarima.vercel.app** (deploy automático)
- Realtime Supabase (`app_sync_state`, migración 029)
- Rendimiento: consultas batch, React.cache, nav counts, hub compensación
- Caché TTL zonas/normativa; filtros SQL jueces; índices (migración 030)
- Botón eliminar ubicación domicilio
- 331 tests; documentación completa v1.8

## v1.7 — Normativa, docs y pulido UX (2026-06)

- URL oficial `aep-tarima.vercel.app`
- Normativa 4 pestañas + panel compensación normativa
- Asistente ayuda completo (KB + quick-start + Gemini)
- Geocode autocomplete vía API servidor
- Badges nivel compactos en tarima
- Migración 028, correos Supabase branding

## v1.6 — Compensation Hub & km manual (2026-06)

- Panel `/compensation` + API hub
- Km manual, comparte, montaje sistema
- ~180 clubes AEP, multi-club
- Migraciones 026–027

## v1.5 — Compensation & UI (2026-06)

- Migraciones 023–025 en Supabase producción
- Compensación end-to-end, IBAN efímero
- Rol `responsable_financiero_jueces`
- UI tarima densa

## v1.4 — Production Hardening (2025-06)

- Roster: plazas requeridas, conflictos, imprevistos
- Privacidad zonal, login server-side
- Multi-temporada (`season.ts`)

## v1.1 — Completeness & Workflow (2025-05)

Cross-zone assignment, template editor, PDF imports, availability per competition, analytics coverage, roster UI enhancements.

## v1.2 — Quality & Completeness

Competition edit, test correctness, refactor archivos >500 líneas.
