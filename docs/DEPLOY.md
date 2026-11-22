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

`NEXT_PUBLIC_APP_URL` en producción debe ser `https://aep-tarima.vercel.app` (sin barra final). Esa URL se usa en correos de Supabase Auth y redirecciones.

## Flujo de deploy (Vercel)

1. Push a la rama `main` en GitHub.
2. Vercel construye y publica **automáticamente** (integración continua del proyecto).
3. GitHub Actions ejecuta en paralelo (`.github/workflows/ci.yml`): `npm run verify`, **Reproducir migraciones** (toda la cadena `001`→última sobre un Postgres 16 limpio), smoke E2E y auditoría Supabase (estos dos últimos, solo si hay secrets).
4. Si el push toca `supabase/migrations/`, el workflow «Migraciones Supabase» aplica las pendientes en producción.

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
| `SUPABASE_ACCESS_TOKEN` | Opcional | Script `npm run supabase:email-branding` |

Variables solo CI (GitHub Secrets, no Vercel):

| Variable | Uso |
|---|---|
| `READINESS_ALLOWED_EMAILS` | Allowlist auditoría remota |
| `E2E_EMAIL` / `E2E_PASSWORD` | Playwright smoke |
| `SUPABASE_DB_URL` | Workflow «Migraciones Supabase» |

No se requiere ninguna API key de mapas de pago.

## Supabase

- Proyecto vinculado a producción: `foaemadggmpbcrhtpems` (eu-west-2).
- **Región de las funciones de Vercel: `lhr1` (Londres)**, fijada en `vercel.json`, la misma que Supabase (eu-west-2). Con la región por defecto (`iad1`, Washington) cada consulta cruzaba el Atlántico (~80 ms) y una pantalla hace varias seguidas (sesión, perfil, contadores, datos): segundos de espera por página.
- **Conexión con GitHub**: Vercel despliega `main` en cada push solo si el proyecto tiene el repositorio enlazado (Settings → Git). Si se desenlaza no falla nada visible: simplemente deja de desplegar. Comprobar que el último despliegue de producción es el último commit de `main`.
- **Claves de firma JWT asimétricas** (Supabase → Project Settings → JWT Keys): con ellas el middleware y `getSession` verifican el token en local con `getClaims()`. Con el secreto compartido de siempre (HS256) `getClaims()` pregunta a Supabase Auth en cada petición, y cada pantalla paga uno o dos viajes más antes de su primera consulta. Migrar no invalida las sesiones abiertas ni cambia las claves `anon` y `service_role`.
- **Auth**: email/contraseña; signup público desactivado. La aplicación **no envía correos** (sin SMTP propio): los jueces entran con un código que les da su delegado y las contraseñas olvidadas las repone un administrador o el delegado.
- **Redirect URLs** en Supabase Auth: incluir `https://aep-tarima.vercel.app/**` y el dominio Vercel si se usa en preview.
- **Site URL** en Auth: `https://aep-tarima.vercel.app`
- **Plantillas de correo**: branding AEP en `src/lib/auth/supabase-email-branding.ts`. Aplicar en remoto:
  ```bash
  SUPABASE_ACCESS_TOKEN=sbp_... npm run supabase:email-branding
  ```
- **Migraciones**: se aplican **solas**. El workflow «Migraciones Supabase» ejecuta lo pendiente de `supabase/migrations/` en cada push a `main` que las toque. Requiere el secret `SUPABASE_DB_URL` (cadena del *Session pooler*, puerto 5432, percent-encoded; la conexión directa `db.<ref>.supabase.co` no vale porque es solo IPv6 y los runners solo tienen IPv4).
  - Las 001–033 se aplicaron a mano en su día; el workflow las registra como tales sin reejecutarlas. Estado actual: aplicadas hasta la `045`.
  - Tras aplicar una migración, el workflow avisa a PostgREST para que recargue el esquema: la función nueva queda disponible sin reiniciar el proyecto.
  - Antes de tocar nada aborta si una migración pendiente trae `DROP`, `TRUNCATE`, un `DELETE`/`UPDATE` sin `WHERE` o un `ALTER TYPE … ADD VALUE` mezclado con otras sentencias. Esas hay que aplicarlas a mano y con copia previa. Un `ADD VALUE` **solo** en su fichero sí se aplica (como la `040`): sin nada más en la transacción, el valor nuevo no se usa antes del `COMMIT`.
  - Para ver qué haría sin escribir: Actions → «Migraciones Supabase» → Run workflow → marcar *Solo mostrar qué se aplicaría*.
  - El registro vive en `deploy.applied_migrations`, aparte de `supabase_migrations.schema_migrations` (que escriben el CLI y el MCP de Supabase y aquí solo se lee para detectar conflictos).
