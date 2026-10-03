# Production readiness

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

La plataforma está desplegada y operativa en Vercel + Supabase. Los usuarios finales acceden solo vía web; no se requiere entorno local.

## Gate CI (GitHub Actions)

```bash
npm run verify
```

Incluye:

- `audit:prod`
- `audit:security`
- lint
- typecheck (`tsc --noEmit`, tests incluidos)
- tests
- build

Además, en cada PR el job **Reproducir migraciones** aplica `001`→última sobre un Postgres 16 limpio (y sobre la forma que tiene producción).

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

- Headers HTTP (CSP, HSTS, frame deny).
- API privada con sesión.
- Login server-side con rate-limit.
- Mutaciones con RBAC y scope zonal.
- RLS deny-by-default; endurecimiento aplicado (migraciones `033` y `037`): sin políticas permisivas para `authenticated`. Toda tabla nueva debe nacer con RLS (lo comprueba un test).
- Alta de cuentas sin la bandera `invited` controlada por el usuario (migración `038`).
- Geocoding vía API propia (Photon/Nominatim en servidor).
- Imports con preview/selección.
- Validación roster server-side.
- PDF/XLSX con límites y firmas.
- IBAN compensación no persistido.
- Realtime: solo lectura de `app_sync_state` para clientes autenticados.

## Rendimiento

- Consultas Supabase optimizadas (sin escaneo global de asignaciones por campeonato); lecturas grandes paginadas con desempate estable.
- Caché TTL zonas/normativa (1 h).
- Índices en `roster_assignments` y `referees` (`030`) y en claves ajenas sin índice (`039`).
- Sincronización en vivo sin tormenta de APIs redundantes.
- JS compartido por página: 105 kB (Sentry se carga solo si hay DSN).

## Seguridad — único item pendiente

- **Leaked Password Protection** (HaveIBeenPwned) en Supabase Auth: toggle manual del panel (no es código). Es el único punto de seguridad abierto tras el endurecimiento RLS de la migración `033`.

## Backlog menor (no bloquea producción)

- E2E completo importar horario → cuadrante → export.
- E2E smoke compensación (`/compensation`).
- Sustitución librería `xlsx`.
- Restore real en staging.

## Criterio «listo producción» ✅

- CI verde en GitHub.
- Deploy Vercel automático desde `main`.
- `audit:remote` verde contra Supabase producción.
- Migraciones hasta `039` aplicadas (las nuevas, automáticamente al llegar a `main`).
- `NEXT_PUBLIC_APP_URL` y Site URL Supabase = `https://aep-tarima.vercel.app`.
- Plantillas correo Auth con branding AEP.
- Realtime activo (`app_sync_state`).
- Backup reciente verificado.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
