# API `/api/v1`

Todas las rutas privadas usan sesión Supabase por cookie. Respuesta estándar:

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
| `POST` | `/auth/login` | Legacy 410; login real vive en `/sign-in` |

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
| `GET` | `/competitions/:id/roster/export` | sesión |
| `GET` | `/competitions/:id/roster/history` | sesión |

Competiciones pasadas quedan lectura por UI y API mutadora devuelve `423`.

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

## Seguridad import

- PDF: MIME, máximo 5 MB, firma `%PDF-`, extracción con timeout.
- XLSX: máximo 8 MB, firma ZIP, máximo 12 hojas, 2000 filas/hoja, 80 columnas/fila.
- Selección import: máximo 500 claves, 160 caracteres por clave.
