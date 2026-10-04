# API `/api/v1`

Todas las rutas privadas exigen sesión Supabase por **cookie** (web). Respuesta estándar:

```json
{ "data": {} }
{ "error": "mensaje" }
```

### Códigos de estado

| Código | Cuándo |
|---|---|
| `400` | Entrada inválida: JSON mal formado, fecha que no existe (`2026-02-30`), zona o nivel desconocidos, decisión de revisión que no es booleana… El mensaje dice qué falta. |
| `401` / `403` | Sin sesión / sin permiso (incluye fuera de zona y delegado sin zona asignada). |
| `404` | El recurso no existe. Un fallo al **leer** no se convierte en 404: es un 500. |
| `409` | Conflicto (propuesta ya revisada, ascenso pendiente duplicado, hueco ocupado). |
| `423` | Bloqueado: campeonato pasado, tarima en revisión o aprobada, liquidación ya **pagada**. |
| `503` | Función que necesita Supabase en un despliegue sin él (sanciones, usuarios). |
| `500` | Error interno, con mensaje genérico en español; el detalle solo va al log. |

## Auth

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/auth/me` | Perfil actual |
| `POST` | `/auth/logout` | Cerrar sesión |
| `POST` | `/auth/signout` | Alias cierre sesión |
| `POST` | `/auth/login` | Login email+password (server-side, fija cookies, rate-limit interno) |
| `POST` | `/auth/password` | Rate-limit pre-login: solo `action: check` (público) |
| `POST` | `/auth/change-password` | Cambiar la propia contraseña (sesión; verifica la actual) |
| `POST` | `/auth/judge-access` | Pública. Un juez pide su enlace de acceso con el e-mail del censo. Responde siempre lo mismo (no revela si el e-mail es de un juez) y cuenta cada petición en el límite de intentos |

Un juez (`role: juez`) **no** tiene sesión de gestión: `requireApiUser` le responde **403** (no 401, para que su navegador no lo lea como sesión caducada). Las rutas del portal usan `requireJudgeUser` y actúan siempre en nombre de la ficha enlazada (`refereeId`).

## Contraseñas

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/auth/change-password` | sesión (self-service) — body `{ currentPassword, newPassword }` |
| `POST` | `/admin/users/:id/password` | `canManageUsers` — body `{ password }`; solo super_admin resetea a otro super_admin |

## Datos base

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/meta` | sesión |
| `GET` | `/dashboard` | sesión |
| `GET` | `/analytics` | sesión |
| `GET` | `/analytics/export` | sesión |
| `GET` | `/regulations` | sesión |

## Campeonatos

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions` | sesión |
| `POST` | `/competitions` | `canEditRoster` |
| `GET` | `/competitions/:id` | sesión |
| `PATCH` | `/competitions/:id` | `canEditRoster` |
| `DELETE` | `/competitions/:id` | `canEditRoster` |
| `POST` | `/competitions/dedupe` | nacional |
| `POST` | `/calendar/import` | `super_admin`, `delegado_jueces` |

`/calendar/import` acepta PDF/CSV, devuelve preview, y con `?apply=true` crea solo filas seleccionadas.

## Tarima

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions/:id/roster` | sesión |
| `PUT` | `/competitions/:id/roster/template` | `canEditRoster` — body `{ template, baseHash? }`; `409` si la plantilla cambió desde `baseHash` |
| `POST` | `/competitions/:id/roster/template/import` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/assignments/import` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/assign` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/clear` | `canEditRoster` |
| `PATCH` | `/competitions/:id/roster/flags` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/draft` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/submit` | `canEditRoster` — `400` sin plantilla o sin jueces |
| `POST` | `/competitions/:id/roster/imprevisto` | `canEditRoster` — desbloquea tarima aprobada por imprevisto |
| `GET` | `/competitions/:id/roster/export` | sesión |
| `GET` | `/competitions/:id/roster/quadrant` | sesión |
| `GET` | `/competitions/:id/roster/quadrant.xlsx` | sesión |
| `GET` | `/competitions/:id/roster/history` | sesión |

Competiciones pasadas quedan lectura por UI y API mutadora devuelve `423`.

### Export de cuadrante

- `roster/export` → `text/plain` (acta de texto).
- `roster/quadrant` → `text/html` con el cuadrante en formato oficial AEP (portrait, roles por color + leyenda, pesaje, botón Imprimir→PDF). Posiciones sin asignar en blanco; filas/pesaje vacíos ocultos.
- `roster/quadrant.xlsx` → `.xlsx` (una hoja por día, roles=filas, sesiones=columnas).

