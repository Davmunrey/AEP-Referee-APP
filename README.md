# AEP Tarima — Plataforma de Gestión Arbitral

Herramienta interna de la **Asociación Española de Powerlifting (AEP)** para la gestión integral de plantillas arbitrales en campeonatos nacionales y regionales.

---

## Qué hace la plataforma

### Dashboard operativo inteligente
Centro de control que se **retroalimenta de sus propios datos**:

- **KPIs de temporada** — árbitros activos, próximas competiciones, plazas sin cubrir, aprobaciones pendientes.
- **Salud operativa** (`HealthGauge`) — índice ponderado 0–100 calculado sobre 5 factores (cobertura de plantillas, estabilidad de eventos, urgencia, cola de aprobaciones, disponibilidad arbitral), con anillo visual y comparación frente a la captura anterior.
- **Recomendaciones automáticas** (`InsightsPanel`) — el sistema analiza el estado y genera sugerencias priorizadas por severidad (crítico / alerta / sugerencia), cada una con enlace directo a la acción.
- **Previsión de cobertura** (`CoverageForecast`) — barra de progreso de cada plantilla con los días que faltan y su nivel de riesgo.
- **Panel en vivo** (`DashboardLive`) — auto-refresco del árbol de servidor cada 60 s, con pausa y refresco manual.
- Calendario operativo mes a mes, feed de actividad y tabla de próximos eventos.

### Campeonatos
Gestión completa del ciclo de vida de un campeonato:
- **Listado** con filtros por tipo (AEP-1/2/3), estado (Completo/Incompleto/Crítico/Borrador) y búsqueda libre
- **Creación** con validación de fechas, zona, sesiones y plazas requeridas
- **Tarima interactiva** (Constructor): asignación árbitro → slot por arrastrar/soltar o selección directa, indicadores de cobertura, detección automática de violaciones de normativa, historial de cambios y envío a aprobación nacional

### Directorio de árbitros / Ficha de juez
- Búsqueda y filtro por nombre, zona, nivel y estado, con paginación (25 por página)
- **Ficha individual de juez** con trayectoria (exámenes, aprobados, nota media, informes), datos completos y formulario de edición
- Solicitud de ascenso, alta de nuevo árbitro y baja (rol nacional) con confirmación

### Exámenes arbitrales
Seguimiento de la formación y certificación de jueces:
- Registro de exámenes **Teórico**, **Práctico**, **Reglamento IPF** y **Recertificación**
- Nivel objetivo, examinador, fecha, puntuación (0–100) y resultado (Aprobado / Suspenso / Pendiente)
- Calificación con un clic sobre exámenes pendientes
- Página `/exams` con tablero global y estadística de tasa de aprobación

### Sandbox de informes
Repositorio de informes de desempeño por juez:
- Subida de informes de **Desempeño**, **Incidencia**, **Evaluación** y **Auto-informe**
- Contenido en texto, evento asociado opcional y enlace a documento adjunto
- Disponible tanto en la ficha del juez (acoplado) como en la página global `/reports`

### Aprobaciones
Cola de propuestas de rosters enviadas por los representantes regionales. El equipo nacional visualiza el diff de asignaciones, añade comentario obligatorio al rechazar y resuelve con un clic.

### Ascensos de nivel
Solicitudes Regional → Nacional → IPF Cat. 2 → IPF Cat. 1 con motivo, validación de nivel destino superior y revisión centralizada.

### Estadísticas
Cobertura de árbitros por zona, árbitros más activos, eventos críticos, totales y exportación CSV de la temporada completa.

### Normativa IPF / AEP
Dos vistas en `/regulations`:
- **Matriz AEP** — requisitos mínimos de nivel por rol y tipo de campeonato.
- **Reglamento IPF completo** — el IPF Technical Rulebook en 11 capítulos: General y categorías, Sentadilla, Press de banca, Peso muerto (con causas de descalificación), Pesaje, Equipo personal, Árbitros, Jurado, Comité Técnico, Records y Antidopaje. Con **búsqueda full-text** en todo el reglamento.

### Usuarios (solo Nacional)
Alta de representantes regionales y cuentas de solo lectura; activación/desactivación y baja.

---

## Roles y permisos

| Rol | Qué puede hacer |
|-----|-----------------|
| `nacional` | Todo: aprueba rosters, gestiona ascensos, crea/elimina campeonatos de cualquier zona, gestiona usuarios, califica y elimina exámenes e informes |
| `regional` | Crea y edita campeonatos de su zona, propone tarimas, solicita ascensos, registra exámenes e informes, consulta directorio |
| `lectura` | Consulta únicamente: no puede crear ni editar nada |

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Base de datos | Supabase Postgres + Row Level Security |
| Auth | Supabase Auth — email/contraseña, sesión por cookies (`@supabase/ssr`) |
| API | Route handlers `/api/v1/*` en el mismo repositorio |
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

### Instalación y seed

```bash
npm install

# Ejecutar migraciones SQL en Supabase (SQL Editor), en orden:
#   supabase/migrations/001_initial_schema.sql
#   supabase/migrations/003_supabase_auth.sql      (Auth nativo, sin warnings)
#   supabase/migrations/004_health_snapshots.sql   (bitácora de salud del panel)
#   supabase/migrations/005_judge_management.sql   (exámenes e informes de jueces)

# Poblar datos de referencia (zonas, normativa, árbitros, campeonatos)
npm run db:seed

# Desarrollar
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) y crea una cuenta con
email/contraseña. **El primer usuario registrado obtiene rol `nacional`
(administrador);** el resto entra como `lectura`. Detalle en [`docs/AUTH.md`](./docs/AUTH.md).

### Despliegue en Vercel
Ver [`docs/DEPLOY.md`](./docs/DEPLOY.md) para la guía completa de variables de entorno y checklist pre-producción.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run db:seed` | Pobla Supabase con zonas, árbitros, campeonatos y normativa |
| `npm run lint` | ESLint |

---

## Documentación interna

| Documento | Contenido |
|-----------|-----------|
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Vercel, variables de entorno, checklist producción |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Esquema Postgres, RLS, migraciones, tablas |
| [`docs/AUTH.md`](./docs/AUTH.md) | Supabase Auth, roles, gestión de sesiones |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Capas, RBAC, capa de inteligencia, flujo de datos |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Tokens de diseño, paleta, componentes |
| [`docs/API.md`](./docs/API.md) | Endpoints REST `/api/v1/*` |
| [`docs/ROUTES.md`](./docs/ROUTES.md) | Rutas de la aplicación |
| [`docs/COMPONENTS.md`](./docs/COMPONENTS.md) | Inventario de componentes UI |

---

## Normativa IPF de referencia
- [IPF Technical Rules (EN)](https://www.powerlifting.sport/rules/codes/info/technical-rules)
- [Árbitros IPF](https://www.powerlifting.sport/federation/referees)
- [Reglamento AEP 2026](https://powerlifting.es) *(enlace oficial AEP)*
