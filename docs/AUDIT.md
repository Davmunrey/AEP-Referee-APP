# AUDIT — AEP Tarima Platform
**Fecha:** 2026-05-17  
**Auditor:** QA Expert (subagente read-only)  
**Versión:** basada en estado actual del repo (`/Users/mac/AEP-Referee-APP`)  
**Scope:** Código fuente completo — no se ha ejecutado la app ni se ha accedido a producción.

### Addendum 2026-05-17 (post-auditoría operativa)

Correcciones aplicadas en la misma rama:

- Eliminados datos demo (`mock-data` sin jueces/eventos; `db:cleanup-demo`; seed solo zonas/normativa).
- Sidebar **Tarima activa** → `pickActiveRosterHref` (enlace dinámico, sin duplicar listado).
- Permisos UI centralizados en `src/lib/permissions.ts` (alineados con API).
- Importación registro jueces: Excel + `POST /referees/import` + `npm run db:import-judges`.
- Calendario dashboard desde competiciones en BD (`calendar-from-competitions.ts`).
- Eliminado `coming-soon.tsx` con rutas hardcodeadas.

**2026-05-17 (cierre):** invite-only (`011` + `invited` metadata), `/regulations` fuera de rutas públicas, PATCH informes con scope zona + `getReport`.

---

## 1. Resumen Ejecutivo

La plataforma AEP Tarima es un Next.js 15 App Router con Supabase como backend. La arquitectura RBAC es sólida en los endpoints críticos (asignación, aprobación, ascensos) y el scoping por zona del `delegado_zona` está implementado correctamente en ambos servicios (Supabase y memoria). Sin embargo, se detectan **cinco problemas significativos**:

1. **Sidebar muestra "Usuarios" SOLO a `super_admin`** — `delegado_jueces` tiene la misma autoridad por `canManageUsers()` pero no ve el ítem de navegación (`src/components/layout/sidebar.ts:118`).
2. **`/reports/:id` no tiene endpoint PATCH** — el `ReportsManager` no puede editar informes existentes; el cliente sí invoca `updateExam` pero no existe equivalente para reports.
3. **`delegado_zona` puede crear árbitros en cualquier zona** — `POST /referees` solo bloquea a `solo_ver`; no restringe la zona del nuevo árbitro al delegado de zona.
4. **`/regulations` no requiere autenticación** — está en la lista pública del middleware (`PUBLIC_PATHS`) y el endpoint no llama a `requireApiUser()`.
5. **Signup público sin bloquear** — cualquier persona puede crear una cuenta que recibe rol `solo_ver` automáticamente; no existe aviso en la UI de que necesitarán aprobación manual de rol.

---

## 2. Matriz de Capacidades por Rol

> `yes` = permitido | `no` = bloqueado | `(zona)` = solo para su zona | `?` = no verificado en código

| Capacidad | super_admin | delegado_jueces | delegado_zona | solo_ver | Fuente |
|-----------|:-----------:|:---------------:|:-------------:|:--------:|--------|
| Ver dashboard | yes | yes | yes | yes | `getSession()` |
| Ver listado campeonatos | yes | yes | yes (zona) | yes | `getCompetitions(user)` |
| Crear campeonato | yes | yes | yes (zona) | **no** | `POST /competitions` line 15 |
| Editar campeonato (PATCH) | yes | yes | yes (zona) | **no** | `PATCH /competitions/:id` line 21 |
| Eliminar campeonato | yes | yes | yes (zona) | **no** | `DELETE /competitions/:id` line 49 |
| Ver tarima | yes | yes | yes (zona) | yes | `GET /roster` no RBAC |
| Asignar árbitro a slot | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Quitar árbitro de slot | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Aplicar flags slot (* / ↑↓) | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Editar plantilla sesiones | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Importar horario PDF | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Guardar borrador | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Enviar a aprobación | yes | yes | yes (zona) | **no** | `canEditRoster()` |
| Exportar tarima TXT | yes | yes | yes | yes | sin RBAC |
| Ver historial tarima | yes | yes | yes | yes | sin RBAC (todos) |
| Ver aprobaciones | yes | yes | yes (zona) | yes (zona) | `getApprovals(user)` |
| Aprobar / rechazar tarima | yes | yes | **no** | **no** | `canApprove()` |
| Ver directorio árbitros | yes | yes | yes (zona) | yes | `getReferees(user)` |
| Crear árbitro | yes | yes | yes ⚠️ | **no** | `POST /referees` line 24 — **sin restricción de zona** |
| Editar árbitro | yes | yes | yes | **no** | `PATCH /referees/:id` line 22 — **sin restricción de zona** |
| Eliminar árbitro | yes | yes | **no** | **no** | `DELETE /referees/:id` line 49 |
| Ver perfil árbitro | yes | yes | yes (zona) | yes | `[id]/page.tsx` line 33 |
| Solicitar ascenso | yes | yes | yes (zona) | **no** | `POST /promotions` line 15 |
| Revisar ascenso | yes | yes | **no** | **no** | `canReviewPromotions()` |
| Crear examen | yes | yes | yes | **no** | `POST /exams` line 18 |
| Editar examen | yes | yes | yes | **no** | `PATCH /exams/:id` line 13 |
| Eliminar examen | yes | yes | **no** | **no** | `canAdminJudges()` |
| Crear informe | yes | yes | yes | **no** | `POST /reports` line 18 |
| Eliminar informe | yes | yes | **no** | **no** | `canAdminJudges()` |
| Ver estadísticas | yes | yes | yes | yes | `GET /analytics` — todos |
| Exportar CSV estadísticas | yes | yes | yes | yes | `GET /analytics/export` — todos |
| Ver normativa IPF | yes | yes | yes | yes | sin auth requerida |
| Gestionar usuarios | yes | yes ⚠️ | **no** | **no** | API: `canManageUsers()` OK; UI: solo `super_admin` en sidebar |
| Crear usuario (admin) | yes | yes | **no** | **no** | `canManageUsers()` |
| Activar/desactivar usuario | yes | yes | **no** | **no** | `canManageUsers()` |
| Eliminar usuario | yes | yes | **no** | **no** | `canManageUsers()` |

