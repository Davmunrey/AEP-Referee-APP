# Deploy y entrega AEP

AEP Tarima es una **aplicación web en producción** en **Vercel** con base de datos y autenticación en **Supabase**. No hay app móvil ni manual PDF: la documentación para usuarios está en la propia web.

**La plataforma está pensada para usarse directamente en Vercel** — los delegados y el comité no necesitan entorno local.

## URLs de producción

| Uso | URL |
|---|---|
| **Entrega a la AEP (principal)** | https://aep-tarima.vercel.app |
| Acceso | https://aep-tarima.vercel.app/sign-in |
| Documentación | https://aep-tarima.vercel.app/docs |
| Panel (requiere sesión) | https://aep-tarima.vercel.app/ |

`NEXT_PUBLIC_APP_URL` en producción debe ser `https://aep-tarima.vercel.app` (sin barra final). Esa URL se usa en correos de Supabase Auth, enlaces del asistente y redirecciones.

## Flujo de deploy (Vercel)

1. Push a la rama `main` en GitHub.
2. Vercel construye y publica **automáticamente** (integración continua del proyecto).
3. GitHub Actions ejecuta en paralelo: `npm run verify`, smoke E2E y auditoría Supabase (`.github/workflows/ci.yml`).

No hay paso manual de “subir build”: cada merge a `main` despliega en producción.

## Texto de entrega a la AEP

Copiar y adaptar:

> **AEP Tarima** — plataforma de gestión de jueces  
> https://aep-tarima.vercel.app  
>
> Acceso con el correo y contraseña que facilita el Comité de Jueces (no hay registro público).  
> Documentación y privacidad: https://aep-tarima.vercel.app/docs  
>
> Contacto operativo: powerhispania@gmail.com

## Variables de entorno (Vercel)

| Variable | Entorno | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role (solo servidor) |
| `NEXT_PUBLIC_APP_URL` | Production | `https://aep-tarima.vercel.app` |
| `OSM_USER_AGENT` | Production (recomendado) | Identificación para Nominatim/OSRM |
| `NOMINATIM_URL` | Opcional | Geocoding OSM |
| `OSRM_URL` | Opcional | Rutas OSM |
| `GEMINI_API_KEY` | Opcional | Asistente IA (sin clave → motor local) |
| `SUPABASE_ACCESS_TOKEN` | Opcional | Script `npm run supabase:email-branding` |

Variables solo CI (GitHub Secrets, no Vercel):

| Variable | Uso |
|---|---|
| `READINESS_ALLOWED_EMAILS` | Allowlist auditoría remota |
| `E2E_EMAIL` / `E2E_PASSWORD` | Playwright smoke |

No se requiere ninguna API key de mapas de pago.

## Supabase

- Proyecto vinculado a producción: `foaemadggmpbcrhtpems` (eu-west-2).
- **Auth**: email/contraseña; signup público desactivado; reset de contraseña activo.
- **Redirect URLs** en Supabase Auth: incluir `https://aep-tarima.vercel.app/**` y el dominio Vercel si se usa en preview.
- **Site URL** en Auth: `https://aep-tarima.vercel.app`
- **Plantillas de correo**: branding AEP en `src/lib/auth/supabase-email-branding.ts`. Aplicar en remoto:
  ```bash
  SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:email-branding
  ```
- **Migraciones**: aplicar en orden hasta la última en `supabase/migrations/` (incl. `030_roster_assignments_indexes`).
- **Realtime**: tabla `app_sync_state` publicada (migración `029`) para sincronización en vivo entre usuarios.

## Dominio en Vercel

El dominio de producción es el asignado por Vercel: `aep-tarima.vercel.app`.

Si en el futuro se añade un dominio personalizado en Vercel → Project → Settings → Domains, actualizar también **Site URL** y **Redirect URLs** en Supabase Auth y `NEXT_PUBLIC_APP_URL` en Vercel.

## Checklist release

- [ ] `npm run verify` en verde (CI)
- [ ] Push a `main` y deploy Vercel completado sin error
- [ ] https://aep-tarima.vercel.app/sign-in carga correctamente
- [ ] Login con cuenta de prueba / admin
- [ ] `/docs` accesible
- [ ] Migraciones Supabase aplicadas (hasta `030`)
- [ ] Backup reciente (`npm run db:backup`)
- [ ] Plantillas de correo Auth con branding AEP (si hubo cambios)
- [ ] Usuario admin / comité esperado activo

## Rollback

1. En Vercel → Deployments → seleccionar el deployment anterior estable → **Promote to Production**.
2. Si el fallo incluye migración de base de datos, valorar restore desde backup antes de reintentar.

## Qué no forma parte del deploy

| Eliminado / no aplica | Motivo |
|---|---|
| App iOS | Descontinuada |
| Manual PDF (`/api/v1/guides/tarima-manual`) | Eliminado; documentación solo web en `/docs` |
| Import clubes desde PDF | Listado curado en `src/lib/aep-clubs-curated.ts` |

Los **recibos PDF de compensación** por campeonato siguen activos (flujo financiero distinto al manual de usuario).

## Referencias

- [API](./API.md) — endpoints `/api/v1`
- [Auth](./AUTH.md) — roles y permisos
- [Base de datos](./DATABASE.md) — tablas y migraciones
- [Guía de uso](./GUIA-USO.md) — flujos con capturas
