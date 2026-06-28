# Rutas

## Públicas

| Ruta | Uso |
|---|---|
| `/sign-in` | Login/reset |
| `/sign-up` | Redirect a login |
| `/login` | Legacy redirect |
| `/auth/callback` | Supabase callback |

## Privadas

| Ruta | Uso |
|---|---|
| `/` | Dashboard |
| `/competitions` | Campeonatos |
| `/competitions/new` | Crear campeonato |
| `/competitions/[id]` | Tarima |
| `/competitions/[id]/compensation` | Compensación de gastos (solo `responsable_financiero_jueces` / `super_admin`) |
| `/docs` | Documentación web + enlace manual PDF |
| `/referees` | Directorio |
| `/referees/[id]` | Ficha juez |
| `/exams` | Exámenes |
| `/reports` | Informes |
| `/approvals` | Aprobaciones |
| `/promotions` | Ascensos |
| `/analytics` | Estadísticas |
| `/regulations` | Normativa IPF |
| `/admin/users` | Usuarios |

## Legacy

Compat de navegación antigua se mantiene solo para no romper enlaces. UI visible usa `competitions`/campeonatos.

## Sidebar

Colapsado optimizado para iconos. Estado persiste en `localStorage` (`aep-tarima:sidebar-collapsed`).