---

## 3. Recorrido por Página

### 3.1 `/sign-in` — Página de autenticación

**Ubicación:** `src/app/sign-in/[[...sign-in]]/page.tsx`

| Elemento | Detalle |
|----------|---------|
| Botones | "Iniciar sesión" / "Crear cuenta" (tab switcher) |
| Formulario signin | email (required), password (required, minLength=8) |
| Formulario signup | nombre, email (required), password (required, minLength=8) |
| Error handling | `role="alert"` en div, mensajes localizados |
| Loading state | `Loader2` spinner visible durante submit |
| Info tras signup | Muestra "Revisa tu email para confirmarla" |
| Redirección autenticados | Middleware redirige a `/` si ya autenticado |

**Gaps:**
- No se indica en la UI que tras crear cuenta el usuario recibirá rol `solo_ver` (visible, pero sin capacidades de escritura). El nuevo usuario puede confundirse creyendo tener acceso completo.
- El nombre en signup es opcional en código (`nombre || email.split("@")[0]`) pero el placeholder dice "Nombre completo" sin indicar que es opcional.
- No existe "¿Olvidaste tu contraseña?" — reset de contraseña ausente en la UI.

---

### 3.2 `/` — Dashboard

**Ubicación:** `src/app/(dashboard)/page.tsx`, `src/components/dashboard/`

| Elemento | Detalle |
|----------|---------|
| Componentes | DashboardLive, DashboardHero, KpiCards, HealthGauge, InsightsPanel, OperationalCalendar, CoverageForecast, EventsTable, ActivityFeed |
| Datos | SSR desde `dataService.getDashboard(user)` |
| Loading state | Archivo `loading.tsx` existe en `(dashboard)/` — aplica a toda la sección |
| Error state | `src/app/error.tsx` existe |

**Gaps:**
- Dashboard no filtra por zona para `delegado_zona` en los KPIs — se muestran totales nacionales porque `buildKpis()` en memoria no aplica zona; en Supabase depende de `buildKpis(input)` donde `competitions` y `referees` ya vienen filtrados. En memoria, los KPIs muestran totales globales aunque `getCompetitions(user)` filtre. (**MEDIUM**)
- `CoverageForecast` y `InsightsPanel` — no se ha podido verificar si sus datos respetan el scoping de zona (dependen de `DashboardPayload` devuelto por el servicio).
- No existe botón de acción rápida "Crear campeonato" en el dashboard (solo en `/events`). Menor pero puede mejorar la UX.

---

### 3.3 `/events` — Listado de campeonatos

**Ubicación:** `src/app/(dashboard)/events/page.tsx`, `src/components/events/events-table.tsx`

| Elemento | Detalle |
|----------|---------|
| Botón "Nuevo campeonato" | Visible para `super_admin` y `delegado_zona`; **ausente para `delegado_jueces`** |
| Filtros | Búsqueda por nombre/sede, tipo (AEP-1/2/3), estado |
| Paginación | 20 por página, cliente |
| Eliminar evento | Visible para `super_admin` (todo) y `delegado_zona` (su zona); **ausente para `delegado_jueces`** |
| Empty state | Presente (`EmptyState`) |
| Loading | Spinner durante delete |

**Gaps:**
- **Botón "Nuevo campeonato" ausente para `delegado_jueces`** (`events/page.tsx:26`): la comprobación es `user.role === "super_admin" || user.role === "delegado_zona"` — omite `delegado_jueces`, que tiene permisos totales en la API (`canManageCompetitions`). (**HIGH**)
- **Delete ausente para `delegado_jueces`** (`events-table.tsx:62-66`): `canDelete` devuelve `true` solo para `super_admin` y `delegado_zona`. (**HIGH**)
- La tabla no muestra zona del campeonato — dificulta al `delegado_jueces` saber de qué zona es cada evento. (**LOW**)

---

### 3.4 `/events/new` — Crear campeonato

**Ubicación:** `src/app/(dashboard)/events/new/page.tsx`, `src/components/events/new-competition-form.tsx`

| Elemento | Detalle |
|----------|---------|
| Auth guard | `solo_ver` redirige a `/events` |
| Campos | nombre (required), tipo, fecha inicio/fin, sede, sesiones (1-6), plazas requeridas (≥1), zona |
| Validación cliente | fecha fin < inicio, sesiones [1-6], plazas ≥1 |
| Validación servidor | Duplicada en `POST /competitions` |
| `delegado_zona` | `defaultZona` pre-rellena su zona; la API rechaza otras zonas |
| Aviso unsaved | `beforeunload` si hay cambios |
| Error state | Mensaje inline |
| Loading state | Botón deshabilitado + texto "Guardando…" |

**Gaps:**
- `delegado_jueces` puede acceder a `/events/new` (no está bloqueado), pero el formulario muestra el campo de zona sin pre-rellenar (`defaultZona` solo viene de `user.zona`). Para `delegado_jueces` la zona quedará vacía si no la elige. La API acepta zona vacía string `""`. (**MEDIUM**)
- No existe confirmación / página de éxito — redirige directamente al roster builder. Si el servidor falla, el error se muestra pero no hay toast/notificación persistente. (**LOW**)

---

