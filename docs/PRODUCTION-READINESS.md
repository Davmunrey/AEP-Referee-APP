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
- Backup/restore operativo pendiente: script probado contra dump real antes de producción.

## Criterio para decir “100%”

- `npm run verify` OK.
- 3 campeonatos reales importados y corregidos completos.
- 3 cuadrantes reales distintos aplicados con revisión manual.
- Usuario delegado_zona validado contra permisos de zona.
- Export roster y analytics validado por usuario final.
- Restore probado desde backup reciente.
