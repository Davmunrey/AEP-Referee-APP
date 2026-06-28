# Production readiness

## Gate local

```bash
npm run verify
```

Incluye:

- `audit:prod`
- `audit:security`
- lint
- tests
- build

## Gate browser

```bash
npm run e2e
```

Valida redirección auth, login inválido y dashboard autenticado 14".

## Gate remoto

```bash
npm run audit:remote
```

Valida tablas críticas, allowlist usuarios activos y bloqueo anon.

## Seguridad cubierta

- Headers HTTP.
- API privada con sesión.
- Login server-side con rate-limit no manipulable.
- Mutaciones con RBAC y scope zonal.
- RLS deny-by-default.
- Imports con preview/selección y merge parcial (horarios).
- Validación roster server-side (slot keys, revalidación post-assign).
- PDF con firma y límite.
- XLSX con firma ZIP y límites estructurales.
- Dependencias auditadas con excepción documentada `xlsx`.

## No cubierto todavía

- E2E completo importar horario -> importar cuadrante -> export.
- E2E smoke compensación (`/competitions/:id/compensation`).
- CSP enforce.
- Sustitución `xlsx`.
- Restore real en staging.

## Criterio "listo producción"

- CI verde en GitHub.
- `audit:remote` verde contra Supabase producción.
- Backup reciente verificado.
- Usuario activo allowlist coincide con operación real.
- Manual QA de import PDF/XLSX con archivos reales críticos.