### 3.5 `/events/[id]` — Constructor de tarima (Roster Builder)

**Ubicación:** `src/app/(dashboard)/events/[id]/page.tsx`, `src/components/events/roster-builder.tsx`

| Elemento | Detalle |
|----------|---------|
| Auth guard | `delegado_zona` sin acceso a zona ajena → `notFound()` |
| Panel árbitros | Búsqueda, filtros zona/nivel, drag-and-drop, selección por clic |
| Panel tarima | Sesiones agrupadas por día, slots con indicador de nivel y flags |
| Editar plantilla | Botón "Editar plantilla" visible solo si `canEdit` |
| Historial | `RosterHistoryPanel` visible para todos |
| Acciones | "Guardar borrador", "Exportar", "Enviar a aprobación" — solo si `!readOnly` |
| Flags slot | `*` (compartido) y `↑↓` (intercambio) — solo si `!readOnly` y slot ocupado |
| Violaciones normativa | Badge de alerta en slots con árbitro que no cumple nivel mínimo |
| Loading / Error | Status message inline, revert optimista en error |
| Schedule import | `ScheduleImportDialog` accesible desde `RosterTemplateEditor` |

**Gaps:**
- **`ScheduleImportDialog` no está expuesto desde el toolbar principal del Roster Builder** — solo accesible desde dentro del `RosterTemplateEditor` (modo edición). El usuario tiene que activar "Editar plantilla" primero para ver el importar PDF. No es obvio. (**MEDIUM**)
- El filtro de árbitros muestra árbitros de **todas las zonas** por defecto — un `delegado_zona` puede asignar árbitros de otras zonas (la API lo permite, no hay restricción de zona en `assign`). No es un error de seguridad (el delegado puede querer árbitros de otras zonas), pero puede ser confuso. (**LOW**)
- El revert optimista en `persistAssign` guarda `snapshot = assignments` (sin `const` seguro para closures anidados); el valor se captura correctamente en el scope externo — no es un bug pero merece atención. (**LOW**)
- Grupos (`RosterGrupo`) se renderizan correctamente en el builder. En el exportador TXT (`roster-export.ts`) no se ha verificado que los grupos aparezcan — no auditado. (**LOW**)
- El `violationCount` está calculado solo sobre `session.roles`, no sobre `pesajeRoles` — los slots de pesaje pueden tener violaciones no contadas en el badge de cabecera. (**MEDIUM**)

---

### 3.6 `/referees` — Directorio de árbitros

**Ubicación:** `src/app/(dashboard)/referees/page.tsx`, `src/components/referees/referees-directory.tsx`

| Elemento | Detalle |
|----------|---------|
| Scoping | `dataService.getReferees({ user })` — `delegado_zona` solo ve su zona |
| Filtros | Nombre, zona, nivel, estado |
| Paginación | 25 por página, cliente |
| Botón "Nuevo árbitro" | Visible si `canEdit` (`user.role !== "solo_ver"`) |
| Delete | Visible si `canEdit` — pero `canEdit = role !== "solo_ver"` incluye `delegado_zona` |
| Empty state | Presente, diferencia sin árbitros vs filtros |

**Gaps:**
- **`delegado_zona` puede eliminar árbitros de su zona mediante el botón Delete** — el botón está visible y llama a `DELETE /referees/:id`, que solo bloquea si el rol no es `super_admin` ni `delegado_jueces`. Un `delegado_zona` puede borrar árbitros. ¿Es intencional? La API lo permite explícitamente al bloquear solo `solo_ver`. Si no es intencional, falta restricción de zona en `DELETE`. (**HIGH — potencialmente intencional pero no documentado**)
- **`delegado_zona` puede crear árbitros en cualquier zona** — `POST /referees` no valida zona del árbitro contra zona del usuario. Un `delegado_zona` de Madrid puede crear un árbitro en Cataluña. (**HIGH**)
- El formato de zona en la tabla muestra código y nombre: `{referee.zona} · {zoneName(...)}` — redundante pero informativo. (**LOW**)

---

### 3.7 `/referees/[id]` — Ficha de árbitro

**Ubicación:** `src/app/(dashboard)/referees/[id]/page.tsx`

| Elemento | Detalle |
|----------|---------|
| Auth guard | `delegado_zona` fuera de zona → `notFound()` |
| `canEdit` | `role !== "solo_ver"` |
| `canDelete` | `role === "super_admin" \|\| role === "delegado_jueces"` |
| Secciones | Resumen, trayectoria (4 stats), ExamsManager, ReportsManager, RefereeEditForm, RefereePromotionButton |
| RefereePromotionButton | Visible si `canEdit`; formulario de ascenso con nivel destino y motivo |

**Gaps:**
- **`RefereePromotionButton` visible para `delegado_zona`** — correcto que puedan solicitarlo, pero la zona del ascenso se pasa desde el cliente (`zona={referee.zona}`). La API deriva la zona del árbitro (anti-IDOR), por lo que es seguro. Sin embargo, un `delegado_zona` podría solicitar ascenso de árbitro de su zona aunque el árbitro sea de otra zona si accede directamente a la URL. La guard `notFound()` en página lo previene — **ok**. (**LOW — informativo**)
- `RefereeEditForm` no tiene campo `eventos` ni `ultimo` editables — son campos de solo lectura en el formulario aunque existen en `PATCH /referees/:id`. Correcto (se actualizan automáticamente), pero el usuario podría querer corregirlos manualmente. (**LOW**)
- No existe botón de eliminación de árbitro en la ficha — solo en el listado. Inconsistencia UX. (**MEDIUM**)

---

### 3.8 `/exams` — Exámenes (global)

**Ubicación:** `src/app/(dashboard)/exams/page.tsx`, `src/components/judge/exams-manager.tsx`

