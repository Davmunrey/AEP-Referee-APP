# API REST — `/api/v1`

Base URL en local: `http://localhost:3000/api/v1`

Todas las rutas (salvo las de `auth`) requieren sesión Supabase Auth activa (cookie `sb-*-auth-token`). Las respuestas tienen el formato:

```json
{ "data": <T> }          // éxito
{ "error": "mensaje" }   // error
```

## Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Login por email/contraseña (también gestionado desde `/sign-in`) |
| `POST` | `/auth/logout` | Cierra la sesión |
| `POST` | `/auth/signout` | Alias de cierre de sesión |
| `GET` | `/auth/me` | Usuario y perfil de la sesión actual |

## Meta y dashboard

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/meta` | Zonas, niveles y usuario actual |
| `GET` | `/dashboard` | KPIs, salud operativa, recomendaciones (`insights`), cobertura por evento, calendario, actividad, próximos eventos y `generatedAt` |

## Árbitros

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/referees` | todos | Listado filtrado por RBAC (zona para `regional`) |
| `POST` | `/referees` | nacional, regional | Crear árbitro |
| `GET` | `/referees/:id` | todos | Detalle completo |
| `PATCH` | `/referees/:id` | nacional, regional | Actualizar ficha |
| `DELETE` | `/referees/:id` | nacional | Eliminar árbitro |

## Campeonatos

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/competitions` | todos | Listado (filtrado por zona para `regional`) |
| `POST` | `/competitions` | nacional, regional | Crear campeonato |
| `GET` | `/competitions/:id` | todos | Detalle |
| `PATCH` | `/competitions/:id` | nacional, regional | Actualizar |
| `DELETE` | `/competitions/:id` | nacional, regional (solo su zona) | Eliminar |

## Tarima (roster)

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/competitions/:id/roster` | todos | Plantilla de sesiones + asignaciones actuales |
| `POST` | `/competitions/:id/roster/assign` | zona del campeonato | `{ slotKey, refereeId }` — asignar árbitro a slot |
| `POST` | `/competitions/:id/roster/clear` | zona del campeonato | `{ slotKey }` — vaciar slot |
| `POST` | `/competitions/:id/roster/draft` | zona del campeonato | Guardar borrador (crea entrada en historial) |
| `POST` | `/competitions/:id/roster/submit` | zona del campeonato | Enviar propuesta a aprobación nacional |
| `GET` | `/competitions/:id/roster/export` | todos | Descargar roster en TXT |
| `GET` | `/competitions/:id/roster/history` | todos | Historial de cambios del roster |

**Formato `slotKey`:** `{sesion}_{roleKey}_{indice}` (ej. `S1_central_0`)

## Aprobaciones

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/approvals` | todos | Listado (nacional: todas, regional: su zona) |
| `POST` | `/approvals/:id/review` | nacional | `{ approve: bool, comment?: string }` — aprobar o rechazar |

## Ascensos

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/promotions` | todos | Listado (nacional: todas, regional: su zona) |
| `POST` | `/promotions` | nacional, regional | `{ refereeId, toLevel, zona, motivo? }` — solicitar ascenso |
| `POST` | `/promotions/:id/review` | nacional | `{ approve: bool }` — aprobar o rechazar |

## Exámenes arbitrales

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/exams` | todos | Listado de exámenes; filtro opcional `?refereeId=` |
| `POST` | `/exams` | nacional, regional | `{ refereeId, tipo, nivelObjetivo, fecha, examinador, puntuacion?, puntuacionMaxima?, resultado?, notas? }` |
| `PATCH` | `/exams/:id` | nacional, regional | `{ resultado?, puntuacion?, notas?, fecha?, examinador? }` — calificar / editar |
| `DELETE` | `/exams/:id` | nacional | Eliminar examen |

## Informes de jueces

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/reports` | todos | Listado de informes; filtro opcional `?refereeId=` |
| `POST` | `/reports` | nacional, regional | `{ refereeId, titulo, tipo, evento?, contenido, adjuntoUrl? }` — subir informe (autor = usuario en sesión) |
| `DELETE` | `/reports/:id` | nacional, regional | Eliminar informe |

## Estadísticas y exportación

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/analytics` | todos | Cobertura por zona, top árbitros, tasa rechazo, totales |
| `GET` | `/analytics/export` | todos | CSV descargable con todos los campeonatos y árbitros |

## Normativa

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/regulations` | Lista de reglas IPF/AEP (rol, nivel mínimo, tipos de campeonato, nota) |

## Administración (solo `nacional`)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/users` | Lista de usuarios federativos |
| `POST` | `/admin/users` | `{ email, password, nombre, rolLabel, role, zona? }` — crear usuario |
| `PATCH` | `/admin/users/:id` | `{ activo: bool }` — activar/desactivar usuario |
| `DELETE` | `/admin/users/:id` | Eliminar usuario |
