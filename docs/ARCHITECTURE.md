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

## Capa de servicios (v1.2)

`src/server/services/` usa barrel pattern: cada archivo principal re-exporta módulos de dominio.

| Barrel | Módulos de dominio |
|---|---|
| `supabase-service.ts` | `supabase-referees`, `supabase-competitions`, `supabase-roster`, `supabase-analytics`, `supabase-exams`, `supabase-helpers` |
| `memory-service.ts` | `memory-referees`, `memory-competitions`, `memory-analytics`, `memory-admin`, `memory-helpers` |

Todos los archivos ≤ 500 líneas. Módulos reciben funciones como args para evitar imports circulares.

## Seguridad

- Middleware protege rutas privadas.
- API privada exige `requireApiUser`.
- Mutaciones exigen RBAC explícito.
- Supabase cliente anon/authenticated no lee tablas sensibles por RLS.
- Service role solo en servidor.
- `parseApiResponse` valida `content-type: application/json` antes de llamar `.json()` para evitar crash en respuestas HTML de error.
