# AEP Tarima

App interna para gestión operativa de jueces AEP: campeonatos, plantillas de tarima, cuadrantes, informes, exámenes, ascensos, estadísticas, usuarios y normativa.

Producción: [https://aep-tarima.vercel.app/](https://aep-tarima.vercel.app/)

## Estado

- Producto: beta operativa, no solo MVP.
- CI GitHub: `verify`, Playwright smoke, Supabase readiness.
- Auth: Supabase email/contraseña, sin registro público UI.
- DB: Supabase Postgres con RLS deny-by-default para cliente anon/authenticated; acceso de datos vía API + service role.
- Diseño: tokens centralizados, layout optimizado para portátil 14".

## Flujos principales

- Dashboard: radar operativo, salud, cobertura, próximos campeonatos, actividad.
- Campeonatos: listado, dedupe, calendario AEP, creación manual.
- Tarima: plantilla por campeonato, import horario PDF, import cuadrante PDF, asignación horizontal, revisión, historial, export.
- Jueces: directorio, ficha, sanciones, exámenes, informes, ascensos.
- Informes: juez o competición, visibles por zona para delegado; global para nacional/superadmin.
- Estadísticas: histórico anual desde datos reales disponibles.
- Usuarios: solo `super_admin` y `delegado_jueces`.

## Roles

| Rol | Alcance |
|---|---|
| `super_admin` | Control total |
| `delegado_jueces` | Control nacional operativo, equivalente a superadmin salvo naming |
| `delegado_zona` | Jueces, informes y tarimas de su zona |
| `solo_ver` | Lectura |

## Desarrollo

```bash
npm ci
npm run dev
```

Variables mínimas:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Verificación

```bash
npm run verify
npm run e2e
npm run audit:remote
```

`npm run verify` ejecuta readiness estático, auditoría seguridad, lint, tests y build.

## Docs

- [Guía de uso](./docs/GUIA-USO.md)
- [Arquitectura](./docs/ARCHITECTURE.md)
- [API](./docs/API.md)
- [Auth/RBAC](./docs/AUTH.md)
- [DB](./docs/DATABASE.md)
- [Deploy](./docs/DEPLOY.md)
- [Diseño](./docs/DESIGN.md)
- [QA y seguridad](./docs/AUDIT.md)
- [Readiness producción](./docs/PRODUCTION-READINESS.md)
