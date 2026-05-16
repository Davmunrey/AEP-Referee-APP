# AEP Tarima — Plataforma de Gestión Arbitral

Herramienta interna de la **Asociación Española de Powerlifting (AEP)** para la gestión integral de plantillas arbitrales en campeonatos nacionales y regionales.

---

## Qué hace la plataforma

### Dashboard operativo
Vista de control en tiempo real: KPIs de la temporada (árbitros activos, aprobaciones pendientes, plazas sin cubrir, tasa de rechazo), calendario interactivo mes a mes con todos los campeonatos marcados por estado, feed de actividad reciente y tabla de próximos eventos con su cobertura actual.

### Campeonatos
Gestión completa del ciclo de vida de un campeonato:
- **Listado** con filtros por tipo (AEP-1/2/3), estado (Completo/Incompleto/Crítico/Borrador) y búsqueda libre
- **Creación** con validación de fechas, zona, sesiones y plazas requeridas
- **Tarima interactiva** (Constructor): asignación árbitro → slot por arrastrar/soltar o selección directa, con indicadores de cobertura, detección automática de violaciones de normativa y envío a aprobación nacional

### Directorio de árbitros
- Búsqueda y filtro por nombre, zona, nivel y estado
- Paginación automática (25 por página)
- Ficha individual con datos completos y formulario de edición
- Solicitud de ascenso directamente desde la ficha
- Alta de nuevo árbitro con datos mínimos
- Baja (rol nacional) con confirmación

### Aprobaciones
Cola de propuestas de rosters enviadas por los representantes regionales. El equipo nacional:
- Visualiza el diff de asignaciones propuestas (slot → árbitro con nombre)
- Añade un comentario obligatorio al rechazar
- Aprueba o rechaza con un clic; el estado se refleja en tiempo real

### Ascensos de nivel
Solicitudes de cambio Regional → Nacional → IPF Cat. 2 → IPF Cat. 1:
- Presentación de solicitudes con motivo y eventos completados
- Validación de que el nivel destino es superior al actual
- Revisión centralizada por el equipo nacional

### Estadísticas
Métricas de temporada:
- Cobertura de árbitros por zona (barras de progreso)
- Árbitros más activos por eventos completados
- Eventos en estado crítico con enlace directo
- Totales de árbitros activos, aprobaciones y plazas abiertas
- Exportación CSV de la temporada completa (campeonatos + árbitros)

### Normativa IPF / AEP
Matriz de requisitos mínimos de nivel por rol y tipo de campeonato, basada en las IPF Technical Rules (vigentes 01/03/2026) y el Reglamento de Competición AEP 2026:

| Rol | AEP-1 | AEP-2 | AEP-3 |
|-----|-------|-------|-------|
| Juez Central | IPF Cat. 1 | IPF Cat. 2 | Nacional |
| Juez Lateral | IPF Cat. 2 | Nacional | Regional |
| Jurado | IPF Cat. 1 | IPF Cat. 2 | Nacional |
| Pesaje | Nacional | Nacional | Regional |
| Control de material | Regional | Regional | Regional |

Filtrable por tipo de campeonato. Referencias a artículos del reglamento IPF incluidas en cada regla. Enlace directo a documentación oficial en powerlifting.sport.

### Usuarios (solo Nacional)
Alta de representantes regionales y cuentas de solo lectura. Activación/desactivación y baja de usuarios.

---

## Roles y permisos

| Rol | Qué puede hacer |
|-----|-----------------|
| `nacional` | Todo: aprueba rosters, gestiona ascensos, crea/elimina campeonatos de cualquier zona, gestiona usuarios |
| `regional` | Crea y edita campeonatos de su zona, propone tarimas, solicita ascensos, consulta directorio |
| `lectura` | Consulta únicamente: no puede crear ni editar nada |

---

## Stack técnico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 15 App Router |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| Base de datos | Supabase Postgres + Row Level Security |
| Auth | Supabase Auth — Google OAuth + email/contraseña |
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

# Ejecutar migraciones SQL en Supabase (SQL Editor):
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/003_supabase_auth.sql   (revierte a Auth nativo, sin warnings)

# Poblar datos de referencia (zonas, normativa, árbitros, campeonatos)
npm run db:seed

# Desarrollar
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Inicia sesión con Google o
crea una cuenta con email/contraseña. **El primer usuario registrado obtiene rol
`nacional` (administrador).** Configuración de Google OAuth: ver [`docs/AUTH.md`](./docs/AUTH.md).

### Despliegue en Vercel
Ver [`docs/DEPLOY.md`](./docs/DEPLOY.md) para la guía completa de variables de entorno y checklist pre-producción.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo (puerto 3000) |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run db:seed` | Pobla Supabase con zonas, árbitros, campeonatos, normativa y usuarios |
| `npm run lint` | ESLint |

---

## Documentación interna

| Documento | Contenido |
|-----------|-----------|
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Vercel, variables de entorno, checklist producción |
| [`docs/DATABASE.md`](./docs/DATABASE.md) | Esquema Postgres, RLS, tablas |
| [`docs/AUTH.md`](./docs/AUTH.md) | Supabase Auth, roles, gestión de sesiones |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Capas, RBAC, flujo de datos |
| [`docs/DESIGN.md`](./docs/DESIGN.md) | Tokens de diseño, paleta, componentes |
| [`docs/API.md`](./docs/API.md) | Endpoints REST `/api/v1/*` |
| [`docs/ROUTES.md`](./docs/ROUTES.md) | Rutas de la aplicación |
| [`docs/COMPONENTS.md`](./docs/COMPONENTS.md) | Inventario de componentes UI |

---

## Normativa IPF de referencia
- [IPF Technical Rules (EN)](https://www.powerlifting.sport/rules/codes/info/technical-rules)
- [Árbitros IPF](https://www.powerlifting.sport/federation/referees)
- [Reglamento AEP 2026](https://powerlifting.es) *(enlace oficial AEP)*
