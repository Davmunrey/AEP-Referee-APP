# API REST — `/api/v1`

Base URL en local: `http://localhost:3000/api/v1`

Todas las rutas (salvo `auth`) requieren sesión Supabase Auth activa (cookie `sb-*-auth-token`).

```json
{ "data": <T> }          // éxito
{ "error": "mensaje" }   // error
```

## Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/login` | Login email/contraseña |
| `POST` | `/auth/logout` | Cierra sesión |
| `POST` | `/auth/signout` | Alias de cierre de sesión |
| `GET` | `/auth/me` | Usuario y perfil actual |

## Meta y dashboard

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/meta` | Zonas, niveles y usuario actual |
| `GET` | `/dashboard` | KPIs, salud, insights, cobertura, calendario, actividad |

## Jueces

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/referees` | todos | Listado (zona filtrada para `delegado_zona`) |
| `POST` | `/referees` | no `solo_ver` | Crear juez. `delegado_zona` solo puede crear jueces en su propia zona (validado en servidor). |
| `GET` | `/referees/:id` | todos | Detalle |
| `PATCH` | `/referees/:id` | no `solo_ver` | Actualizar. `delegado_zona` solo puede editar jueces de su zona y no puede moverlos a otra. |
| `DELETE` | `/referees/:id` | `super_admin`, `delegado_jueces` | Eliminar |

## Campeonatos

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/competitions` | todos | Listado |
| `POST` | `/competitions` | `canEditRoster` | Crear |
| `GET` | `/competitions/:id` | todos | Detalle |
| `PATCH` | `/competitions/:id` | `canEditRoster` | Actualizar |
| `DELETE` | `/competitions/:id` | `canEditRoster` | Eliminar |

## Tarima (roster)

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/competitions/:id/roster` | todos | `{ template, assignments, flags }` |
| `PUT` | `/competitions/:id/roster/template` | `canEditRoster` | `{ template: RosterSession[] }` — guarda plantilla; purga slots huérfanos |
| `POST` | `/competitions/:id/roster/template/import` | `canEditRoster` | `multipart/form-data` con campo `file` (PDF AEP). Devuelve `{ preview, template }`. Con `?apply=true` persiste vía `saveCompetitionTemplate`. Límite 5 MB. |
| `PATCH` | `/competitions/:id/roster/flags` | `canEditRoster` | `{ slotKey, flags: { compartido?, intercambio? } }` — requiere juez en slot |
| `POST` | `/competitions/:id/roster/assign` | `canEditRoster` | `{ slotKey, refereeId, flags? }` |
| `POST` | `/competitions/:id/roster/clear` | `canEditRoster` | `{ slotKey }` |
| `POST` | `/competitions/:id/roster/draft` | `canEditRoster` | Guardar borrador + historial |
| `POST` | `/competitions/:id/roster/submit` | `canEditRoster` | Enviar a aprobación |
| `GET` | `/competitions/:id/roster/export` | todos | TXT del acta |
| `GET` | `/competitions/:id/roster/history` | todos | Historial de cambios |

**`slotKey`:** `{sesion}_{roleKey}_{indice}` — ej. `S1_central_0`, `S1_jurado_2`.

**Plantilla:** si `competitions.template` es `NULL`, el servicio devuelve el preset según `tipo` (AEP-1/2/3) desde `getPresetForEventType()`.

## Aprobaciones

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/approvals` | todos | Cola (nacional: todas; zona: su zona) |
| `POST` | `/approvals/:id/review` | `canApprove` | `{ approve, comment? }` — comentario obligatorio al rechazar |

## Ascensos

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/promotions` | todos | Listado (filtrado por zona para `delegado_zona`) |
| `POST` | `/promotions` | no `solo_ver` | Solicitar ascenso |
| `POST` | `/promotions/:id/review` | `canReviewPromotions` | `{ approve, comment? }` — **comentario obligatorio al rechazar** (paridad con aprobaciones) |

## Exámenes e informes

Tanto `GET /exams` como `GET /reports` aplican **scoping por zona** automáticamente: un `delegado_zona` solo ve exámenes/informes de jueces de su zona.

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/exams` | todos | `?refereeId=` opcional. Filtrado por zona para `delegado_zona`. |
| `POST` | `/exams` | no `solo_ver` | Crear examen |
| `PATCH` | `/exams/:id` | no `solo_ver` | Calificar / editar |
| `DELETE` | `/exams/:id` | `canAdminJudges` | Eliminar |
| `GET` | `/reports` | todos | `?refereeId=` opcional. Filtrado por zona para `delegado_zona`. |
| `POST` | `/reports` | no `solo_ver` | Subir informe |
| `PATCH` | `/reports/:id` | no `solo_ver` | Editar campos: `titulo`, `tipo`, `evento`, `contenido`, `adjuntoUrl` |
| `DELETE` | `/reports/:id` | `canAdminJudges` | Eliminar |

## Estadísticas y normativa

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/analytics` | Métricas de temporada |
| `GET` | `/analytics/export` | CSV |
| `GET` | `/regulations` | Matriz normativa |

## Administración

`canManageUsers` cubre `super_admin` y `delegado_jueces`.

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| `GET` | `/admin/users` | `canManageUsers` | Lista usuarios con `created_at` |
| `POST` | `/admin/users` | `canManageUsers` | Crear usuario `{ email, password, nombre, role, zona?, rolLabel? }` |
| `PATCH` | `/admin/users/:id` | `canManageUsers` | `{ activo?, role?, zona?, nombre?, rolLabel? }` — guards anti-self-demote |
| `DELETE` | `/admin/users/:id` | `canManageUsers` | Eliminar (no permite borrar la propia cuenta) |
