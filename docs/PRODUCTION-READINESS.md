# Production readiness

Estado objetivo: beta operativa segura, no solo MVP visual.

## Gate local obligatorio

Antes de subir cambios:

```bash
npm run verify
```

El gate ejecuta:

- `npm run audit:prod`: comprobaciones estáticas de auth API, RBAC, imports con preview, docs críticas y migraciones RLS.
- `npm run lint`: lint Next.
- `npm run test`: suite Vitest.
- `npm run build`: build producción.

## Gate browser

```bash
npm run e2e
```

Cobertura:

- Usuario no autenticado redirige a `/sign-in`.
- Login inválido muestra error claro.
- Si existen `E2E_EMAIL` y `E2E_PASSWORD`, ejecuta smoke autenticado y verifica dashboard sin overflow horizontal en viewport Mac 14”.

Instalación navegador:

```bash
npm run e2e:install
```

## Gate Supabase remoto

```bash
npm run audit:remote
```

Requiere `.env.local` con Supabase URL, anon key y service role. Valida:

- Tablas críticas accesibles por service role.
- Usuarios activos dentro de allowlist `READINESS_ALLOWED_EMAILS` (por defecto `davidmunozrey@gmail.com`).
- Cliente anon sin sesión no puede leer filas de tablas sensibles.

## Backup

```bash
npm run db:backup
npm run db:backup:verify
npm run db:restore:dry-run
```

Genera JSON en `backups/` (ignorado por git) con tablas críticas. `restore:dry-run` valida que el backup sea restaurable contra esquema remoto sin escribir datos.

## Checks cubiertos

- Todas las rutas `src/app/api/v1/**/route.ts` salvo login deben exigir sesión con `requireApiUser`.
- Toda ruta con `POST`, `PUT`, `PATCH` o `DELETE` debe tener guard RBAC explícito.
- Imports críticos deben separar `preview` y `apply`.
- Imports de calendario, plantilla y cuadrante deben permitir selección granular.
- UI no debe mostrar marcas de fuente como `(Excel: ...)`.
- Deben existir docs base: arquitectura, auth, DB, deploy, guía uso y backlog.
- Deben existir migraciones RLS y rename legacy `event_id -> competition_id`.

## Riesgos aún no cerrados

- E2E browser real pendiente: login, importar calendario, importar cuadrante, asignar, exportar.
- Parser PDF escaneado/OCR pendiente: PDFs imagen requieren motor OCR externo o preprocesado.
- Auditoría Supabase remota pendiente: validar políticas aplicadas en proyecto, no solo migraciones locales.
- Restore destructivo pendiente: dry-run ya existe; aplicar restore real solo en staging vacía.
- `xlsx` mantiene advisories sin fix upstream; mitigación actual: uso server-side, imports autorizados, extensión `.xlsx`, firma ZIP, límite 8 MB, límite hojas/filas/columnas. Sustituir librería si se abre import a usuarios no confiables.
- Advisory `next/postcss`: `npm audit fix --force` propone downgrade roto; esperar parche compatible Next 15 o mitigación upstream.

## Criterio para decir “100%”

- `npm run verify` OK.
- 3 campeonatos reales importados y corregidos completos.
- 3 cuadrantes reales distintos aplicados con revisión manual.
- Usuario delegado_zona validado contra permisos de zona.
- Export roster y analytics validado por usuario final.
- Restore probado desde backup reciente.
- `npm run e2e` OK con credenciales reales.
- `npm run audit:remote` OK contra Supabase producción.
