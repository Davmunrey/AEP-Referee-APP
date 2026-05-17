# Arquitectura — AEP Tarima

## Visión general

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Browser    │────▶│  Next.js 15 App  │────▶│  /api/v1/*      │
│  (React 19) │     │ Supabase Middlew.│     │  Route Handlers │
└─────────────┘     └──────────────────┘     └────────┬────────┘
                                                       │
                                              ┌────────▼────────┐
                                              │  dataService    │
                                              └────────┬────────┘
                              ┌────────────────────────┴──────────────┐
                     ┌────────▼────────┐                    ┌─────────▼───────┐
                     │  supabase-service│                    │ memory-service  │
                     └─────────────────┘                    └─────────────────┘
```

## Capas

### Presentación (`src/app`, `src/components`)

- **App Router** — `src/app/(dashboard)/*`
- **Server Components** — datos vía `dataService`
- **Client** — tarima, editor de plantilla, formularios (`"use client"`)

### API (`src/app/api/v1`)

Handlers REST → `dataService`. Rutas de tarima relevantes:

| Ruta | Métodos |
|------|---------|
| `/competitions/[id]/roster` | GET |
| `/competitions/[id]/roster/template` | PUT |
| `/competitions/[id]/roster/flags` | PATCH |
| `/competitions/[id]/roster/assign` | POST |
| `/competitions/[id]/roster/clear` | POST |
| `/competitions/[id]/roster/draft` | POST |
| `/competitions/[id]/roster/submit` | POST |
| `/competitions/[id]/roster/export` | GET |
| `/competitions/[id]/roster/history` | GET |

Lista completa en [`API.md`](./API.md).

### Servicio de datos (`src/server`)

- **`services/index.ts`** — Supabase vs memoria según env
- **`supabase-service.ts`** — Postgres + service role
- **`memory-service.ts`** — desarrollo sin Supabase
- **`db/mappers.ts`** — filas ↔ tipos TS

### Dominio tarima (`src/lib`)

| Módulo | Rol |
|--------|-----|
| `roster-template.ts` | `getPresetForEventType`, `enumerateSlotKeys`, `pruneAssignments` |
| `roster-rules.ts` | Validación nivel mínimo |
| `roster-export.ts` | Acta TXT con flags `*` / `↑↓` |
| `mock-data.ts` | `PRESET_AEP1`, `PRESET_AEP2`, `PRESET_AEP3` |

## Plantilla por evento

1. **Lectura:** `getCompetitionTemplate(eventId)` — si `competitions.template` es null, preset por `tipo`.
2. **Escritura:** `saveCompetitionTemplate` — persiste JSON, ejecuta `pruneAssignments` (elimina asignaciones/flags de slots que ya no existen).
3. **Flags:** `setSlotFlags` — actualiza `roster_assignments.flags` por `slot_key`; exige juez asignado.

## RBAC

| Rol | Tarima / plantilla | Aprobar | Usuarios |
|-----|-------------------|---------|----------|
| `super_admin` | toda federación | sí | sí |
| `delegado_jueces` | toda federación | sí | sí |
| `delegado_zona` | su `zona` | no | no |
| `solo_ver` | lectura | no | no |

Helpers: `src/lib/auth/session.ts` — `canEditRoster`, `canApprove`, `canManageUsers`, etc.

Primer registro → `super_admin`. Detalle: [`AUTH.md`](./AUTH.md).

## Flujo de tarima

1. Delegado abre `/events/[id]` — ve plantilla (guardada o preset).
2. Opcional: **Editar plantilla** → `PUT .../roster/template`.
3. Asigna jueces → `POST .../assign`; flags → `PATCH .../flags`.
4. Validación normativa en cliente (`roster-rules`).
5. Borrador o **Enviar a aprobación** → `approval_proposals`.
6. `super_admin` / `delegado_jueces` aprueban en `/approvals`.

## Inteligencia del dashboard

`getDashboard()` + `buildIntelligence()` — salud 0–100 e insights sin entrada manual. `health_snapshots` (004) para histórico.

## Validaciones clave

- Nivel mínimo por rol y tipo (matriz AEP).
- Un juez, un slot activo.
- Solo jueces activos y disponibles en pool.
- Rechazo de aprobación con comentario obligatorio.
- Confirmación si roster incompleto al enviar.
