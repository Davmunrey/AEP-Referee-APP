# Deploy

Destino: Vercel + Supabase.

## Variables

| Variable | Entorno |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production |
| `READINESS_ALLOWED_EMAILS` | CI |
| `E2E_EMAIL` | CI |
| `GOOGLE_MAPS_API_KEY` | Production (opcional) | Distance Matrix para compensación km |

## Build

```bash
npm ci
npm run verify
```

## Supabase Auth

- Email/password activo.
- Signup público desactivado.
- Reset password activo.
- Leaked password protection si plan lo permite.
- Solo dominios redirect necesarios.

## GitHub

CI en `.github/workflows/ci.yml`:

- `Verify app`
- `Browser smoke`
- `Supabase readiness`

## Checklist release

- [ ] `npm run verify`
- [ ] `npm run e2e`
- [ ] `npm run audit:remote`
- [ ] Backup reciente
- [ ] Migraciones aplicadas (hasta `025`)
- [ ] Usuario admin único esperado activo
- [ ] Import calendario/horario/cuadrante probado en preview
