# Milestone Summary — v1.4 Production Hardening

**Completed:** 2025-06-28 · **Branch:** `main` · **Tests:** 298

Auditoría completa, privacidad zonal, roster robusto, auth endurecido, soporte multi-temporada y documentación actualizada. Ver `docs/AUDIT.md` y `README.md`.

---

# Milestone Summary — v1.1 AEP Referee APP Full Feature Upgrade

**Completed:** 2026-05-27 · **Commits:** 9f951bb → 4c0cbb1 · **Phases:** 6/6 · **Requirements:** 23/23

---

## 1. Overview

AEP Referee APP es la herramienta interna de gestión de jueces de la Asociación Española de Powerlifting. v1.1 añadió capacidades operativas completas que antes requerían comunicación manual o trabajo fuera del sistema.

**Problema resuelto:** El sistema anterior no sabía si un juez asignado era de la zona correcta, no permitía crear horarios manualmente, importaba solo 3 campos del Excel maestro, y no tenía forma de registrar quién había confirmado disponibilidad para una competición específica.

**Resultado:** Los delegados ahora pueden gestionar el ciclo completo desde un solo sitio — solicitar disponibilidades, importar el registro completo de jueces, construir tarimas con o sin PDF, asignar jueces cross-zona con trazabilidad, y ver el estado de cobertura nacional en el dashboard.

**Stack:** Next.js 15 App Router · TypeScript · Supabase (Postgres + Auth + RLS) · Tailwind CSS · Radix UI · Vercel

---

## 2. Architecture Changes

### New DB Tables (Migrations 017–019)

| Migration | Tabla | Propósito |
|-----------|-------|-----------|
| 017 | `roster_assignments.cross_zone` | Columna boolean — marca asignaciones fuera de zona |
| 018 | *(reemplazada por 019)* | Disponibilidad por rango de fechas — descartada |
| 019 | `competition_availability` | Jueces confirmados por WhatsApp para competición específica |

**competition_availability schema:**
```sql
competition_id UUID → competitions(id) CASCADE
referee_id     UUID → referees(id) CASCADE
UNIQUE(competition_id, referee_id)
```

### New API Routes

| Route | Método | Función |
|-------|--------|---------|
| `/api/v1/competitions/[id]/availability` | GET | Lista IDs confirmados |
| `/api/v1/competitions/[id]/availability` | POST | Confirma juez |
| `/api/v1/competitions/[id]/availability/[refereeId]` | DELETE | Quita confirmación |

### Key Service Methods Added

- `getCompetitionAvailability(competitionId)` → `string[]`
- `addCompetitionAvailability(competitionId, refereeId, actor)`
- `removeCompetitionAvailability(competitionId, refereeId)`
- `getAnalytics` extendido con `crossZoneByZone` + `crossZoneSummary`
- `buildKpis` extendido con 5ª KPI "Cobertura Nacional"

---

## 3. Phases Completed

### Phase 1 — Cross-Zone DB + API
**Lo que hace:** Cuando un delegado asigna un juez de otra zona, la API detecta el mismatch automáticamente (server-side) y persiste `cross_zone = true` en `roster_assignments`.

**Decisión clave:** Detección server-side únicamente (`referee.zona !== competition.zona`). El cliente no puede enviar `cross_zone: true` manualmente — evita spoofing.

**Archivos clave:**
- `supabase/migrations/017_cross_zone_assignments.sql`
- `src/app/api/v1/competitions/[id]/roster/assign/route.ts`

---

### Phase 2 — Cross-Zone UI
**Lo que hace:** El roster builder muestra jueces de todas las zonas cuando se selecciona "Todas las zonas". Los jueces de otra zona llevan badge naranja `⟳ ZONA`. Los slots asignados cross-zona quedan marcados visualmente en la tarima.

**Archivos clave:**
- `src/components/competitions/roster-builder.tsx` — filtro "Todas las zonas", badge naranja, `CrossZoneMap` state

---

### Phase 3 — Schedule Builder
**Lo que hace:** El editor de plantilla (`RosterTemplateEditor`, 627 líneas) permite crear y editar sesiones manualmente sin importar PDF. Cada sesión tiene nombre, día, horario pesaje, horario competición, roles y pesajeRoles. El import de PDF AEP fue endurecido para reconocer abreviaturas de días de la semana, guiones largos (en-dash), y eventos multi-día.

