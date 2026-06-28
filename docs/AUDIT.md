# QA y seguridad

Última revisión: junio 2025 (auditoría completa + hardening continuo). Alcance: repo, CI GitHub, flujos usuario comunes.

## Veredicto

App operativa y desplegable. CI verde, **312 tests**, lint 0 warnings, build OK. Multi-temporada: analytics y KPIs por fechas ISO; UI sin año fijo salvo documentos normativos (`aep-guide-2026.ts`).

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | `POST /auth/login` server-side; rate-limit IP+email; acciones `fail`/`success` bloqueadas en `/auth/password` |
| Dashboard 14" | OK | Smoke sin overflow horizontal |
| Dashboard zonal | OK | `delegado_zona` ve solo KPIs, calendario, intelligence y actividad de su zona |
| Campeonatos | OK | `/competitions`, dedupe, import calendario con preview/selección |
| Tarima | OK | Plantilla, cuadrante, asignación, plazas requeridas, confirm-to-force *, clear con rollback |
| Conflictos sesión | OK | Tarima+tarima bloqueado; tarima+pesaje misma sesión permitido; cross-sesión con * |
| Imports horario | OK | Merge parcial: sesiones no seleccionadas se conservan |
| Cuadrantes | OK | Parser por geometría de columnas; 4 formatos AEP |
| Usuarios | OK | Gestión restringida a nacional/superadmin |
| Contraseñas | OK | Self-change + admin-reset |
| Ascensos | OK | Comentario de rechazo persistido (`review_comment`) |
| Ficha juez | OK | Historial real desde `roster_assignments`; domicilio para compensación |
| Compensación | OK | Rol financiero, claims persistidos, export PDF con IBAN efímero |

## Ciberseguridad

| Control | Estado |
|---|---|
| Auth middleware | OK |
| API `requireApiUser` | OK |
| RBAC mutaciones | OK |
| RBAC zona normalizado | OK (`resolveZoneCode`, fail-closed) |
| RLS Supabase | OK, deny-by-default |
| Login brute force | Mitigado: check público + login server-side registra fallos |
| Enumeración login | OK: mensaje genérico |
| Competition PATCH | OK: whitelist de campos editables |
| Sanction bypass | OK: no reactivar juez con sanción activa |
| Imports PDF/XLSX | OK: límites, MIME, preview obligatorio |
| Dependencias | OK salvo `xlsx` documentado |

## Validaciones roster (servidor)

| Regla | Estado |
|---|---|
| Slot key en plantilla | OK — rechazado si no existe en template |
| `countOpenSlots` sin huérfanos | OK — solo cuenta asignaciones con clave válida |
| TOCTOU assign | Mitigado — revalidación post-upsert; rollback si conflicto |
| Promotion downgrade | OK — solo ascenso si `toLevel` > nivel actual |

## Riesgos vivos

- `xlsx` mantiene advisories sin fix upstream público.
- OCR/PDF depende de herramientas locales en algunos entornos.
- E2E profundo (import horario → cuadrante → export) pendiente.
- E2E smoke compensación pendiente.
- CSP estricta en modo report-only.

## Gates obligatorios

```bash
npm run verify
npm run e2e
npm run audit:remote
```

GitHub CI ejecuta verify, browser smoke y Supabase readiness en cada push a `main`.

Últimos gates locales:

- `npm run verify`: 50 rutas API, 4 rutas import, seguridad, lint, **298 tests**, build OK.
- `npm run e2e`: 3 tests Playwright OK (viewport 14").
- `npm run audit:remote`: Supabase readiness OK.