Lógica de formato pura en `src/lib/quadrant-html.ts` y `src/lib/quadrant-excel.ts` (testeada). Los nombres se resuelven server-side con `createAdminClient`; ambas rutas validan sesión y zona.

## Jueces

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/referees` | sesión |
| `POST` | `/referees` | no `solo_ver`; zona limitada para delegado |
| `GET` | `/referees/:id` | sesión |
| `PATCH` | `/referees/:id` | no `solo_ver`; zona limitada |
| `DELETE` | `/referees/:id` | nacional |
| `POST` | `/referees/import` | nacional |
| `GET/POST` | `/referees/:id/sanctions` | sesión / gestor |
| `POST` | `/referees/portal-access` | gestor de jueces; `{ refereeIds }` (1–200). Invita al portal o reenvía el enlace; el delegado de zona solo a jueces de su zona (si la lista lleva uno de fuera, no invita a nadie). Devuelve el resultado por juez (`invitado`, `enlace-reenviado`, `reactivado`, `sin-email`, `email-en-uso`, `error`) |
| `GET` | `/referees/portal-access?ids=` | gestor de jueces; estado de acceso (`sin-acceso`, `con-acceso`, `revocado`) |
| `DELETE` | `/referees/:id/portal-access` | gestor de jueces (zona); retira el acceso al portal al momento |

`/referees/import` importa el Excel maestro de censo. Con `?replace=true` (modo "reemplazar censo") el borrado es **seguro**: solo elimina jueces ausentes del Excel y **no** asignados a ninguna tarima (respeta la FK de `roster_assignments`); los asignados se conservan y se actualizan con el Excel. No toca campeonatos ni cuadrantes. El modo replace exige además la cabecera `x-confirm-registry-replace: true`.

## Exámenes, informes, ascensos

| Recurso | Rutas | Permiso |
|---|---|---|
| Exámenes | `/exams`, `/exams/:id` | gestor zona/nacional |
| Informes | `/reports`, `/reports/:id` | zona/nacional; delete nacional |
| Ascensos | `/promotions`, `/promotions/:id/review` | crear gestor; revisar nacional |
| Aprobaciones | `/approvals`, `/approvals/:id/review` | revisar nacional |

Las revisiones (`/approvals/:id/review`, `/promotions/:id/review`) exigen `approve` **booleano** (`true`/`false`; antes `"false"` como texto se leía como aprobación) y, al rechazar, un `comment` no vacío. `POST /promotions` rechaza un `toLevel` que no sea un nivel válido o que no esté por encima del actual.

## Sanciones

| Método | Ruta | Permiso |
|---|---|---|
| `GET/POST` | `/referees/:id/sanctions` | sesión / no `solo_ver` (alta) |
| `PATCH` | `/sanctions/:id` | no `solo_ver`; `canManageSanctions` (zona) — body `{ action }` |
| `POST` | `/sanctions/:id/notify` | no `solo_ver`; `canManageSanctions` (zona) — marca como notificada |

## Convocatorias

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions/:id/convocatoria` | sesión (zona) · convocatoria viva e inscripciones |
| `POST` | `/competitions/:id/convocatoria` | gestor de la tarima (`canEditRoster`) · `{ sesiones, cierraEl, mensaje? }` |
| `PATCH` | `/competitions/:id/convocatoria` | gestor de la tarima · `{ estado?: abierta\|cerrada\|cancelada, cierraEl?, mensaje?, sesiones? }` |
| `GET` | `/portal/convocatorias` | juez · abiertas para su zona |
| `GET` | `/portal/convocatorias/:id` | juez · 404 si no llega a su zona |
| `POST` | `/portal/convocatorias/:id/inscripciones` | juez · `{ sesion, nota? }` (idempotente) |
| `DELETE` | `/portal/convocatorias/:id/inscripciones?sesion=` | juez · solo con la convocatoria abierta |

Una convocatoria viva por campeonato (índice único parcial). La fecha límite es un día natural español, inclusive, y no puede pasar del primer día del campeonato. Un juez no se apunta si tiene sanción activa o su ficha está inactiva o no disponible (las mismas condiciones que impiden asignarle en la tarima); estar designado en otro campeonato esas fechas es un **aviso**, no un bloqueo. Cerrada la convocatoria, retirarse es avisar al delegado. Las reglas viven en `src/server/convocatorias.ts`, comunes a los dos backends.

