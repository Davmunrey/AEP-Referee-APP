# Deploy y entrega AEP

AEP Tarima es una **aplicación web** desplegada en **Vercel** con base de datos y autenticación en **Supabase**. No hay app móvil ni exportación de manual PDF: la documentación para usuarios está en la propia web.

## URLs de producción

| Uso | URL |
|---|---|
| **Entrega a la AEP (principal)** | https://tarima.powerliftingspain.es |
| Acceso | https://tarima.powerliftingspain.es/sign-in |
| Documentación | https://tarima.powerliftingspain.es/docs |
| Panel (requiere sesión) | https://tarima.powerliftingspain.es/ |

Dominio alternativo Vercel (mismo deploy): `https://aep-tarima.vercel.app`

`NEXT_PUBLIC_APP_URL` en producción debe ser `https://tarima.powerliftingspain.es` (sin barra final). Esa URL se usa en correos de Supabase Auth, enlaces del asistente y redirecciones.

## Flujo de deploy (Vercel)

1. Push a la rama `main` en GitHub.
2. Vercel construye y publica **en tiempo real** (integración continua del proyecto).
3. GitHub Actions ejecuta en paralelo: `npm run verify`, smoke E2E y auditoría Supabase (`.github/workflows/ci.yml`).

No hay paso manual de “subir build”: cada merge a `main` despliega automáticamente.

### Verificación local antes de merge

```bash
npm ci
npm run verify    # audit + lint + test + build
```

Opcional antes de release importante:

```bash
npm run e2e
npm run audit:remote
```

## Texto de entrega a la AEP

Copiar y adaptar:

> **AEP Tarima** — plataforma de gestión de jueces  
> https://tarima.powerliftingspain.es  
>
> Acceso con el correo y contraseña que facilita el Comité de Jueces (no hay registro público).  
> Documentación y privacidad: https://tarima.powerliftingspain.es/docs  
>
> Contacto operativo: powerhispania@gmail.com

## Variables de entorno (Vercel)

| Variable | Entorno | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Clave anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Service role (solo servidor) |
| `NEXT_PUBLIC_APP_URL` | Production | `https://tarima.powerliftingspain.es` |
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

- Proyecto vinculado a producción.
- **Auth**: email/contraseña; signup público desactivado; reset de contraseña activo.
- **Redirect URLs** en Supabase Auth: incluir `https://tarima.powerliftingspain.es/**` y el dominio Vercel si se usa en preview.
- **Site URL** en Auth: `https://tarima.powerliftingspain.es`
- **Plantillas de correo**: branding AEP en `src/lib/auth/supabase-email-branding.ts`. Aplicar en remoto:
  ```bash
  SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:email-branding
  ```
  (o workflow `.github/workflows/supabase-email-branding.yml` con el token en GitHub Secrets).
- **Migraciones**: aplicar en orden hasta la última en `supabase/migrations/` (incl. `028_drop_device_tokens`).

## Dominio custom

En Vercel → Project → Settings → Domains:

- `tarima.powerliftingspain.es` → producción
- DNS en el registrador: registro CNAME o A según indique Vercel

Tras añadir dominio, actualizar Site URL y redirect URLs en Supabase Auth.

## Checklist release

- [ ] `npm run verify` en verde
- [ ] Push a `main` y deploy Vercel completado sin error
- [ ] https://tarima.powerliftingspain.es/sign-in carga correctamente
- [ ] Login con cuenta de prueba / admin
- [ ] `/docs` accesible (pública en parte legal; guía operativa con sesión)
- [ ] Migraciones Supabase aplicadas
- [ ] Backup reciente (`npm run db:backup`)
- [ ] Plantillas de correo Auth con branding AEP (si hubo cambios)
- [ ] `npm run docs:screenshots` solo si cambió la UI documentada en `docs/GUIA-USO.md`
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
- [Guía de uso](./GUIA-USO.md) — flujos con capturas (markdown en repo)
