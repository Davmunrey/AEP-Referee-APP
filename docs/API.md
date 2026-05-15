# API REST — `/api/v1`

Base URL en local: `http://localhost:3000/api/v1`

Todas las rutas (excepto login) requieren cookie de sesión `aep_session`.

## Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | `{ email, password }` → `{ user }` |
| `POST` | `/auth/logout` | Cierra sesión |
| `GET` | `/auth/me` | Usuario actual |
| `GET` | `/auth/demo-users` | Lista personas demo |
| `POST` | `/auth/switch` | `{ userId }` — cambio de persona (demo) |

## Meta y dashboard

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/meta` | Zonas, niveles, metadatos |
| `GET` | `/dashboard` | KPIs, calendario, actividad, próximos eventos |

## Árbitros

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/referees` | Listado (filtrado por RBAC) |
| `POST` | `/referees` | Crear árbitro |
| `GET` | `/referees/:id` | Detalle |
| `PATCH` | `/referees/:id` | Actualizar ficha |

## Campeonatos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/competitions` | Listado |
| `POST` | `/competitions` | Crear campeonato |
| `GET` | `/competitions/:id` | Detalle |

## Tarima (roster)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/competitions/:id/roster` | Plantilla + asignaciones |
| `POST` | `/competitions/:id/roster/assign` | `{ slotKey, refereeId }` |
| `POST` | `/competitions/:id/roster/clear` | `{ slotKey }` |
| `POST` | `/competitions/:id/roster/draft` | Guardar borrador |
| `POST` | `/competitions/:id/roster/submit` | Enviar a aprobación nacional |
| `GET` | `/competitions/:id/roster/history` | Historial de cambios |
| `GET` | `/competitions/:id/roster/export` | Export CSV |

## Aprobaciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/approvals` | Cola de propuestas |
| `POST` | `/approvals/:id/review` | `{ approve, comment? }` |

## Ascensos

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/promotions` | Solicitudes |
| `POST` | `/promotions/:id/review` | `{ approve }` |

## Analítica y normativa

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/analytics` | Métricas agregadas |
| `GET` | `/regulations` | Reglas IPF/AEP |

## Formato de respuesta

Éxito:

```json
{ "data": { ... } }
```

Error:

```json
{ "error": "Mensaje legible" }
```

## Cliente TypeScript

`src/lib/api/client.ts` exporta `api` con métodos tipados para componentes cliente.