| Elemento | Detalle |
|----------|---------|
| Datos | `dataService.getExams()` — sin filtro de usuario (todos los exámenes) |
| Stats | Totales, aprobados, pendientes, tasa aprobación |
| `canEdit` | `role !== "solo_ver"` |
| `canDelete` | `role === "super_admin" \|\| role === "delegado_jueces"` |

**Gaps:**
- **`getExams()` sin parámetro `user`** — `delegado_zona` ve exámenes de **todos los árbitros**, no solo de su zona. La API `GET /exams` tampoco filtra por zona. Falta scoping de zona para exámenes. (**HIGH**)
- Misma issue en `GET /reports` — sin filtrado por zona. (**HIGH**)
- El `ExamsManager` en `/exams` tiene `lockedRefereeId` como `undefined` — permite crear exámenes para cualquier árbitro, incluidos de otras zonas para `delegado_zona`. (**HIGH**)

---

### 3.9 `/reports` — Informes (global)

**Ubicación:** `src/app/(dashboard)/reports/page.tsx`

| Elemento | Detalle |
|----------|---------|
| Datos | `dataService.getReports()` — sin filtro |
| Page title | "Sandbox de informes" — término técnico visible al usuario |

**Gaps:**
- Misma issue de scoping que `/exams`. (**HIGH**)
- **No existe `PATCH /reports/:id`** — el `client.ts` define `updateExam` pero no `updateReport`. Si el `ReportsManager` tiene funcionalidad de edición, invocará un endpoint inexistente. Ver `reports/[id]/route.ts` — solo tiene `DELETE`. (**HIGH**)
- "Sandbox de informes" es un nombre inapropiado para un entorno de producción. (**LOW**)

---

### 3.10 `/approvals` — Aprobaciones

**Ubicación:** `src/app/(dashboard)/approvals/page.tsx`, `src/components/approvals/approvals-board.tsx`

| Elemento | Detalle |
|----------|---------|
| Datos | `getApprovals(user)` — scoping correcto (zona para delegado_zona) |
| `canReview` | `canApprove(user)` — solo `super_admin` y `delegado_jueces` |
| Diff roster | Muestra `slot → referee_name` |
| Comentario rechazo | Obligatorio (validación cliente) |
| Error state | `reviewError` con mensaje inline |
| Botón "Abrir tarima" | Link a `/events/{eventId}` |
| Empty state | `EmptyState` si no hay propuestas |

**Gaps:**
- El diff de roster muestra `slot_key` cruda (ej. `S1_central_0`), no el nombre legible del rol ("Central"). (**MEDIUM**)
- El badge de estado del evento en el detalle siempre muestra `"Incompleto"` hardcoded (`<EventStatusBadge status="Incompleto" />`), independientemente del estado real. (**HIGH**)
- `solo_ver` puede ver todas las aprobaciones de su zona — ¿es intencional? No hay bloqueo. Parece correcto pero no está documentado. (**LOW**)
- No hay paginación en la lista de propuestas — si hay muchas, la UI se vuelve larga. (**LOW**)

---

### 3.11 `/promotions` — Ascensos

**Ubicación:** `src/app/(dashboard)/promotions/page.tsx`, `src/components/promotions/promotions-board.tsx`

| Elemento | Detalle |
|----------|---------|
| `canReview` | `canReviewPromotions(user)` |
| `canCreate` | `role !== "solo_ver"` |
| Datos | `getPromotions(user)` — scoping correcto |
| NewPromotionDialog | Filtro de árbitros por `userZona` si `delegado_zona` |
| Empty state | Presente |
| Error state | `reviewError` fuera del `map()` — podría acumularse |

**Gaps:**
- **Rechazo de ascenso sin comentario obligatorio** — a diferencia de aprobaciones, el rechazo de ascenso (`POST /promotions/:id/review`) no requiere comentario. La API no valida `comment`. (**MEDIUM**)
- `reviewError` se renderiza fuera del listado, lo que puede ser confuso cuando hay múltiples ítems y el error corresponde a uno específico. (**LOW**)

---

### 3.12 `/analytics` — Estadísticas

**Ubicación:** `src/app/(dashboard)/analytics/page.tsx`, `src/components/analytics/analytics-dashboard.tsx`

| Elemento | Detalle |
|----------|---------|
| Datos | `getAnalytics(user)` — en Supabase no filtra por zona |
| CSV export | Link directo a `/analytics/export` |
| Empty state | Presente en "árbitros más activos" y "eventos críticos" |

**Gaps:**
- **`delegado_zona` ve analytics nacionales** — `getAnalytics(user)` en el servicio Supabase no aplica filtro de zona. En memoria tampoco. Los datos de cobertura por zona son nacionales para todos. Puede ser intencional (vista de contexto), pero no está documentado. (**MEDIUM**)
- No hay control de acceso en `GET /analytics/export` — cualquier usuario autenticado puede descargar el CSV completo, incluido datos de todas las zonas. (**MEDIUM**)

---

### 3.13 `/regulations` — Normativa IPF

**Ubicación:** `src/app/(dashboard)/regulations/page.tsx`, `src/components/regulations/regulations-view.tsx`

| Elemento | Detalle |
|----------|---------|
| Auth | Sin `getSession()` — página accessible sin autenticación en middleware |
| Datos | `dataService.getRegulations()` |
| Endpoint | `GET /api/v1/regulations` — sin `requireApiUser()` |

