# QA y seguridad

Fecha: 2026-05-21. Alcance: repo local + CI GitHub + flujos usuario comunes.

## Veredicto

App en beta operativa. No 100% final: queda parser OCR/cuadrantes con documentos raros, e2e profundo tarima/import/export, y sustitución futura de `xlsx` si aparece alternativa mantenida.

## QA operativo

| Área | Estado | Notas |
|---|---|---|
| Login | OK | E2E real con Supabase en CI |
| Dashboard 14" | OK | Smoke sin overflow horizontal |
| Campeonatos | OK | `/competitions`, dedupe, import calendario con preview/selección |
| Tarima | OK | Plantilla, cuadrante, asignación, clear, historial, export |
| Cuadrantes | Mejorado | Orden real de colores AEP1/AEP2 mixto; requiere muestras nuevas para casos extremos |
| Imports | OK | Preview antes de aplicar, selección granular, límites tamaño |
| Usuarios | OK | Gestión restringida a nacional/superadmin |
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
| Secrets | OK: GitHub Secrets, no valores en repo |
| Imports PDF | OK: MIME, tamaño, firma `%PDF-`, timeout extractor |
| Imports XLSX | Mitigado: auth nacional, tamaño 8 MB, firma ZIP, límites hojas/filas/columnas |
| Dependencias | OK salvo `xlsx` sin fix upstream, aceptado por `audit:security` con mitigación |

## Riesgos vivos

- `xlsx` mantiene advisories sin versión npm segura pública. Mantener uso solo server-side y nacional. Sustituir cuando exista alternativa viable.
- OCR depende de herramientas locales (`pdftotext`, `pdftoppm`, `swift`) y puede variar por host.
- Falta e2e happy-path completo: importar horario, importar cuadrante, aplicar, exportar.
- CSP estricta no activada para evitar romper Next inline scripts; pendiente hardening report-only antes de enforce.

## Gates obligatorios

```bash
npm run verify
npm run e2e
npm run audit:remote
```

GitHub CI ejecuta verify, browser smoke y Supabase readiness en cada push a `main`.

Últimos gates locales aplicados:

- `npm run verify`: 40 rutas API, 4 rutas import, seguridad, lint, 155 tests y build Next OK.
- `npm run e2e`: 3 tests Playwright OK en viewport 14".
- `npm run audit:remote`: Supabase readiness OK; 15 tablas; único usuario activo permitido `davidmunozrey@gmail.com`.
