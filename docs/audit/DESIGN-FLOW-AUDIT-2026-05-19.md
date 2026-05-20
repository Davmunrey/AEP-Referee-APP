# Auditoria UI/UX y dominio - 2026-05-19

Alcance: repo `origin/main` sincronizado, revision estatica de rutas/componentes/modelo y validacion local con `npm run build` + `npm run test`.

## Veredicto

La app ya esta bastante mas coherente que al inicio, pero aun mezcla tres capas:

- Gestion operativa real: campeonatos, tarima, jueces, aprobaciones.
- Lecturas agregadas importadas de Excel: contadores por rol/tipo AEP.
- UI de dashboard generico: cards grandes, labels con mucho tracking, redondeos altos y paneles demasiado blandos.

Eso genera sensacion de saturacion y, peor, algunas metricas parecen mas exactas de lo que son.

## P0 - Datos que pueden inducir a error

### 1. Perfil de juez: "Competiciones 2026" no son competiciones reales

Origen:

- `src/lib/judges-registry/parse-arbitrajes-2026.ts`
- `src/lib/judges-registry/arbitraje-stats.ts`
- `src/components/referees/referee-arbitraje-panel.tsx`
- `src/app/(dashboard)/referees/[id]/page.tsx`

Problema:

`eventos` sale de `arbitrajeStats.total`, y `total` suma posiciones/roles de la hoja `Arbitrajes2026`. Si un juez hizo Central + Pesaje, cuenta 2. Eso no equivale a campeonatos.

Riesgo:

El usuario interpreta "Competiciones 2026" como campeonatos arbitrados. Ahora puede estar viendo plazas/puestos, no campeonatos.

Decision recomendada:

- Cambiar label `Competiciones 2026` -> `Plazas arbitradas 2026` si se mantiene Excel actual.
- Crear historial real por campeonato desde `roster_assignments + competitions`.
- Mostrar perfil asi:
  - `Campeonatos asignados`: numero unico de competiciones reales.
  - `Plazas asignadas`: numero de slots reales.
  - `Resumen Excel 2026`: desglose por AEP/rol, claramente secundario.

No conviene fingir clasificacion por competicion con la hoja actual, porque no contiene el enlace juez -> campeonato.

### 2. DB/migraciones historicas aun contienen `event_*`