**Gaps:**
- **`/regulations` y `GET /regulations` son públicas** — están en `PUBLIC_PATHS` del middleware. Si el contenido es solo la matriz normativa IPF pública, puede ser intencional. Pero el patrón es inconsistente con el resto de la app que requiere sesión. (**LOW — posiblemente intencional**)
- La página `regulations/page.tsx` no llama a `getSession()` — si Supabase no está configurado (modo memoria), funciona; en prod con Supabase podría haber comportamientos inesperados. (**LOW**)

---

### 3.14 `/admin/users` — Gestión de usuarios

**Ubicación:** `src/app/(dashboard)/admin/users/page.tsx`, `src/components/admin/users-admin.tsx`

| Elemento | Detalle |
|----------|---------|
| Guard página | `canManageUsers(user)` → redirect a `/` si no autorizado |
| Formulario | email, password (≥8), nombre, etiqueta rol, role (select), zona (si delegado_zona) |
| Tabla | nombre, email, rol, zona, activo, acciones |
| Acciones | Activar/Desactivar, Eliminar |
| Self-protection | API bloquea desactivar o cambiar rol propio |
| Password en form | Visible en texto `type="password"` — **no se envía de vuelta** |

**Gaps:**
- **`delegado_jueces` no ve "Usuarios" en el sidebar** — `buildSecondaryNav` comprueba `isNacional: currentUser.role === "super_admin"` (solo super_admin). Un `delegado_jueces` puede acceder directamente a `/admin/users` (la página tiene su propio guard), pero no hay enlace en la navegación. (**HIGH**)
- **Sin notificación de credenciales al usuario creado** — al crear usuario, la contraseña la introduce el admin y no hay mecanismo para enviársela al nuevo usuario. El email de confirmación de Supabase llega, pero sin contraseña. (**HIGH**)
- **Edición de rol en tabla de usuarios ausente** — la API `PATCH /admin/users/:id` soporta cambiar `role` y `zona`, pero la UI solo expone Activar/Desactivar. No hay forma desde la UI de cambiar el rol de un usuario existente sin recrearlo. (**HIGH**)
- La tabla de usuarios no muestra `created_at` aunque la API lo devuelve. (**LOW**)
- No hay búsqueda/filtrado en la tabla de usuarios. (**LOW**)

---

### 3.15 Sidebar y Topbar

**Ubicación:** `src/components/layout/sidebar.tsx`, `src/components/layout/topbar.tsx`

| Elemento | Detalle |
|----------|---------|
| Logo AEP + colapso | Funcional |
| OrgSwitcher | Muestra org y subtitle según rol |
| Nav primaria | Dashboard, Campeonatos, Directorio, Constructor Tarima |
| Nav secundaria | Aprobaciones (badge), Ascensos, Exámenes, Informes, Estadísticas, Normativa, Usuarios (solo super_admin) |
| Cerrar sesión | Supabase signOut + redirect /sign-in |
| Collapse | Estado local (no persistido) |
| Topbar search | Búsqueda global → `/referees?q=...` |

**Gaps:**
- **"Constructor Tarima" en nav primaria enlaza a `/events`**, no a un sub-path del builder. El `match` es `p.startsWith("/events/") && p !== "/events"` — muestra activo cuando estás en `/events/[id]`. Correcto pero el label "Constructor Tarima" puede confundirse con ir a la lista. (**LOW**)
- **"Usuarios" solo para `super_admin`** — como se señaló en §3.14. (**HIGH**)
- La búsqueda del topbar está oculta en `hideSearch = pathname.startsWith("/events/")` — en el roster builder no hay buscador en la topbar. Correcto por diseño pero no hay alternativa de búsqueda global. (**LOW**)
- El colapso del sidebar no persiste al recargar (estado local React). (**LOW**)

---

### 3.16 Modales / Dialogs

#### NewRefereeDialog
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✓
- Focus management: `dialogRef.current?.focus()` ✓
- Escape key handler ✓
- Click backdrop cierra ✓
- **Gap:** Al hacer clic en el backdrop (overlay), el click propagation puede causar que el clic pase a elementos subyacentes. El stopPropagation interno previene esto para el contenido del diálogo, pero el overlay `onClick={onClose}` cierra al primer clic — correcto. ✓

#### ScheduleImportDialog
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✓
- Escape key handler ✓
- **Gap:** Sin focus trap completo — el foco puede salir del modal con Tab hacia la página. (**MEDIUM**)
- **Gap:** El `apply` en `ScheduleImportDialog` llama a `api.saveTemplate()` directamente (vía PUT template), no al endpoint `POST .../import?apply=true`. Son equivalentes pero usan caminos distintos. (**LOW — cosmético**)

#### RosterTemplateEditor
- Expone `ScheduleImportDialog` ✓
- Botones "Guardar" / "Cancelar" visibles ✓
- **Gap:** Sin confirmación al cancelar con cambios no guardados. (**MEDIUM**)

