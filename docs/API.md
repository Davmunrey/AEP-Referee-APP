# API `/api/v1`

Todas las rutas privadas exigen sesión Supabase por **cookie** (web). Respuesta estándar:

```json
{ "data": {} }
{ "error": "mensaje" }
```

## Auth

| Método | Ruta | Uso |
|---|---|---|
| `GET` | `/auth/me` | Perfil actual |
| `POST` | `/auth/logout` | Cerrar sesión |
| `POST` | `/auth/signout` | Alias cierre sesión |
| `POST` | `/auth/login` | Login email+password (server-side, fija cookies, rate-limit interno) |
| `POST` | `/auth/password` | Rate-limit pre-login: solo `action: check` (público) |
| `POST` | `/auth/change-password` | Cambiar la propia contraseña (sesión; verifica la actual) |

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
| `PUT` | `/competitions/:id/roster/template` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/template/import` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/assignments/import` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/assign` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/clear` | `canEditRoster` |
| `PATCH` | `/competitions/:id/roster/flags` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/draft` | `canEditRoster` |
| `POST` | `/competitions/:id/roster/submit` | `canEditRoster` |
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

## Exámenes, informes, ascensos

| Recurso | Rutas | Permiso |
|---|---|---|
| Exámenes | `/exams`, `/exams/:id` | gestor zona/nacional |
| Informes | `/reports`, `/reports/:id` | zona/nacional; delete nacional |
| Ascensos | `/promotions`, `/promotions/:id/review` | crear gestor; revisar nacional |
| Aprobaciones | `/approvals`, `/approvals/:id/review` | revisar nacional |

## Sanciones

| Método | Ruta | Permiso |
|---|---|---|
| `GET/POST` | `/referees/:id/sanctions` | sesión / no `solo_ver` (alta) |
| `PATCH` | `/sanctions/:id` | no `solo_ver`; `canManageSanctions` (zona) — body `{ action }` |
| `POST` | `/sanctions/:id/notify` | no `solo_ver`; `canManageSanctions` (zona) — marca como notificada |

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
| `PATCH` | `/competitions/:id/compensation/:refereeId` | `canManageCompensation` — km manual, comparte, montaje, resp. |
| `POST` | `/competitions/:id/compensation/:refereeId/export` | `canManageCompensation` — body `{ iban }` efímero → `application/pdf` |

`PATCH /competitions/:id` acepta `sedeDireccion`, `sedeLat`, `sedeLng` (desde autocomplete OSM), `compensationClubs[]`, `compensationOrganizer`, etc.

`PATCH /referees/:id` acepta `domicilio`, `domicilioLat`, `domicilioLng` (desde autocomplete OSM o geocode Nominatim en servidor). Enviar `domicilio: ""` borra dirección y coordenadas (`NULL` en Postgres).

El **IBAN no se almacena** en base de datos; solo viaja en la petición de export. Ver [`JUDGE-COMPENSATION.md`](./JUDGE-COMPENSATION.md).

## Asistente IA (widget de Ayuda)

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/assistant` | sesión (self-service) — body `{ question, history? }` |

Respalda el widget de Ayuda. El prompt se ancla al rol del usuario
(`src/lib/help/assistant-prompt.ts`) y la respuesta la genera **Google Gemini**
(`gemini-2.0-flash` por defecto, configurable con `GEMINI_MODEL`). Sin
`GEMINI_API_KEY` la ruta queda inerte (`503 { code: "not_configured" }`) y el
cliente recurre al **asistente local** basado en la base de conocimiento
(`src/lib/help/knowledge-base.ts`, `quick-start.ts`). Rate-limit en memoria:
**30 preguntas / 5 min por usuario** (`429` al exceder). La clave vive solo en el
servidor; nunca se expone al cliente.

## Seguridad import

- PDF: MIME, máximo 5 MB, firma `%PDF-`, extracción con timeout.
- XLSX: máximo 8 MB, firma ZIP, máximo 12 hojas, 2000 filas/hoja, 80 columnas/fila.
- Selección import: máximo 500 claves, 160 caracteres por clave.

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v1.8
