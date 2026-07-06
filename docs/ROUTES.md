# Rutas

Producción: [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app)

## Públicas

| Ruta | Uso |
|---|---|
| `/sign-in` | Login y recuperación de contraseña |
| `/sign-up` | Redirect a login |
| `/login` | Legacy redirect |
| `/auth/callback` | Supabase callback |
| `/docs` | Documentación web (parte pública + guía interna si hay sesión) |

## Privadas (dashboard)

| Ruta | Uso |
|---|---|
| `/` | Dashboard (KPIs, salud operativa, recomendaciones) |
| `/competitions` | Campeonatos |
| `/competitions/new` | Crear campeonato |
| `/competitions/[id]` | Tarima (constructor de cuadrante) |
| `/competitions/[id]/compensation` | Compensación del campeonato (organizador del recibo: club(es) / AEP / personalizable) |
| `/compensation` | Panel central de compensación |
| `/referees` | Directorio de jueces |
| `/referees/[id]` | Ficha de juez (incluye arbitrajes por año natural: censo vigente vs histórico) |
| `/exams` | Exámenes |
| `/reports` | Informes |
| `/approvals` | Aprobaciones de tarima |
| `/promotions` | Ascensos |
| `/analytics` | Estadísticas |
| `/regulations` | Normativa (Guía AEP, plazas, compensación, IPF) |
| `/admin/users` | Usuarios (solo nacional) |

## Sidebar (navegación)

| Sección | Enlaces |
|---|---|
| **Operaciones** | Dashboard, Campeonatos, Compensación (rol financiero / super_admin), Tarima activa (resto de roles), Directorio |
| **Gestión** | Aprobaciones, Ascensos, Exámenes, Informes, Estadísticas, Normativa, Documentación (`/docs`), Usuarios (admin) |

- El **perfil de usuario** y **Cambiar contraseña** están en el **topbar** (esquina superior derecha).
- Estado colapsado persiste en `localStorage` (`aep-tarima:sidebar-collapsed`).
- Auto-colapsa en `< 1024px` (tablet).
- Widget **Ayuda** (esquina inferior derecha): primeros pasos por rol + buscador local de temas.
- **Sincronización en vivo**: cambios en tarima, aprobaciones o compensación se reflejan automáticamente en todas las pestañas abiertas (sin recargar manualmente).

## Rol `responsable_financiero_jueces`

Ve principalmente: Dashboard (lectura), Compensación, Directorio (lectura), Estadísticas, Normativa, Documentación. No ve Tarima activa ni Aprobaciones/Ascensos/Exámenes/Informes en el menú.

## Legacy

Compat de navegación antigua se mantiene solo para no romper enlaces guardados. La UI visible usa `competitions` / «Campeonatos».

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.0
