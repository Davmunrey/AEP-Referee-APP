# Deploy

Destino: Vercel + Supabase.

## Variables

| Variable | Entorno | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role (solo servidor) |
| `READINESS_ALLOWED_EMAILS` | CI | Allowlist auditoría |
| `E2E_EMAIL` / `E2E_PASSWORD` | CI | Playwright smoke |
| `OSM_USER_AGENT` | Production (recomendado) | Identificación para Nominatim |
| `NOMINATIM_URL` | Opcional | Geocoding OSM (default: nominatim.openstreetmap.org) |
| `OSRM_URL` | Opcional | Rutas OSM (default: router.project-osrm.org) |
| `GEMINI_API_KEY` | Opcional | Asistente IA (sin clave → motor local) |

No se requiere ninguna API key de mapas de pago (Google Maps eliminado).

## Build

```bash
npm ci
npm run verify
```

## Supabase Auth

- Email/password activo.
- Signup público desactivado.
- Reset password activo.
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
- [ ] Migraciones aplicadas (hasta `026`)
- [ ] `npm run docs:screenshots` si cambió la UI documentada
- [ ] Manual PDF probado: `GET /api/v1/guides/tarima-manual`
- [ ] Usuario admin único esperado activo
