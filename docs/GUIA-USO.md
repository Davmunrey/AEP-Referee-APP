# Guía de uso — AEP Tarima

Manual operativo para delegados, comité de jueces y consulta. La plataforma es la herramienta interna de la **Asociación Española de Powerlifting (AEP)** para diseñar plantillas de jueces, asignar jueces y tramitar aprobaciones en campeonatos **AEP-1**, **AEP-2** y **AEP-3**.

---

## 1. Identidad y branding

| Elemento | Valor |
|----------|--------|
| **Nombre del producto** | AEP Tarima |
| **Organización** | Asociación Española de Powerlifting (AEP) |
| **Color primario** | `#e63b2e` (rojo AEP) |
| **Tipografía** | Inter (UI) |
| **Fondo** | Gradiente suave `app-mesh` sobre neutros cálidos |

### Etiquetas de organización en el sidebar

Según tu rol, verás:

| Rol | Cabecera en sidebar |
|-----|---------------------|
| `super_admin` | **AEP Nacional** |
| `delegado_jueces` | **AEP · Comité de Jueces** |
| `delegado_zona` | **AEP Regional · {código zona}** (ej. MAD, CAT) |
| `solo_ver` | **AEP Consulta** |

### Convenciones visuales

- **Estados de campeonato:** Completo (verde), Incompleto (ámbar), Crítico (rojo), Borrador (gris).
- **Niveles de jueces:** badges de color por Regional / Nacional / IPF Cat. 2 / IPF Cat. 1.
- **Tarima:** paneles `glass-panel-soft` en cabecera; slots vacíos en rojo suave; alertas normativas en ámbar.

Más detalle técnico de tokens: [`DESIGN.md`](./DESIGN.md).

---

## 2. Acceso a la plataforma