**Cambios PDF parser:**
- `DAY_RE` — acepta `Lun.`, `Mié`, `Sáb` + variantes sin tilde
- `SCHEDULE_RE` — acepta guión largo + colón opcional
- `normalizeRange` — normaliza separadores a `" - "`

**Archivos clave:**
- `src/components/competitions/roster-template-editor.tsx`
- `src/lib/schedule-parser/parse-aep-horario-text.ts`

---

### Phase 4 — Import Improvements
**Lo que hace:** La importación del Excel maestro de jueces mapea ahora 6 campos en el preview (antes 3): Nombre, Nivel, Zona, Localidad, Género, Teléfono. Los campos `antiguedad` y `notas` también se importan aunque no aparecen en la columna preview. Los warnings del parser se propagan hasta el diálogo de confirmación.

**Archivos clave:**
- `src/lib/judges-registry/import-preview.ts`
- `src/components/referees/judges-registry-import.tsx` — tabla de 6 columnas, dialog ampliado a `max-w-3xl`

---

### Phase 5 — Judge Availability (per-competición)
**Lo que hace:** Antes de montar la tarima, el delegado abre el dialog "Disponibilidad" dentro del roster builder, marca qué jueces confirmaron vía WhatsApp para esa competición, y el selector puede filtrar a "Solo confirmados". Los confirmados llevan badge verde `✓` en su tarjeta.

**Flujo real:**
1. WhatsApp → juez dice sí/no
2. Delegado abre competición → botón "Disponibilidad" → marca confirmados
3. Toggle "Solo confirmados" → vista filtrada
4. Construye tarima desde pool confirmado

**Archivos clave:**
- `supabase/migrations/019_competition_availability.sql`
- `src/components/competitions/competition-availability-dialog.tsx`
- `src/components/competitions/roster-builder.tsx` — prop `initialConfirmedIds`, state `confirmedIds`, filtro `filterOnlyConfirmed`

---

### Phase 6 — Analytics + UX
**Lo que hace:**
- **Analytics cross-zona:** columna `⟳ Ext.` en tabla "Actividad por zona", banner naranja cuando hay plazas cross-zona en el año
- **KPI Cobertura Nacional:** 5ª tarjeta en el dashboard (`filledSlots / enumerateSlotKeys(template)`) — color se adapta (azul ≥80%, amarillo ≥50%, rojo <50%)
- **Export CSV:** botón "Exportar CSV" en /analytics
- **Búsqueda por iniciales:** campo search acepta "DM" además de "David Muñoz"
- **Badge nivel:** `LevelBadge` visible en tarjeta de juez del selector
- **Warning alta carga:** badge ámbar cuando `eventos >= 8`

**Archivos clave:**
- `src/components/analytics/analytics-dashboard.tsx`
- `src/server/services/supabase-service.ts` — `buildKpis`, `getAnalytics`
- `src/components/dashboard/kpi-cards.tsx` — grid `lg:grid-cols-3 2xl:grid-cols-5`

---

## 4. Key Design Decisions

| Decisión | Alternativa descartada | Razón |
|----------|------------------------|-------|
| Cross-zone detectado server-side | Client envía flag | Seguridad — el cliente no puede falsificar zona |
| Disponibilidad por competición (no por fechas) | Periodos de baja general en ficha de juez | Flujo real es WhatsApp por campeonato, no "estoy de baja" |
| `competition_availability` solo almacena confirmados | Tabla YES/NO/sin respuesta | Simplicidad — no confirmado = no en lista |
| `enumerateSlotKeys` para KPI cobertura | Contar assignments | Misma fuente que analytics → valores siempre consistentes |
| Dialog flotante para availability | Radix Sheet/Drawer | Sin dependencia adicional, funciona en cualquier contexto |

---

## 5. Requirements Traceability