## Disponibilidad por campeonato

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions/:id/availability` | sesión |
| `POST` | `/competitions/:id/availability` | no `solo_ver` |
| `DELETE` | `/competitions/:id/availability/:refereeId` | no `solo_ver` |

`GET` devuelve `{ confirmedIds: string[] }`. `POST` acepta `{ refereeId: string }`. Errores devuelven JSON `{ error: string }` incluso ante excepciones internas.

## Geocoding / domicilio

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/geocode/search?q=…` | sesión — autocomplete Photon (España, ≥3 caracteres) |

Al guardar ficha juez o sede sin coordenadas, el servidor geocodifica con Nominatim (`geocodeAddress`).

## Compensación de jueces

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/competitions/:id/compensation` | `canManageCompensation` |
| `POST` | `/competitions/:id/compensation/recalculate` | `canManageCompensation` |
| `PATCH` | `/competitions/:id/compensation/:refereeId` | `canManageCompensation` |
| `GET` | `/compensation/hub` | `canManageCompensation` — panel central |
| `PATCH` | `/competitions/:id/compensation/:refereeId` | `canManageCompensation` — km manual, comparte, montaje, resp. Una liquidación `pagado` solo admite cambios de estado, comentario de revisión y notas de viaje (`423` si se toca el importe). |
| `POST` | `/competitions/:id/compensation/:refereeId/distance` | `canManageCompensation` — calcula km con OSRM para un juez |
| `POST` | `/competitions/:id/compensation/distances` | `canManageCompensation` — calcula km de todos (salta las pagadas) |
| `POST` | `/competitions/:id/compensation/:refereeId/export` | `canManageCompensation` — body `{ iban }` efímero → `application/pdf` |

`PATCH /competitions/:id` acepta `sedeDireccion`, `sedeLat`, `sedeLng` (desde autocomplete OSM), `compensationClubs[]`, `compensationOrganizer`, etc.

`compensationOrganizer` admite tres valores para la cabecera y los correos de pie del recibo: `club` (club(es) organizador(es), toma nombres/correos de `compensationClubs[]`), `aep` ("Asociación Española de Powerlifting") o `custom` (personalizable: reutiliza `compensationClubs[]` como nombres + correos libres). Los correos del pie del recibo varían según el organizador.

`PATCH /referees/:id` acepta `domicilio`, `domicilioLat`, `domicilioLng` (desde autocomplete OSM o geocode Nominatim en servidor). Enviar `domicilio: ""` borra dirección y coordenadas (`NULL` en Postgres).

El **IBAN no se almacena** en base de datos; solo viaja en la petición de export. Ver [`JUDGE-COMPENSATION.md`](./JUDGE-COMPENSATION.md).

## Soporte (tickets)

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/tickets?status=` | sesión — cada usuario ve los suyos; `canAdminTickets`, todos |
| `POST` | `/tickets` | sesión — `multipart/form-data` con hasta 5 fotos |
| `GET` | `/tickets/:id` | autor o admin — incluye hilo y adjuntos con URL firmada (1 h) |
| `PATCH` | `/tickets/:id` | admin (estado, nota de resolución); el autor solo puede cerrarlo |
| `POST` | `/tickets/:id/comments` | autor o admin — comentario con fotos opcionales |

Adjuntos: máximo 5 por envío y 5 MB cada uno. El tipo se decide por la firma binaria del fichero (JPEG/PNG/WebP/GIF), no por lo que declare el navegador.

## Usuarios (administración)

| Método | Ruta | Permiso |
|---|---|---|
| `GET` / `POST` | `/admin/users` | `canManageUsers` — alta con rol y zona (obligatoria para `delegado_zona`) |
| `PATCH` / `DELETE` | `/admin/users/:id` | `canManageUsers`; solo un super_admin administra a otro super_admin |

## Ayuda (widget)

El widget de Ayuda es **100 % local**: no tiene endpoint ni depende de ningún
servicio externo. Combina los primeros pasos por rol (`src/lib/help/quick-start.ts`)
con un buscador sobre la base de conocimiento curada
(`src/lib/help/knowledge-base.ts`), todo resuelto en el navegador.

## Seguridad import

- PDF: MIME, máximo 5 MB, firma `%PDF-`, extracción con timeout.
- XLSX: máximo 8 MB, firma ZIP, máximo 12 hojas, 2000 filas/hoja, 80 columnas/fila.
- Selección import: máximo 500 claves, 160 caracteres por clave.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
