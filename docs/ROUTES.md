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
| `/sign-in?juez=1` | Acceso de jueces (e-mail y contraseña) |
| `/sign-in?codigo=1` | El juez canjea su código de acceso y crea su contraseña (enlace del mensaje que copia el delegado) |

## Portal del juez (rol `juez`)

| Ruta | Uso |
|---|---|
| `/portal` | Inicio: próximas designaciones y aviso de sanción activa |
| `/portal/convocatorias` | Convocatorias abiertas para el juez |
| `/portal/convocatorias/[id]` | Apuntarse o retirarse sesión a sesión |
| `/portal/sesiones` | Designaciones aprobadas (sesión, día, horarios, funciones) e historial |
| `/portal/ficha` | Sus datos del censo (solo lectura) |

El personal de gestión que abre `/portal` vuelve a `/`; un juez que abre una ruta del panel va a `/portal`. En móvil la navegación es una barra de pestañas inferior.

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
| `/tickets` | Soporte: tickets internos con fotos (cada usuario ve los suyos; admins, todos) |
| `/tickets/[id]` | Detalle de ticket con hilo de comentarios y adjuntos |
| `/admin/users` | Usuarios (super_admin y delegado de jueces) |

## Sidebar (navegación)

| Grupo | Enlaces |
|---|---|
| **General** | Dashboard, Estadísticas |
| **Competiciones** | Campeonatos, Tarima activa, Aprobaciones (no rol financiero) · Compensación (rol financiero / super_admin) |
| **Jueces** | Directorio · Ascensos, Exámenes, Informes (no rol financiero) |
| **Referencia** | Normativa, Documentación (`/docs`), Soporte (`/tickets`) |
| **Administración** | Usuarios (super_admin / delegado de jueces) |

La miga de pan de la barra superior dice el grupo del menú en el que vive cada página; el título no lleva rótulo encima.

- **Tarima activa** lleva al campeonato vigente más próximo (por fecha de fin); si no hay ninguno vigente, al último pasado.
- **Móvil (< 768 px):** el menú lateral se sustituye por un cajón que se abre desde el botón ☰ de la barra superior; incluye el buscador y se cierra al navegar o con Escape. La barra superior muestra el nombre de la página (o del campeonato) en lugar de las migas.

- El **perfil de usuario** y **Cambiar contraseña** están en el **topbar** (esquina superior derecha).
- Estado colapsado persiste en `localStorage` (`aep-tarima:sidebar-collapsed`).
- Auto-colapsa en `< 1024px` (tablet) si el usuario no ha elegido antes; plegado, los contadores se muestran como un punto.
- Widget **Ayuda** (esquina inferior derecha): primeros pasos por rol + buscador local de temas.
- **Sincronización en vivo**: cambios en tarima, aprobaciones o compensación se reflejan automáticamente en todas las pestañas abiertas (sin recargar manualmente).

## Rol `responsable_financiero_jueces`

Ve principalmente: Dashboard (lectura), Compensación, Directorio (lectura), Estadísticas, Normativa, Documentación. No ve Tarima activa ni Aprobaciones/Ascensos/Exámenes/Informes en el menú.

## Legacy

Compat de navegación antigua se mantiene solo para no romper enlaces guardados. La UI visible usa `competitions` / «Campeonatos».

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