| ID | Descripción | Estado | Implementación |
|----|-------------|--------|----------------|
| ZONE-01 | Flag cross-zona en slot | ✅ | `roster_assignments.cross_zone` auto-detectado |
| ZONE-02 | Badge visual juez otra zona | ✅ | Badge naranja `⟳ ZONA` en RefereeCard |
| ZONE-03 | Filtro "Todas las zonas" | ✅ | `filterZona === "TODAS"` en roster builder |
| ZONE-04 | Admin asigna cualquier zona | ✅ | `delegado_jueces` + `super_admin` sin restricción |
| ZONE-05 | Delegado_zona solicita cross-zona | ✅ | Puede asignar; cross_zone registrado automáticamente |
| ZONE-06 | API valida y registra `cross_zone` | ✅ | `assign/route.ts` auto-detecta y persiste |
| SCHED-01 | Crear sesiones manualmente | ✅ | `RosterTemplateEditor` — añadir/editar/reordenar |
| SCHED-02 | Plantilla editable sin PDF | ✅ | Editor completo con roles, pesaje, grupos |
| SCHED-03 | Plantilla persiste en DB | ✅ | `api.saveTemplate` → `PUT /roster/template` |
| SCHED-04 | Parser PDF más variantes | ✅ | `DAY_RE` + `SCHEDULE_RE` endurecidos |
| IMP-01 | Excel mapea 5+ campos | ✅ | localidad, telefono, genero, antiguedad, notas |
| IMP-02 | Preview todos los campos | ✅ | 6 columnas en dialog importación |
| IMP-03 | PDF multi-día | ✅ | `currentDay` tracking en parser |
| IMP-04 | Warnings específicos | ✅ | `parsed.warnings` propagados al dialog |
| AVAIL-01 | Disponibilidad registrable | ✅ | `competition_availability` table |
| AVAIL-02 | Roster muestra confirmados | ✅ | Badge ✓ + filtro "Solo confirmados" |
| AVAIL-03 | Filtro disponibilidad | ✅ | Toggle `filterOnlyConfirmed` en selector |
| ANAL-01 | Actividad cross-zona | ✅ | Columna `⟳ Ext.` + banner naranja en analytics |
| ANAL-02 | KPI cobertura | ✅ | "Cobertura Nacional" 5ª tarjeta dashboard |
| ANAL-03 | Export CSV | ✅ | `ExportPreviewDialog` en /analytics |
| UX-01 | Badge nivel visible | ✅ | `LevelBadge` en RefereeCard |
| UX-02 | Warning carga alta | ✅ | Badge ámbar `eventos >= 8` |
| UX-03 | Búsqueda por iniciales | ✅ | `r.iniciales` en filter predicate |

---

## 6. Tech Debt & Known Limitations

| Ítem | Detalle | Impacto |
|------|---------|---------|
| Migration 018 en historial | Creada y luego eliminada en 019 | Bajo — solo cosmético en historial SQL |
| `eventos` como proxy carga | Dato del Excel, no real-time DB | Bajo — indicativo, no bloqueante |
| RosterBuilder tamaño | 1000+ líneas en un componente | Medio — dificulta mantenimiento futuro |
| Sin test suite | Verificación manual únicamente | Alto — riesgo en refactors |
| Dialog availability sin paginación | Carga todos los jueces activos | Bajo — corpus máximo ~200 jueces |

---

## 7. Getting Started (Onboarding)

### Setup
```bash
git clone https://github.com/Davmunrey/AEP-Referee-APP
cd AEP-Referee-APP
npm install
# Copiar variables de entorno (Supabase URL/Key + Clerk keys)
npm run dev   # http://localhost:3000
```

### Aplicar migraciones Supabase
Ejecutar en Supabase SQL Editor en orden:
1. `supabase/migrations/017_cross_zone_assignments.sql`
2. `supabase/migrations/019_competition_availability.sql` *(018 reemplazada)*

### Flujo operativo completo
1. **Importar jueces** → `/referees` → "Importar Excel" → preview 6 campos → confirmar
2. **Crear competición** → `/competitions/new` → tipo AEP-1/2/3, fecha, sede
3. **Montar tarima** → `/competitions/[id]` → importar PDF horario o editar plantilla manual
4. **Recoger disponibilidades** → botón "Disponibilidad" en panel lateral → marcar confirmados
5. **Asignar jueces** → toggle "Solo confirmados" → arrastrar a slots
6. **Aprobar** → delegado_zona envía propuesta → delegado_jueces aprueba
7. **Estadísticas** → `/analytics` → tabla cross-zona, export CSV

### Roles y permisos
| Rol | Puede |
|-----|-------|
| `super_admin` / `delegado_jueces` | Todo, incluido cross-zona libre |
| `delegado_zona` | Solo su zona; cross-zona registrado automáticamente |
| `solo_ver` | Lectura completa, sin escritura |

---

*Generado 2026-05-27 · AEP Referee APP v1.1 · GitHub: Davmunrey/AEP-Referee-APP*
