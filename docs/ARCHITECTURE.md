# Arquitectura

```text
Browser -> Next.js App Router -> /api/v1 -> dataService -> Supabase service
                                      \-> memory service solo dev sin Supabase
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

Dominio compensación: `src/lib/judge-compensation/` (baremo, classify, calculate, recibo PDF). Ubicaciones: **Photon/OpenStreetMap** en cliente (`AddressAutocompleteField`) + Nominatim/OSRM en servidor (gratuito).
Servicios: `supabase-compensation.ts`, `memory-compensation.ts`.

## Tarima

1. Campeonato obtiene plantilla guardada (`competitions.template`) o preset por tipo.
2. Usuario puede importar horario PDF o editar plantilla manual.
3. Usuario importa cuadrante PDF o asigna manual.
4. API valida zona, rol y solapes.
5. Borrador, historial y aprobación quedan trazados.

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
- Registro jueces: XLSX -> preview -> upsert/replace.

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

## Capa de servicios (v1.2)

`src/server/services/` usa barrel pattern: cada archivo principal re-exporta módulos de dominio.

| Barrel | Módulos de dominio |
|---|---|
| `supabase-service.ts` | `supabase-referees`, `supabase-competitions`, `supabase-roster`, `supabase-analytics`, `supabase-exams`, `supabase-helpers` |
| `memory-service.ts` | `memory-referees`, `memory-competitions`, `memory-analytics`, `memory-admin`, `memory-helpers` |

Todos los archivos ≤ 500 líneas. Módulos reciben funciones como args para evitar imports circulares.

## Responsive / breakpoints

Tailwind breakpoints utilizados:

| Breakpoint | Ancho mínimo | Dispositivo referencia |
|---|---|---|
| `sm` | 640px | — |
| `md` | 768px | iPad portrait |
| `lg` | 1024px | iPad landscape |
| `xl` | 1280px | MacBook Pro M1 14" (~1512px CSS) |
| `2xl` | 1536px | Pantallas grandes |

**Importante**: MacBook Pro M1 14" genera ~1512px CSS — alcanza `xl` pero **no** `2xl`. Los layouts de dos columnas del dashboard y los KPI de 5 columnas usan `xl:` (no `2xl:`) para que se vean correctamente en portátil pequeño.

El sidebar se auto-colapsa en `< 1024px` (primer render en tablet) para liberar espacio. El usuario puede expandirlo manualmente; la preferencia se persiste en localStorage.

## Seguridad

- Middleware protege rutas privadas.
- API privada exige `requireApiUser`.
- Mutaciones exigen RBAC explícito.
- Supabase cliente anon/authenticated no lee tablas sensibles por RLS.
- Service role solo en servidor.
- `parseApiResponse` valida `content-type: application/json` antes de llamar `.json()` para evitar crash en respuestas HTML de error.
