# Guía demo — AEP Tarima

## Entorno local (por defecto)

```bash
npm install
npm run dev
```

Abre **http://localhost:3000** — API en memoria en `/api/v1`, sin backend externo.

`.env.development` activa automáticamente `RUN_LOCAL` + modo demo.

## Acceso rápido

1. Abre la app en local (`npm run dev`).
2. En login verás **4 plataformas demo** (si `NEXT_PUBLIC_DEMO_MODE=true`).
3. Pulsa una persona para entrar sin escribir credenciales.

## Cambiar de plataforma en vivo

Con sesión iniciada, usa el **selector de organización** en la barra lateral (debajo del logo):

| Plataforma | Usuario | Qué muestra |
|------------|---------|-------------|
| **AEP Nacional** | Laura Iglesias | Vista completa, puede aprobar propuestas |
| **AEP Regional · CAT** | Marc Vila | Solo datos de Cataluña |
| **AEP Regional · AND** | Elena Torres | Solo datos de Andalucía |
| **AEP Consulta** | Invitado Lectura | Solo lectura, sin crear ni editar |

El cambio es instantáneo (`POST /api/v1/auth/switch`) y recarga el contexto RBAC.

## Credenciales manuales

Contraseña para todos: `aep2026`

- `l.iglesias@fechap.es` — nacional
- `catalunya@fechap.es` — regional CAT
- `andalucia@fechap.es` — regional AND
- `lectura@fechap.es` — solo lectura

## Flujo recomendado para presentación

1. **Nacional** → Dashboard → Aprobaciones → aprobar/rechazar una propuesta.
2. **Regional CAT** → Campeonatos → Tarima → asignar árbitro (validación IPF).
3. **Lectura** → Mostrar que no puede crear campeonatos ni editar fichas.
4. **Nacional** → Directorio → Nuevo árbitro → ficha con edición.
5. **Nacional** → Estadísticas → cobertura por zona y eventos críticos.

## Variables de entorno

```env
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_RUN_LOCAL=true
NEXT_PUBLIC_LOCAL_API_URL=http://localhost:3000/api/v1
```

En desarrollo el modo demo está activo aunque no definas la variable.

## Diseño y tokens

La UI usa un sistema de tokens centralizado. No hay colores sueltos en componentes.

- Fuente de verdad: `src/styles/tokens.css`
- Documentación: [docs/DESIGN.md](./docs/DESIGN.md)

## Documentación técnica

| Doc | Contenido |
|-----|-----------|
| [README.md](./README.md) | Instalación y visión general |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Capas, RBAC, flujos |
| [docs/API.md](./docs/API.md) | Endpoints REST |
| [docs/ROUTES.md](./docs/ROUTES.md) | Rutas de la app |

## Despliegue Vercel

Añade `NEXT_PUBLIC_DEMO_MODE=true` en **Project Settings → Environment Variables** para que el switcher funcione en producción.