Origen:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/016_competition_column_rename.sql`

Estado:

Runtime ya usa `competition_id` / `competition_name`, pero la historia de migraciones conserva el rename.

Decision recomendada:

- Si la DB de prod ya aplico migraciones: mantener `016`, no reescribir historia.
- Si el proyecto se puede resetear desde cero: compactar migraciones y eliminar `event_*` del schema base.

## P1 - Tarima: flujo aun no es suficientemente de trabajo

Origen:

- `src/components/competitions/roster-builder.tsx`
- `src/components/competitions/roster-template-editor.tsx`

Problema:

La pantalla intenta resolver:

- editar plantilla
- ver fin de semana
- seleccionar sesion
- buscar juez
- asignar huecos
- revisar flags
- enviar aprobacion

Todo en una sola superficie. Aunque ya esta mas compacta, aun no funciona como herramienta de rellenado rapido.

Decision recomendada:

- Separar mentalmente en dos vistas:
  - `Planificacion`: sesiones, grupos, categorias, horarios, plazas.
  - `Asignacion`: matriz densa por dia/sesion/rol + columna de jueces.
- En asignacion, usar matriz tipo hoja:
  - columnas: sesiones.
  - filas: roles.
  - celdas: huecos.
  - banda superior: dias completos.
- Mantener vista detalle solo como panel lateral, no como layout principal.

Esto acerca la tarima al modelo Excel que el usuario ya entiende.

## P1 - Clasificaciones por competicion, no por posiciones

Origen:

- `src/components/referees/referee-arbitraje-panel.tsx`
- `src/lib/judges-registry/arbitraje-stats.ts`

Problema:

El panel se llama `Recuento de posiciones 2026` y agrupa por AEP-1/AEP-2/AEP-3 + rol. Eso sirve para carga de trabajo, pero no para historial de competiciones.

Decision recomendada:

- Renombrar panel a `Carga por rol 2026`.
- Anadir panel nuevo `Historial de campeonatos` con datos reales de tarima.
- Ordenar por fecha, no por posicion.
- En cada fila: campeonato, fecha, rol(es), flags, estado de aprobacion.

## P1 - Exceso de lenguaje visual blando

Origen:

- `src/components/ui/card.tsx`
- `src/styles/tokens.css`
- `src/app/globals.css`
- multiples componentes con `rounded-xl`, `rounded-2xl`, `tracking-widest`

Problema:

La app es operativa, pero el lenguaje visual aun parece dashboard SaaS generico:

- demasiadas cards
- radios grandes
- sombras en hover
- tracking alto en labels
- paneles dentro de paneles
- muchas superficies suaves con poca jerarquia

Decision recomendada:

- Card radius global: bajar de `rounded-2xl` a `rounded-lg`.
- Botones/inputs: bajar de `rounded-xl` a `rounded-md/lg`.
- Quitar `hover:-translate-y-px` en cards.
- Reducir tracking global de labels a `tracking-wide` o 0.
- Usar mas tablas y bandas, menos cards para datos densos.

## P2 - Dashboard: metricas todavia suenan abstractas

Origen:

- `src/lib/dashboard-intelligence.ts`
- `src/components/dashboard/health-gauge.tsx`
- `src/components/dashboard/insights-panel.tsx`

Problema:

El indice de salud mezcla factores utiles, pero algunos textos siguen diciendo `eventos` y no explican formula visible.

Decision recomendada:

- Renombrar todo `evento` visible -> `campeonato`.
- Mostrar formula corta junto al indice:
  - `cobertura + campeonatos criticos + plazas urgentes + aprobaciones`.
- Si una metrica no mueve decision, quitarla del dashboard.

## P2 - Informes: campo `evento` sigue vivo como contexto libre

Origen:

- `src/components/judge/reports-manager.tsx`
- `src/lib/types.ts`
- `supabase/migrations/005_judge_management.sql`

Problema:

Aunque la UI principal ya distingue `juez` vs `competicion`, el modelo conserva `evento?: string` como texto libre para informes de juez.

Decision recomendada:

- Renombrar a `competitionContext`.
- Mejor aun: si se asocia a campeonato, usar `competition_id`; si no, no pedir contexto.

## P2 - Competitions table: IDs tecnicos visibles

Origen:

- `src/components/competitions/competitions-table.tsx`

Problema:

La fila muestra `event.id` / `evt-001` junto a sede. Eso arrastra naming viejo y aporta poco al usuario operativo.

Decision recomendada:

- Ocultar ID tecnico por defecto.
- Mostrarlo solo en tooltip/debug/admin.
- Si se muestra, usar `COMP-001` o id real de calendario AEP.

## P2 - Analytics: tabla correcta, lectura mejorable

Origen:

- `src/components/analytics/analytics-dashboard.tsx`

Problema:

`Jueces` en actividad por zona muestra `asignados/activos`, pero el header solo dice `Jueces`. Puede parecer ratio arbitrario.

Decision recomendada:

- Header: `Jueces asignados / activos`.
- Anadir columna `Cobertura plazas` si hace falta, con formula simple.
- No volver a `% cobertura por zona` si no esta basado en plazas reales.

## P3 - Sistema visual base

Mejoras recomendadas:

- Densidad 14":
  - mantener `PageShell max-w-[1360px]`, pero bajar `space-y-4` a `space-y-3` en vistas con tablas.
  - topbar `h-12` OK.
  - sidebar OK, pero item activo tiene demasiado peso visual.
- Tipografia:
  - conservar DM Sans + IBM Plex Mono.
  - quitar `tracking-widest` en labels de formularios y tablas.
- Color:
  - paleta es coherente, pero neutros son muy calidos. Cuidado con efecto beige en toda la app.
  - mantener rojo AEP solo para accion/estado, no para decorar cada bloque.
- Cards:
  - usar cards para item repetido o modal.
  - evitar secciones enteras como card cuando son tablas operativas.

## Orden de ejecucion recomendado

1. Corregir perfil de juez: separar `plazas arbitradas` vs `campeonatos reales`.
2. Redisenar tarima `Asignacion` como matriz densa por dia/sesion/rol.
3. Normalizar design tokens: radios, tracking, hover de cards.
4. Limpiar copy restante `evento` en runtime y comentarios visibles.
5. Hacer compactacion opcional de migraciones si se decide reset DB.
6. Pasar QA visual en 14" y movil.

## Validacion realizada

- `git fetch origin --prune`: OK.
- `main` sincronizado con `origin/main`.
- `npm run build`: OK.
- `npm run test`: OK tras actualizar tests que seguian usando `eventId/events`.

