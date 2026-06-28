# QA y seguridad

Última revisión: junio 2026. Alcance: repo, CI GitHub, flujos usuario comunes.

Producción: [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

## Veredicto

App operativa y desplegable. CI verde, **331 tests** (57 archivos), lint OK, build OK.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | `POST /auth/login` server-side; rate-limit IP+email |
| Dashboard | OK | KPIs, salud, recomendaciones; smoke 14" sin overflow |
| Dashboard zonal | OK | `delegado_zona` acotado por macrozona |
| Campeonatos | OK | Alta, dedupe, import calendario con preview |
| Tarima | OK | Plantilla, cuadrante, asignación, imprevistos, badges compactos |
| Conflictos sesión | OK | Tarima+tarima bloqueado; tarima+pesaje forzable con confirmación |
| Imports horario | OK | Merge parcial de sesiones |
| Cuadrantes | OK | Parser por geometría; 4 formatos AEP |
| Normativa | OK | 4 pestañas en `/regulations` |
| Domicilio OSM | OK | Autocomplete vía API servidor (CSP); Nominatim al guardar |
| Compensación | OK | Hub, km manual, montaje sistema, export PDF IBAN efímero |
| Ayuda | OK | Widget guía + asistente (Gemini opcional + fallback local) |
| Usuarios / contraseñas | OK | Self-change + admin-reset |
| Ascensos | OK | `review_comment` al rechazar |

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

## Riesgos vivos

- `xlsx` mantiene advisories sin fix upstream público.
- OCR/PDF depende de herramientas locales en algunos entornos.
- E2E profundo (import → cuadrante → export) pendiente.
- E2E smoke compensación pendiente.

## Gates obligatorios

```bash
npm run verify
npm run e2e
npm run audit:remote
```

GitHub CI ejecuta verify, browser smoke y Supabase readiness en cada push a `main`.

Últimos gates locales (jun 2026):

- `npm run verify`: lint, **331 tests**, build OK.
- `npm run e2e`: smoke Playwright OK (viewport 14").
- `npm run audit:remote`: Supabase readiness OK.
