# QA y seguridad

Última revisión: junio 2026 (v1.8). Alcance: repo, CI GitHub, flujos usuario comunes.

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

## Veredicto

App **operativa en producción** en Vercel. CI verde, **331 tests** (57 archivos), lint OK, build OK. Migraciones hasta `030` aplicadas en Supabase.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | `POST /auth/login` server-side; rate-limit IP+email |
| Dashboard | OK | KPIs, salud, recomendaciones; sincronización en vivo |
| Dashboard zonal | OK | `delegado_zona` acotado por macrozona |
| Campeonatos | OK | Alta, dedupe, import calendario con preview |
| Tarima | OK | Plantilla, cuadrante, asignación, imprevistos, badges compactos |
| Realtime | OK | Cambios propagados entre usuarios (Supabase Realtime + poll 30 s) |
| Conflictos sesión | OK | Tarima+tarima bloqueado; tarima+pesaje forzable con confirmación |
| Imports horario | OK | Merge parcial de sesiones |
| Cuadrantes | OK | Parser por geometría; 4 formatos AEP |
| Normativa | OK | 4 pestañas en `/regulations` |
| Domicilio OSM | OK | Autocomplete API servidor; eliminar ubicación guardada |
| Compensación | OK | Hub batch, km manual, montaje sistema, export PDF IBAN efímero |
| Ayuda | OK | Widget guía + asistente (Gemini opcional + fallback local) |
| Usuarios / contraseñas | OK | Self-change + admin-reset |
| Ascensos | OK | `review_comment` al rechazar |
| Rendimiento | OK | Consultas optimizadas, caché estática, índices Postgres |

## Ciberseguridad

| Control | Estado |
|---|---|
| Auth middleware | OK |
| API `requireApiUser` | OK |
| RBAC mutaciones | OK |
| RBAC zona (`resolveZoneCode`) | OK — fail-closed |
| RLS Supabase | OK, deny-by-default |
| Login brute force | Mitigado |
| CSP | OK — mapas solo vía API propia |
| IBAN compensación | OK — efímero, no persiste |
| Imports PDF/XLSX | OK — límites y preview |
| Realtime `app_sync_state` | OK — solo SELECT authenticated |

## Riesgos vivos (backlog)

- `xlsx` mantiene advisories sin fix upstream público.
- OCR/PDF depende de herramientas del entorno serverless en algunos casos.
- E2E profundo (import → cuadrante → export) pendiente.
- E2E smoke compensación pendiente.

## Comandos verificación (mantenedores)

```bash
npm run verify
npm run e2e
npm run audit:remote
```