#### RefereePromotionButton
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` ✓
- Escape handler ✓
- Focus management ✓

#### ApprovalsBoard (no es modal, es panel)
- `aria-pressed` en botones de selección de propuesta ✓

---

## 4. Gaps por Severidad

### CRITICAL

Ninguno detectado (sin riesgo inmediato de pérdida de datos o brecha de seguridad crítica).

---

### HIGH

| # | Gap | Ubicación | Descripción | Fix sugerido |
|---|-----|-----------|-------------|-------------|
| H1 | `delegado_jueces` sin enlace a Usuarios en sidebar | `src/components/layout/sidebar.tsx:118` | `isNacional` solo es `true` para `super_admin`. `delegado_jueces` tiene `canManageUsers()=true` pero no ve la ruta. | Cambiar `currentUser.role === "super_admin"` a `canManageUsers(currentUser)` o `user.role === "super_admin" \|\| user.role === "delegado_jueces"` |
| H2 | Sin botón "Nuevo campeonato" para `delegado_jueces` | `src/app/(dashboard)/events/page.tsx:26` | Condición excluye `delegado_jueces`. | Añadir `\|\| user.role === "delegado_jueces"` a la condición del botón. |
| H3 | Sin botón Delete evento para `delegado_jueces` | `src/components/events/events-table.tsx:62-66` | `canDelete` no incluye `delegado_jueces`. | Añadir `role === "delegado_jueces"` en `canDelete`. |
| H4 | `POST /referees` sin scoping de zona | `src/app/api/v1/referees/route.ts:22-44` | `delegado_zona` puede crear árbitros en cualquier zona. | Añadir bloque análogo al de competitions: si `user.role === "delegado_zona"`, forzar `body.zona = user.zona`. |
| H5 | `PATCH /referees/:id` sin scoping de zona | `src/app/api/v1/referees/[id]/route.ts:19-44` | `delegado_zona` puede editar árbitros de otras zonas. | Verificar zona del árbitro antes de aplicar el patch, igual que competition PATCH. |
| H6 | Exámenes e informes sin scoping de zona | `src/app/api/v1/exams/route.ts`, `src/app/api/v1/reports/route.ts` | `GET /exams` y `GET /reports` no filtran por zona. `delegado_zona` ve datos de toda España. | Pasar `user` a `getExams(user?)` y `getReports(user?)` para filtrar. |
| H7 | Sin endpoint `PATCH /reports/:id` | `src/app/api/v1/reports/[id]/route.ts` | Solo `DELETE`. Si `ReportsManager` tiene edición, el endpoint es inexistente. | Implementar `PATCH /reports/:id` análogo a `PATCH /exams/:id`. |
| H8 | Badge estado en AprovalsBoard hardcoded | `src/components/approvals/approvals-board.tsx:123` | Siempre muestra `EventStatusBadge status="Incompleto"` sin importar el estado real. | Usar `selected.eventId` para obtener el estado real, o incluir estado en `ApprovalProposal`. |
| H9 | Sin editor de rol en tabla de usuarios | `src/components/admin/users-admin.tsx` | No hay campo para cambiar role/zona de usuario existente. | Añadir formulario inline o modal de edición que invoque `PATCH /admin/users/:id`. |
| H10 | Sin notificación de credenciales al crear usuario | `src/app/api/v1/admin/users/route.ts` | Admin introduce contraseña pero el nuevo usuario no la recibe de forma automática. | Añadir campo en UI para "enviar credenciales por email" o usar reset de contraseña automático de Supabase. |

---

### MEDIUM

| # | Gap | Ubicación | Descripción | Fix sugerido |
|---|-----|-----------|-------------|-------------|
| M1 | Badge de aprobaciones en sidebar no filtra por zona | `src/components/layout/sidebar.tsx` | `navCounts.approvals` puede incluir propuestas de otras zonas para `delegado_zona` — depende de `getNavCounts`. Verificar. | Auditar `getNavCounts()` en ambos servicios para confirmar scoping. |
| M2 | Import PDF oculto en flujo | `src/components/events/roster-builder.tsx` | Requiere activar "Editar plantilla" primero para acceder al import PDF. | Exponer botón "Importar PDF" directamente en `RosterHeaderActions` (si `canEdit`). |
| M3 | `violationCount` no cuenta pesajeRoles | `src/components/events/roster-builder.tsx:107-122` | El recuento de violaciones en la cabecera omite slots de pesaje. | Incluir `session.pesajeRoles` en el bucle de cálculo. |
| M4 | KPIs del dashboard globales para `delegado_zona` (memoria) | `src/server/services/memory-service.ts:buildKpis` | En modo memoria los KPIs no filtran por zona. En Supabase sí. | Homogeneizar: pasar `user` a `buildKpis` en memoria-service. |
| M5 | `delegado_zona` al crear campeonato sin zona en form | `src/components/events/new-competition-form.tsx:29` | `defaultZona` es `user.zona` — si el usuario no tiene zona asignada, el campo queda vacío. La API luego retorna 403. | Añadir validación cliente: si `delegado_zona` y `user.zona` es undefined, mostrar error antes del submit. |
| M6 | Sin focus trap en `ScheduleImportDialog` | `src/components/events/schedule-import-dialog.tsx` | El tab puede salir del modal. | Implementar `focus-trap-react` o lógica manual de trap. |
| M7 | Sin confirmación al cancelar edición plantilla | `src/components/events/roster-template-editor.tsx` | Cambios no guardados se pierden sin aviso. | Añadir `confirm()` o estado `isDirty` antes de llamar `onCancel`. |
| M8 | Slot key cruda en diff de aprobaciones | `src/components/approvals/approvals-board.tsx:127-132` | Muestra `S1_central_0 → X`, no "Central sesión 1 → Nombre". | Decodificar slot key o enriquecer `ApprovalProposal` con metadata legible. |
| M9 | Comentario no obligatorio al rechazar ascenso | `src/app/api/v1/promotions/[id]/review/route.ts` | API no valida `comment` requerido. | Añadir validación: si `!approve && !comment`, retornar 400. |
| M10 | No hay botón eliminar árbitro en ficha `/referees/[id]` | `src/app/(dashboard)/referees/[id]/page.tsx` | Delete solo en listado. | Añadir botón con confirmación en la ficha (visible para `canDelete`). |
| M11 | Signup sin aviso de rol `solo_ver` | `src/app/sign-in/[[...sign-in]]/page.tsx` | Usuario crea cuenta sin saber que tendrá acceso limitado. | Añadir texto explicativo en el tab "Crear cuenta": "Tu cuenta tendrá acceso de solo lectura hasta que un administrador te asigne un rol." |
| M12 | Nombre en signup marcado como opcional por código pero no en UI | `src/app/sign-in/[[...sign-in]]/page.tsx:142-155` | Campo sin `required` en el input (no es required en código); placeholder parece obligatorio. | Añadir `required` al campo nombre en signup, o aclarar que es opcional. |

---

### LOW

| # | Gap | Ubicación | Descripción |
|---|-----|-----------|-------------|
| L1 | `/regulations` pública sin auth | `src/lib/supabase/middleware.ts:6-12` | Puede ser intencional pero inconsistente. Documentar. |
| L2 | `analytics/export` devuelve datos nacionales para `delegado_zona` | `src/app/api/v1/analytics/export/route.ts` | Sin filtro de zona en la exportación CSV. |
| L3 | "Sandbox de informes" como título de página | `src/app/(dashboard)/reports/page.tsx:44` | Término técnico inadecuado para producción. Usar "Informes arbitrales". |
| L4 | Sin reset de contraseña en UI | `src/app/sign-in/[[...sign-in]]/page.tsx` | No existe enlace "¿Olvidaste tu contraseña?". |
| L5 | Colapso sidebar no persiste | `src/components/layout/app-shell.tsx` | `useState(false)` — reset en cada recarga. Usar `localStorage`. |
| L6 | Columna "Zona" ausente en tabla de campeonatos | `src/components/events/events-table.tsx` | Dificulta la gestión para usuarios nacionales. |
| L7 | `apply` en ScheduleImportDialog usa ruta distinta | `src/components/events/schedule-import-dialog.tsx:86-98` | Usa `saveTemplate()` (PUT template) en vez de `importSchedule(..., apply=true)`. Funcionalmente equivalente pero inconsistente. |
| L8 | `created_at` ausente en tabla de usuarios | `src/components/admin/users-admin.tsx` | La API lo devuelve pero no se muestra. |
| L9 | Sin búsqueda/filtro en tabla de usuarios | `src/components/admin/users-admin.tsx` | Si hay muchos usuarios, la tabla crece sin control. |
| L10 | Sin paginación en lista de aprobaciones | `src/components/approvals/approvals-board.tsx` | Puede volverse larga en temporadas con muchos eventos. |
| L11 | `application/octet-stream` aceptado como PDF | `src/lib/schedule-parser/extract-pdf-text.ts:6-8` | Mime type genérico — podría aceptar no-PDFs disfrazados. |
| L12 | Error en `deletReferee` no muestra toast sino silencia | `src/components/referees/referees-directory.tsx:66-75` | Sin mensaje de error visible al fallar delete (solo `try/finally`). Añadir `setError(...)`. |
| L13 | `reviewError` en PromotionsBoard fuera del item | `src/components/promotions/promotions-board.tsx:119-121` | Error de revisión mostrado al final, no junto al item procesado. |
| L14 | Label inputs en RefereeEditForm sin `htmlFor` | `src/components/referees/referee-edit-form.tsx` | `<label>` sin `htmlFor` — el clic en el label no enfoca el input. |
| L15 | Grupos (`RosterGrupo`) en exportación TXT no verificada | `src/lib/roster-export.ts` | No se ha auditado si los grupos se exportan correctamente. |
| L16 | Constructor Tarima en sidebar enlaza a `/events`, no al builder | `src/components/layout/sidebar.tsx:57-61` | El label puede inducir a error (va al listado, no a un builder directo). |
| L17 | Página `/login` existe como redirect pero sin contenido propio | `src/lib/supabase/middleware.ts:9` | `/login` está en PUBLIC_PATHS pero no tiene página Next.js. Retornará 404. |

---

## 5. Checks adicionales

### 5.1 API.md vs implementación — drift

| Endpoint en docs | Estado en código | Nota |
|-----------------|-----------------|------|
| `POST /auth/login` | Devuelve 410 "Gone" | Doc dice "Login email/contraseña" — contradice implementación (Supabase Auth lo gestiona en cliente). **Drift en docs.** |
| `POST /auth/signout` (alias) | Existe `src/app/api/v1/auth/signout/route.ts` | No implementado en `api` client. Funcional. |
| `DELETE /reports/:id` | Solo `canAdminJudges` | Docs dicen "no `solo_ver` (admin para borrado duro)" — docs imprecisos. Código más restrictivo. |
| `PATCH /admin/users/:id` | Soporta `role`, `zona`, `activo` | Docs dicen solo `{ activo }`. **Docs incompletos.** |

### 5.2 Validaciones en `src/lib/validations.ts` vs endpoints

| Schema | Endpoint que lo usa |
|--------|---------------------|
| `assignRefereeSchema` | `POST .../roster/assign` ✓ |
| `clearSlotSchema` | `POST .../roster/clear` ✓ |
| `rosterTemplateSchema` | No usado — `PUT .../roster/template` valida solo `Array.isArray && length > 0`, no usa el schema Zod. **Gap menor.** |
| (ninguno para promotions, competitions, referees) | Validación manual en handlers. Consistente pero verboso. |

### 5.3 Scoping zona `delegado_zona` — verificación completa

| Recurso | GET filtrado | POST scoped | PATCH scoped | DELETE scoped |
|---------|:-----------:|:-----------:|:------------:|:-------------:|
| Competiciones | ✓ | ✓ | ✓ | ✓ |
| Roster/assign | ✓ (vía comp zona) | ✓ | ✓ | ✓ |
| Árbitros | ✓ | ❌ **H4** | ❌ **H5** | ❌ (solo bloquea `solo_ver`) |
| Aprobaciones | ✓ | N/A | ✓ | N/A |
| Ascensos | ✓ | ✓ | N/A | N/A |
| Exámenes | ❌ **H6** | ❌ | ❌ | N/A (solo admin) |
| Informes | ❌ **H6** | ❌ | N/A (no existe) | N/A (solo admin) |
| Analytics | ❌ M4/M12 | N/A | N/A | N/A |

### 5.4 Import PDF — límites y validación

- Límite: 5 MB (`MAX_PDF_BYTES = 5 * 1024 * 1024`) ✓ — validado en cliente y servidor
- MIME: `application/pdf`, `application/x-pdf`, `application/octet-stream` — el último es genérico (**L11**)
- Runtime: `nodejs`, `maxDuration: 30s` ✓
- Validación de sesiones vacías: retorna 422 si `template.length === 0` ✓
- Preview sin `apply`: seguro, no persiste ✓

### 5.5 `dataService` switch — diferencias visibles

El switch `isSupabaseConfigured() ? supabaseDataService : memoryDataService` produce diferencias:

| Aspecto | Memoria | Supabase |
|---------|---------|---------|
| KPIs dashboard zona | ❌ Globales | ✓ Filtrados (si implementation lo hace) |
| Datos persisten | ❌ Reset en restart | ✓ |
| `health_snapshots` | Tabla en array local | Tabla DB (degrada sin error si no existe) |
| Actividad / historial | Array en memoria | Tablas `activity_log`, `roster_history` |

**Gap:** En prod con Supabase configurado, si `health_snapshots` no existe en la BD, el sistema degrada silenciosamente (`if (error) return`). No es visible al usuario pero los `delta` del health gauge nunca se calculan. (**LOW**)

### 5.6 `delegado_jueces` paridad con `super_admin`

Revisión de todas las helpers:

| Helper | `delegado_jueces` = `super_admin`? |
|--------|:----------------------------------:|
| `canEditRoster` | ✓ |
| `canManageCompetitions` (alias) | ✓ |
| `canApprove` | ✓ |
| `canManageUsers` | ✓ (API) / ❌ UI sidebar |
| `canManageJudges` | ✓ (role !== solo_ver — también delegado_zona tiene yes) |
| `canAdminJudges` | ✓ |
| `canReviewPromotions` | ✓ |

**Conclusión:** Las helpers son correctas. La brecha está en la UI (sidebar, botones de eventos) que no usa las helpers sino comparaciones directas de rol.

### 5.7 Signup — flujo primer usuario

`ensureProfile` en `session.ts:26-29`: el primer usuario en registrarse recibe `super_admin`. Los subsiguientes reciben `solo_ver`. Esto está documentado en el código pero no en la UI. Correcto para el bootstrapping inicial. Si se elimina el primer usuario, el siguiente en registrarse también sería `super_admin` — potencial issue si se usa en producción con usuarios reales.

---

## 6. Próximo Hito — Top 10 Fixes Rankeados por Impacto/Esfuerzo

| Rank | Fix | Impacto | Esfuerzo | Referencia |
|------|-----|---------|---------|-----------|
| 1 | **Sidebar: mostrar "Usuarios" a `delegado_jueces`** | Alto — bloquea funcionalidad existente | Mínimo (1 línea) | H1 |
| 2 | **Añadir botón "Nuevo campeonato" y Delete para `delegado_jueces` en eventos** | Alto — funcionalidad no accesible | Bajo (2-3 líneas) | H2, H3 |
| 3 | **Scoping zona en `POST /referees` y `PATCH /referees/:id`** | Alto — datos incorrectos por zona | Bajo (5-10 líneas cada uno) | H4, H5 |
| 4 | **Scoping zona en `GET /exams` y `GET /reports`** | Alto — privacidad de datos por zona | Medio (refactor servicios) | H6 |
| 5 | **Implementar `PATCH /reports/:id`** | Alto — funcionalidad rota | Medio (clonar `/exams/:id` PATCH) | H7 |
| 6 | **Corregir badge de estado en AprovalsBoard** | Alto — dato incorrecto visible | Mínimo (1-2 líneas) | H8 |
| 7 | **Añadir editor de rol en tabla de usuarios + notificación de credenciales** | Alto — gestión de usuarios incompleta | Medio (nuevo modal + API call) | H9, H10 |
| 8 | **Añadir comentario obligatorio al rechazar ascenso** | Medio — consistencia con aprobaciones | Mínimo (validación API + UI) | M9 |
| 9 | **Corregir `violationCount` para incluir pesajeRoles** | Medio — información incorrecta | Mínimo (ampliar bucle) | M3 |
| 10 | **Aviso en signup de rol `solo_ver` + campo nombre required** | Medio — UX confusa para nuevos usuarios | Mínimo (texto + atributo HTML) | M11, M12 |

---

*Fin del informe — generado en base a inspección estática del código fuente. No se ha ejecutado la aplicación.*

---

## 7. Addendum (2026-05-17) — Import/Export y tarima

Ola posterior al informe inicial. Detalle en `docs/audit/05-verification.md` y backlog `docs/AUDIT-BACKLOG.md` (IE-1..IE-5 cerrados).

| Área | Entregado |
|------|-----------|
| UI compartida | `src/lib/import-export-ui.ts`, `src/components/data-transfer/*` |
| Import calendario / horario / jueces | Wizards unificados; horario con confirmación de reemplazo; jueces con `apply=false\|true` |
| Export roster / analytics | `ExportPreviewDialog` + descarga blob |
| Tarima UX | Stepper, ayuda, revisión, rosters abiertos, guards de ruta |
| Tests | 142 Vitest (`npm test`); build OK |

Pendiente de la ola: hub "Datos AEP" en eventos (P1 plan), E2E Playwright, tests HTTP dedicados para rutas calendar/template import.
