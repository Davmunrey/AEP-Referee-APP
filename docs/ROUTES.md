# Rutas

## Públicas

| Ruta | Uso |
|---|---|
| `/sign-in` | Login/reset |
| `/sign-up` | Redirect a login |
| `/login` | Legacy redirect |
| `/auth/callback` | Supabase callback |
| `/docs` | Documentación web (parte pública + guía interna si hay sesión) |

## Privadas (dashboard)

| Ruta | Uso |
|---|---|
| `/` | Dashboard |
| `/competitions` | Campeonatos |
| `/competitions/new` | Crear campeonato |
| `/competitions/[id]` | Tarima |
| `/competitions/[id]/compensation` | Compensación del campeonato (`responsable_financiero_jueces` / `super_admin`) |
| `/compensation` | Panel central de compensación (mismo rol) |
| `/referees` | Directorio |
| `/referees/[id]` | Ficha juez |
| `/exams` | Exámenes |
| `/reports` | Informes |
| `/approvals` | Aprobaciones |
| `/promotions` | Ascensos |
| `/analytics` | Estadísticas |
| `/regulations` | Normativa IPF |
| `/admin/users` | Usuarios |

## Sidebar (navegación)

| Sección | Enlaces |
|---|---|
| Operaciones | Dashboard, Campeonatos, **Compensación** (rol financiero), Directorio, Tarima activa (resto de roles) |
| Gestión | Estadísticas, Normativa, **Documentación** (`/docs`), Usuarios (admin) |

- El **perfil de usuario** está en el **topbar** (esquina superior), no en el pie del sidebar.
- Estado colapsado persiste en `localStorage` (`aep-tarima:sidebar-collapsed`).
- Auto-colapsa en `< 1024px` (tablet).

## Legacy

Compat de navegación antigua se mantiene solo para no romper enlaces. UI visible usa `competitions`/campeonatos.
