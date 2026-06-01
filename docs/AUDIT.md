# QA y seguridad

Fecha: 2026-06-01. Alcance: repo local + CI GitHub + flujos usuario comunes.

## Veredicto

App operativa y desplegable. CI verde (Verify · Supabase readiness · Browser smoke), 198 tests, lint 0 warnings, build OK, 0 drift de migraciones. Pendiente: e2e profundo en navegador logueado de tarima/import/export, guía con fotos de pantallas internas, y sustitución futura de `xlsx` si aparece alternativa mantenida. PDFs de cuadrante escaneados (imagen) no se importan — fallan con mensaje accionable.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | E2E real con Supabase en CI |
| Dashboard 14" | OK | Smoke sin overflow horizontal |
| Campeonatos | OK | `/competitions`, dedupe, import calendario con preview/selección |
| Tarima | OK | Plantilla, cuadrante, asignación, clear, historial, export |
| Cuadrantes | OK | Parser por geometría de columnas; 4 formatos AEP (rejilla, `SESION N`, escalonado, escaneado→aviso). Verificado con PDFs reales |
| Imports | OK | Preview antes de aplicar, selección granular, límites tamaño |
| Usuarios | OK | Gestión restringida a nacional/superadmin |
| Contraseñas | OK | Self-change (verifica actual) + admin-reset; guard super_admin cruzado |
| Informes | OK | Scope por zona/nacional |
| Exámenes/ascensos | OK | Modelo restringido a nuevos jueces, IPF, recertificación y ascensos |
| Ficha juez | OK | Historial real por campeonato con sesión, rol, hueco y flags desde `roster_assignments` |

## Ciberseguridad

| Control | Estado |
|---|---|
| Auth middleware | OK |
| API `requireApiUser` | OK, auditado por `audit:prod` |
| RBAC mutaciones | OK, auditado por `audit:prod` |
| RLS Supabase | OK, deny-by-default en migraciones |
| Headers seguridad | OK: nosniff, DENY iframe, referrer policy, permissions policy, HSTS |
| Cache API | OK: JSON API privada fuerza `Cache-Control: private, no-store` |
| Login brute force | Mitigado: rate-limit app IP+email + Supabase Auth 429 |
| Enumeración login | OK: mensaje genérico para cualquier fallo |
| Sesión | Mitigado: TTL cookie 7 días; `HttpOnly` pendiente de auth server-side |
| RBAC zona | OK: referee, roster, history/export, exams, sanctions |
| Admin users | OK: solo `super_admin` puede tocar otro `super_admin` |
| Secrets | OK: GitHub Secrets, no valores en repo |
| Imports PDF | OK: MIME, tamaño, firma `%PDF-`, timeout extractor |
| Imports XLSX | Mitigado: auth nacional, confirmación explícita replace, tamaño 8 MB, firma ZIP, límites hojas/filas/columnas |
| Dependencias | OK salvo `xlsx` sin fix upstream, aceptado por `audit:security` con mitigación |

## Riesgos vivos

- `xlsx` mantiene advisories sin versión npm segura pública. Mantener uso solo server-side y nacional. Sustituir cuando exista alternativa viable.
- OCR depende de herramientas locales (`pdftotext`, `pdftoppm`, `swift`) y puede variar por host.
- Falta e2e happy-path completo: importar horario, importar cuadrante, aplicar, exportar.
- CSP estricta sigue en modo report-only por Next inline scripts; pasar a enforce tras observar reportes.

## Gates obligatorios

```bash
npm run verify
npm run e2e
npm run audit:remote
```

GitHub CI ejecuta verify, browser smoke y Supabase readiness en cada push a `main`.

Últimos gates locales aplicados:

- `npm run verify`: 47 rutas API, 4 rutas import, seguridad, lint (0 warnings), 198 tests y build Next OK.
- `npm run e2e`: 3 tests Playwright OK en viewport 14".
- `npm run audit:remote`: Supabase readiness OK; 15 tablas; usuarios activos permitidos vía `READINESS_ALLOWED_EMAILS` (super_admin + delegados AEP).
- `npm run migration:status`: 13 migraciones verificables aplicadas, 0 drift.