1. Abre [https://aep-tarima.vercel.app/](https://aep-tarima.vercel.app/) (prod) o `http://localhost:3000` (dev).
2. Entra en **Iniciar sesión** (`/sign-in`).
3. Usa **email y contraseña** (no hay login social).
4. Si es tu primera cuenta en el proyecto, recibirás rol **Super Admin** (`super_admin`).
5. Las cuentas siguientes entran como **Solo lectura** hasta que un administrador las promocione en **Usuarios**.

Si tu cuenta está **desactivada** (`activo = false`), no accederás al panel.

Para cerrar sesión: botón **Cerrar sesión** en el sidebar.

---

## 3. Roles y qué puedes hacer

| Rol | Campeonatos y tarima | Aprobar envíos | Usuarios | Jueces / exámenes / informes |
|-----|----------------------|----------------|----------|------------------------------|
| **Super Admin** | Toda la federación | Sí | Sí | Todo; puede eliminar |
| **Delegado de Jueces** | Toda la federación (igual que Super Admin en tarima) | Sí | Sí | Todo; puede eliminar |
| **Delegado de Zona** | Solo su zona | No | No | Crear/editar en su ámbito |
| **Solo lectura** | Solo ver | No | No | Solo consulta |

### Resumen por tarea

- **Crear campeonato** — Super Admin, Delegado de Jueces, Delegado de Zona (en su zona).
- **Editar plantilla de sesiones** — quien pueda editar la tarima de ese evento.
- **Asignar jueces y marcar flags** — mismo criterio.
- **Enviar tarima a aprobación** — Delegado de Zona (o nacional en cualquier zona).
- **Aprobar / rechazar** — Super Admin o Delegado de Jueces.
- **Gestionar usuarios** (`/admin/users`) — Super Admin o Delegado de Jueces.

---

## 4. Dashboard (`/`)

Pantalla de inicio tras el login.

- **KPIs** — jueces activos, eventos próximos, plazas sin cubrir, aprobaciones pendientes.
- **Salud operativa** — índice 0–100 con desglose de factores (cobertura, urgencia, cola de aprobaciones, etc.).
- **Recomendaciones** — acciones sugeridas con enlace directo (ej. ir a un campeonato crítico).
- **Previsión de cobertura** — barras por evento y días hasta la fecha.
- **Panel en vivo** — refresco automático cada 60 s (pausable).

Desde el hero puedes **exportar CSV** de temporada o ir a **Nuevo campeonato**.

---

## 5. Campeonatos (`/events`)

### 5.1 Listado

Filtra por tipo **AEP-1 / AEP-2 / AEP-3**, estado y texto libre. Cada fila muestra cobertura, zona y estado. Pulsa una fila para abrir la **tarima**.

### 5.1.bis Importar Calendario AEP

Botón **«Importar calendario AEP»** (Super Admin / Delegado de Jueces). Sube el PDF anual de AEP (`Calendario_AEP_2026.pdf` o similar):

1. La plataforma detecta automáticamente todas las entradas y filtra las de **ámbito español** (AEP-1 / AEP-2 / AEP-3). Las europeas (EPF) y mundiales (IPF) se descartan.
2. Vista previa muestra: año, total detectado, españolas elegibles, duplicadas (ya existentes), nuevas a crear y avisos de parseo.
3. Al **Aplicar**, se crean las nuevas competiciones con tipo, fecha, sede y zona (deducida de la provincia).
4. Las entradas marcadas «pendiente» en el PDF se omiten — créalas a mano cuando haya fecha confirmada.

### 5.1.ter Eventos finalizados

Cuando `fechaFin < hoy`, el campeonato pasa a **modo solo lectura**: muestra badge **«Cerrado»** en la cabecera y desaparecen los botones de editar plantilla, asignar, flags, borrador y enviar a aprobación. La API responde **423 Locked** ante cualquier intento de modificar.

### 5.2 Crear campeonato (`/events/new`)

Completa:

- Nombre, sede, fechas inicio/fin (fin ≥ inicio).
- **Tipo** (AEP-1, AEP-2 o AEP-3) — define el preset de plantilla por defecto.
- **Zona** federativa.
- Sesiones / plazas requeridas según el formulario.

Al guardar, el evento queda en estado **Borrador** o según cobertura inicial.

### 5.3 Plantilla por evento

Cada campeonato tiene su propia estructura de sesiones guardada en base de datos (`competitions.template`):

- Si **no hay plantilla guardada**, la app muestra el **preset oficial** del tipo (AEP-1, AEP-2 o AEP-3).
- Si **guardas una plantilla personalizada**, esa estructura queda fijada para el evento.

**Presets oficiales (resumen):**

| Tipo | Sesiones típicas | Roles destacados |
|------|------------------|------------------|
| **AEP-1** | 4 sesiones (Viernes–Sábado) | Central, lateral, ordenador, speaker/mesa, control, jurado (×3), pesaje |
| **AEP-2** | 5 sesiones (Sábado–Domingo) | + Liftingcast/OpenLifter, mesa |
| **AEP-3** | 3 sesiones (Sábado) | Formato concentrado; ordenador y speaker |

### 5.4 Editor de plantilla

En la página del campeonato (`/events/[id]`), si tienes permiso de edición:

1. Activa **Editar plantilla** (modo edición).
2. Usa el **editor de plantilla** para:
   - Añadir / quitar **sesiones** (S1, S2…).
   - Cambiar **día**, **nombre**, **categorías** (género y pesos).
   - Ajustar **horarios** de competición y pesaje.
   - Configurar **grupos** dentro de cada sesión (Grupo 1, Grupo 2…) con sus categorías y nº de levantadores.
   - Definir **roles** de pista y de pesaje (nombre, clave, número de plazas).
3. **Guardar plantilla** — persiste en el servidor. Las asignaciones en slots que ya no existan se eliminan automáticamente.

> Tras cambiar la plantilla, revisa las asignaciones: los `slotKey` antiguos desaparecen del mapa.

### 5.5 Importar horario PDF

En el editor de plantilla, botón **Importar PDF**:

1. Selecciona un PDF de horario AEP oficial. Nombres tipo `20260517_AEP1_Horario-Junior_rev3.pdf` se reconocen automáticamente (tipo y fecha).
2. La plataforma extrae **sesiones**, **grupos**, **horarios** (Pesaje / Inicio / Fin) y los **levantadores** por grupo.
3. Revisa la **vista previa**: cabecera (campeonato, sede, fechas), número de sesiones detectadas y avisos de parseo.
4. Confirma con **Aplicar plantilla** — sustituye la plantilla actual y purga asignaciones huérfanas.

Roles de jueces por defecto según el tipo (AEP-1: con jurado; AEP-2: con Liftingcast; AEP-3: cuadrante regional). Edita los roles tras importar si la sesión necesita un perfil distinto.

Límite de archivo: **5 MB**. El PDF debe contener texto seleccionable (no escaneo OCR).

---

## 6. Constructor de tarima (`/events/[id]`)

### 6.1 Asignar jueces

- **Arrastrar** un juez del panel lateral a un slot, o **clic** en slot + selección.
- Solo aparecen jueces **activos** y disponibles (`disp: true`).
- Un juez no puede ocupar dos slots a la vez: la asignación anterior se libera.
- Cada cambio se guarda con `POST .../roster/assign`.

**Formato de slot:** `{sesion}_{roleKey}_{índice}` — ejemplo: `S1_central_0`, `S1_jurado_2`.

### 6.2 Validación normativa

La tarima compara el **nivel del juez** con la **matriz AEP** (`/regulations`). Si el nivel es insuficiente para el rol y tipo de campeonato, verás una **alerta visual** (no bloquea el guardado, pero debes corregir antes del envío oficial).

### 6.3 Flags de slot (`*` y `↑↓`)

Con un juez ya asignado en el slot:

| Flag | Símbolo en exportación | Significado operativo |
|------|------------------------|------------------------|
| **Compartido** | `*` | Slot compartido según criterio AEP |
| **Intercambio** | `↑↓` | Posibilidad de intercambio entre jueces |

Actívalos desde la barra de herramientas del constructor (modo edición). Requieren juez asignado. Se guardan en `roster_assignments.flags` y aparecen en el **TXT exportado** junto al nombre.

### 6.4 Borrador, historial y exportación

- **Guardar borrador** — snapshot en historial sin enviar a aprobación.
- **Historial** — panel con cambios recientes (quién, cuándo, qué slot).
- **Exportar TXT** — acta de plantilla con estructura oficial AEP (días, sesiones, categorías, horarios, nombres y flags).

### 6.5 Enviar a aprobación

1. Revisa cobertura (barra de progreso en cabecera).
2. Si faltan plazas, el sistema puede pedir **confirmación**.
3. **Enviar a aprobación** crea una propuesta en cola **pendiente** para Super Admin / Delegado de Jueces.

En modo **solo lectura** no verás controles de edición.

---

## 7. Aprobaciones (`/approvals`)

Para **Super Admin** y **Delegado de Jueces**:

1. Abre la cola de propuestas **pendientes**.
2. Revisa el **diff** (slot → juez anterior / nuevo).
3. **Aprobar** — actualiza el estado del campeonato.
4. **Rechazar** — obligatorio escribir **comentario** para el delegado regional.

Los **Delegados de Zona** ven el estado de sus envíos pero no aprueban.

---

## 8. Directorio de jueces (`/referees`)

### 8.1 Importar registro maestro (Excel)

**Super Admin** y **Delegado de Jueces**: botón **«Importar registro»** en el directorio.

1. Sube `Copia de Control jueces.xlsx` (hojas `Datos`, `Arbitrajes2026`, `Campeonatos26`).
2. Revisa la vista previa (jueces nuevos/actualizados, campeonatos detectados, avisos).
3. **Aplicar** hace upsert por `excel_id` en Supabase.

CLI equivalente: `npm run db:import-judges -- "/ruta/al/archivo.xlsx"`.

Para eliminar jueces demo antiguos (`j001`–`j016`): `npm run db:cleanup-demo`.

### 8.2 Consulta y gestión

- Buscar por nombre, filtrar por **zona**, **nivel**, **estado**.
- **Ficha** (`/referees/[id]`): datos, trayectoria, exámenes, informes, edición, solicitud de ascenso y botón **Eliminar juez** (Super Admin / Delegado de Jueces).
- **Alta** de nuevo juez (según permisos). **Delegados de Zona** solo pueden crear/editar jueces de su propia zona.
- **Baja** — Super Admin / Delegado de Jueces.

---

## 9. Exámenes (`/exams`) e informes (`/reports`)

Los **Delegados de Zona** solo ven los exámenes e informes de jueces de su propia zona.

### Exámenes
Tipos: Teórico, Práctico, Reglamento IPF, Recertificación. Registra fecha, examinador, puntuación y resultado (Aprobado / Suspenso / Pendiente). Calificación rápida en pendientes.

### Informes
Tipos: Desempeño, Incidencia, Evaluación, Auto-informe. Texto libre, evento opcional, URL de adjunto. **Editables** desde la propia tarjeta (`Editar` → titulo / tipo / evento / contenido / adjunto). También accesibles desde la ficha del juez.

---

## 10. Ascensos (`/promotions`)

Flujo **Regional → Nacional → IPF Cat. 2 → IPF Cat. 1**:

1. Delegado (zona o nacional) solicita ascenso con motivo.
2. Super Admin / Delegado de Jueces **aprueba o rechaza**. Al **rechazar**, el comentario es **obligatorio**.
3. El nivel destino debe ser **superior** al actual.

KPIs por estado (Pendientes / Aprobadas / Rechazadas / Esta semana) en la cabecera del tablero.

---

## 11. Estadísticas (`/analytics`)

Cobertura por zona, jueces más activos, eventos críticos y **exportación CSV** de la temporada.

---

## 12. Normativa (`/regulations`)

Tres pestañas según la **Guía AEP 2026** (diciembre 2025) y normativa técnica:

- **Reglamento IPF** — 11 capítulos con búsqueda en texto completo.
- **Guía AEP 2026** — zonas geográficas oficiales, estructura AEP-1/2/3, cuotas de licencias e inscripciones, marcas mínimas regional/Open y requisitos de licencia básica para jueces.
- **Matriz jueces** — nivel mínimo por rol y tipo de campeonato (validación en tarima).

Referencia ampliada: [`GUIA-AEP-2026.md`](./GUIA-AEP-2026.md).

Úsala al montar la tarima para evitar incidencias en competición.

---

## 13. Usuarios (`/admin/users`)

Solo **Super Admin** y **Delegado de Jueces** (la entrada del sidebar es visible solo para ambos).

- **Búsqueda** por nombre o email + filtros por rol, zona y estado activo/inactivo.
- **Crear usuario** (email, contraseña temporal, nombre, rol, zona). Tras crear, aparece un modal con las credenciales generadas y un botón **Copiar credenciales** — guárdalas o envíalas al usuario.
- **Editar** rol, zona, nombre y etiqueta (`rolLabel`) de un usuario existente desde el botón Editar de cada fila. El servidor impide auto-degradarse o auto-eliminarse.
- **Activar / desactivar** o **eliminar** cuentas.
- Columna **Alta** muestra cuándo se creó cada cuenta.

El acceso es **solo por cuentas creadas** por administración (no hay alta pública en `/sign-in`).

### ¿Olvidaste tu contraseña?
En `/sign-in` (modo iniciar sesión), enlace **«¿Olvidaste tu contraseña?»** despliega un campo de email y envía un enlace de reset vía Supabase (`resetPasswordForEmail`).

---

## 14. Glosario rápido

| Término | Significado |
|---------|-------------|
| **Tarima** | Plantilla de jueces completa de un campeonato |
| **Plantilla / template** | Estructura de sesiones y roles (sin nombres de jueces) |
| **Asignación** | Juez concreto en un `slotKey` |
| **slotKey** | Identificador único de plaza (ej. `S2_lateral_1`) |
| **Preset** | Plantilla tipo AEP-1/2/3 por defecto |
| **Propuesta** | Envío de tarima a aprobación nacional |
| **Zona** | Código federativo (MAD, CAT, …) |

---

## 15. Soporte técnico

| Tema | Documento |
|------|-----------|
| API REST | [`API.md`](./API.md) |
| Base de datos y migraciones | [`DATABASE.md`](./DATABASE.md) |
| Despliegue | [`DEPLOY.md`](./DEPLOY.md) |
| Arquitectura | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |

**Contacto interno:** administrador de la instancia Supabase / responsable IT de AEP.

---

*AEP Tarima — Asociación Española de Powerlifting. Uso exclusivo federativo.*
