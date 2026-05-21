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
- Mutaciones con RBAC.
- RLS deny-by-default.
- Imports con preview/selección.
- PDF con firma y límite.
- XLSX con firma ZIP y límites estructurales.
- Dependencias auditadas con excepción documentada `xlsx`.

## No cubierto todavía

- E2E completo importar horario -> importar cuadrante -> export.
- CSP enforce.
- Sustitución `xlsx`.
- Restore real en staging.

## Criterio "listo producción"

- CI verde en GitHub.
- `audit:remote` verde contra Supabase producción.
- Backup reciente verificado.
- Usuario activo allowlist coincide con operación real.
- Manual QA de import PDF/XLSX con archivos reales críticos.
