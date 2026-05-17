# AEP Tarima — Plataforma de Gestión de jueces

Herramienta interna de la **Asociación Española de Powerlifting (AEP)** para la gestión integral de plantillas de jueces en campeonatos nacionales y regionales.

**Producción:** [https://aep-tarima.vercel.app/](https://aep-tarima.vercel.app/) · **Marca:** AEP Tarima · color primario `#e63b2e` · diseño en [`docs/DESIGN.md`](./docs/DESIGN.md).

---

## Qué hace la plataforma

### Dashboard operativo inteligente
Centro de control que se **retroalimenta de sus propios datos**:

- **KPIs de temporada** — jueces activos, próximas competiciones, plazas sin cubrir, aprobaciones pendientes.
- **Salud operativa** (`HealthGauge`) — índice ponderado 0–100 sobre 5 factores, con anillo visual y comparación frente a la captura anterior.
- **Recomendaciones automáticas** (`InsightsPanel`) — sugerencias priorizadas (crítico / alerta / sugerencia) con enlace a la acción.
- **Previsión de cobertura** (`CoverageForecast`) — progreso por plantilla, días restantes y nivel de riesgo.
- **Panel en vivo** (`DashboardLive`) — auto-refresco del árbol de servidor cada 60 s.
- Calendario operativo, feed de actividad y tabla de próximos eventos.

### Campeonatos y tarima
- **Listado** con filtros por tipo (AEP-1/2/3), estado y búsqueda.
- **Creación** con validación de fechas, zona y plazas.
- **Plantilla por evento** — cada campeonato guarda su propia estructura de sesiones (`competitions.template`). Si está vacía, la app aplica el preset oficial según el tipo (AEP-1, AEP-2 o AEP-3).
- **Editor de plantilla** (`RosterTemplateEditor`) — sesiones, días, categorías, horarios y roles editables antes de asignar jueces.
- **Constructor de tarima** (`RosterBuilder`) — asignación por arrastre o clic, validación normativa, flags de slot (`*` compartido, `↑↓` intercambio), historial y envío a aprobación.

### Directorio de jueces / Ficha de juez
Búsqueda, filtros, paginación, trayectoria (exámenes, informes), alta, edición y ascensos.

### Exámenes, informes, aprobaciones, ascensos, estadísticas, normativa IPF/AEP
Igual que en versiones anteriores; ver [`docs/GUIA-USO.md`](./docs/GUIA-USO.md) para flujos paso a paso.

### Usuarios (`super_admin` / `delegado_jueces`)
Alta de delegados, activación y baja en `/admin/users`.

---

## Roles y permisos

| Rol (`profiles.role`) | Etiqueta en UI | Alcance |
|----------------------|----------------|---------|
| `super_admin` | Super Admin · **AEP Nacional** | Control total: cualquier zona, aprueba tarimas, gestiona usuarios y ascensos |
| `delegado_jueces` | Delegado de Jueces · **AEP · Comité de Jueces** | Misma autoridad operativa que `super_admin` en tarima, aprobaciones y usuarios |
| `delegado_zona` | Delegado de Zona · **AEP Regional · {zona}** | Campeonatos, plantilla, asignaciones y jueces de su zona |
| `solo_ver` | Solo lectura · **AEP Consulta** | Consulta sin crear ni editar |

El **primer usuario** registrado obtiene `super_admin`; el resto entra como `solo_ver` hasta que un administrador lo promocione.

Detalle de sesión y RBAC: [`docs/AUTH.md`](./docs/AUTH.md).

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Base de datos | Supabase Postgres + RLS |
| Auth | Supabase Auth — email/contraseña, cookies `@supabase/ssr` |
| API | Route handlers `/api/v1/*` |
| Despliegue | Vercel |

---

## Puesta en marcha

### Requisitos
- Node.js 20+
- Proyecto Supabase

### Variables de entorno
Copia `.env.example` → `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo servidor, nunca exponer
```

### Instalación y migraciones

```bash
npm install

# SQL Editor (o supabase db push), en orden:
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/003_supabase_auth.sql
#   supabase/migrations/004_health_snapshots.sql
#   supabase/migrations/005_judge_management.sql
#   supabase/migrations/006_roles_rebrand.sql
#   supabase/migrations/007_rls_hardening.sql
#   supabase/migrations/008_per_event_roster_template.sql

npm run db:seed
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), regístrate con email/contraseña. Guía completa de uso: [`docs/GUIA-USO.md`](./docs/GUIA-USO.md).

### Backfill de plantillas (opcional)
Para copiar presets AEP-1/2/3 en `competitions.template` donde sea `NULL`:

```bash
npm run db:backfill-templates
```

Requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`. Ver [`docs/DATABASE.md`](./docs/DATABASE.md).

### Despliegue en Vercel
Dominio: **https://aep-tarima.vercel.app/** — detalle en [`docs/DEPLOY.md`](./docs/DEPLOY.md).

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run db:seed` | Pobla zonas, jueces, campeonatos y normativa |
| `npm run db:backfill-templates` | Rellena `competitions.template` desde presets por tipo |
| `npm test` | Vitest (reglas de tarima, plantillas, RBAC) |
| `npm run lint` | ESLint |

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/GUIA-USO.md`](./docs/GUIA-USO.md) | **Guía de uso** con branding AEP Tarima y flujos operativos |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Vercel, variables, checklist |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Esquema, RLS, migraciones 001–008 |
| [`docs/AUTH.md`](./docs/AUTH.md) | Auth, roles, sesión |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Capas, RBAC, plantillas por evento |
| [`docs/API.md`](./docs/API.md) | REST `/api/v1/*` |
| [`docs/ROUTES.md`](./docs/ROUTES.md) | Rutas de la app |
| [`docs/COMPONENTS.md`](./docs/COMPONENTS.md) | Componentes UI |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Tokens y paleta |
| [`docs/AUDIT.md`](./docs/AUDIT.md) | Auditoría QA (matriz roles × capacidades, gaps cerrados) |

---

## Normativa IPF de referencia
- [IPF Technical Rules (EN)](https://www.powerlifting.sport/rules/codes/info/technical-rules)
- [Jueces IPF](https://www.powerlifting.sport/federation/referees)
- [Reglamento AEP](https://powerlifting.es)