- **Realtime**: tabla `app_sync_state` publicada (migración `029`) para sincronización en vivo entre usuarios.
- **Hardening RLS (033, 037)**: sin políticas permisivas para `authenticated` en ninguna tabla; todo queda solo servidor (acceso vía `service_role`).
- **Leaked Password Protection**: activar el toggle de Auth (HaveIBeenPwned) — ver «Hardening post-deploy».

## Dominio en Vercel

El dominio de producción es el asignado por Vercel: `aep-tarima.vercel.app`.

Si en el futuro se añade un dominio personalizado en Vercel → Project → Settings → Domains, actualizar también **Site URL** y **Redirect URLs** en Supabase Auth y `NEXT_PUBLIC_APP_URL` en Vercel.

## Checklist release

- [ ] `npm run verify` en verde (CI)
- [ ] Push a `main` y deploy Vercel completado sin error
- [ ] https://aep-tarima.vercel.app/sign-in carga correctamente
- [ ] Login con cuenta de prueba / admin
- [ ] `/docs` accesible
- [ ] Secret `SUPABASE_DB_URL` creado (lo necesita el workflow de migraciones)
- [ ] Workflow «Migraciones Supabase» en verde tras el push
- [ ] Backup reciente (workflow «Backup» en verde, o `npm run db:backup` en local)
- [ ] Plantillas de correo Auth con branding AEP (si hubo cambios)
- [ ] Usuario admin / comité esperado activo

## Hardening post-deploy (Supabase Auth)

Un único paso manual pendiente de seguridad, sin código:

- **Leaked Password Protection**: en Supabase → Authentication → Policies (Password), activar el toggle que rechaza contraseñas expuestas en filtraciones conocidas (HaveIBeenPwned). Es un ajuste del panel, no forma parte del repo ni de las migraciones. El resto del endurecimiento RLS ya viene aplicado por la migración `033`.

## Servicios de cartografía

El autocompletado de direcciones usa **Photon** (`photon.komoot.io`), la geolocalización **Nominatim** (`nominatim.openstreetmap.org`) y las distancias **OSRM** (`router.project-osrm.org`). Son servidores públicos y gratuitos, sin garantía de servicio: Nominatim limita a 1 petición por segundo y exige identificarse (`OSM_USER_AGENT`), y el servidor de OSRM es de demostración. Si fallan, la compensación sigue funcionando con km introducidos a mano. Para no depender de ellos, apunta `NOMINATIM_URL` y `OSRM_URL` a una instancia propia o de pago. Solo reciben el texto de la dirección y coordenadas, nunca el nombre del juez (ver aviso de privacidad en `/docs`).

## Copias de seguridad y restauración

El workflow **Backup** (cada noche a las 03:17 UTC, y a mano con *Run workflow*) genera dos copias, las cifra con AES-256 y las sube como artefacto (90 días):

| Fichero | Qué contiene | Para qué |
|---|---|---|
| `aep-pgdump-*.dump.gpg` | Volcado `pg_dump` de los esquemas `public` y `auth`: estructura, datos y cuentas con el resumen de sus contraseñas | **Restauración completa** |
| `aep-backup-*.json.gpg` | Todas las tablas de `public` leídas por la API, más las cuentas sin contraseña | Consulta rápida y recuperar filas sueltas |

Necesita los secrets `BACKUP_PASSPHRASE`, `SUPABASE_DB_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Si falta la frase de cifrado o la cadena de conexión, el job **falla**: antes terminaba en verde sin guardar nada.

La lista de tablas se deriva de las migraciones (`scripts/lib/backup-tables.mjs`), y el test `tests/backup-tables.test.ts` falla si una tabla nueva se queda fuera. Los ficheros adjuntos de los tickets (bucket de Storage) **no** entran en la copia.

### Restaurar

1. Descarga el artefacto de la ejecución elegida (Actions → Backup → *Artifacts*).
2. Descifra: `gpg --decrypt aep-pgdump-….dump.gpg > copia.dump` (pide la frase).
3. Restaura **primero sobre un proyecto de Supabase vacío**, nunca directamente sobre producción:
   ```sh
   pg_restore --dbname "$URL_DEL_PROYECTO_NUEVO" --no-owner --no-privileges \
     --clean --if-exists --schema=public --schema=auth copia.dump
   ```
4. Comprueba con `npm run audit:remote` apuntando al proyecto restaurado y entra con una cuenta conocida.
5. Si todo cuadra, cambia `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` en Vercel al proyecto restaurado y redespliega.

Ensaya este procedimiento al menos una vez por temporada: una copia que nunca se ha restaurado no está probada.

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

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
