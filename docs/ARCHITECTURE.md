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

## Imports

- Calendario anual: PDF/CSV -> preview -> selección -> crear campeonatos.
- Horario competición: PDF -> preview sesiones -> selección -> guardar plantilla.
- Cuadrante jueces: PDF -> preview candidatos -> selección -> asignar.
- Registro jueces: XLSX -> preview -> upsert/replace.

## Seguridad

- Middleware protege rutas privadas.
- API privada exige `requireApiUser`.
- Mutaciones exigen RBAC explícito.
- Supabase cliente anon/authenticated no lee tablas sensibles por RLS.
- Service role solo en servidor.
