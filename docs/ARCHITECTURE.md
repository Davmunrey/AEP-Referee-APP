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

## Tarima

1. Campeonato obtiene plantilla guardada (`competitions.template`) o preset por tipo.
2. Usuario puede importar horario PDF o editar plantilla manual.
3. Usuario importa cuadrante PDF o asigna manual.
4. API valida zona, rol y solapes.
5. Borrador, historial y aprobación quedan trazados.

## Historial de juez

- Fuente única: `roster_assignments`.
- Cada slot se interpreta como `sesion_rol_indice`.
- La ficha de juez agrega por campeonato y conserva posiciones exactas: sesión, rol, hueco y flags de compartido/intercambio.
- El mismo helper de dominio alimenta Supabase y memoria dev para evitar divergencias.

## Imports

- Calendario anual: PDF/CSV -> preview -> selección -> crear campeonatos.
- Horario competición: PDF -> preview sesiones -> selección -> guardar plantilla.
- Cuadrante jueces: PDF -> preview candidatos -> selección -> asignar.
- Registro jueces: XLSX -> preview -> upsert/replace.

### Parser de cuadrantes (`src/lib/quadrant-parser.ts`)

Extrae asignaciones de jueces de PDFs AEP. Orden de roles confirmado con cuadrantes oficiales (AEP1, AEP2, AEP3):

```
Central → Lateral → Lateral → Ordenador → Speaker/Mesa → Control [→ Jurado ×3 en AEP1]
```

El texto del PDF se organiza por columnas (sesiones) × filas (roles). El parser detecta:
1. **Sesiones**: regex `S(\d+)` o `SESIÓN N`.
2. **Ancla de leyenda**: cluster de 2+ etiquetas de rol dentro de 200 chars — separa la zona de asignaciones del bloque de leyenda lateral.
3. **Región pesaje**: split entre asignaciones de tarima y pesaje/equipamiento por cluster de sesiones o keyword `PESAJE`.
4. **Match de nombres**: aliases normalizados (sin acentos, sin puntuación) ordenados por longitud descendente para evitar solapamientos parciales.

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
