# Plan detallado v1.5 — Compensación, tarima UI y backlog

Última actualización: 2026-06-28. Un solo plan integrado (no ramas paralelas).

---

## Estado resumido

| Bloque | Progreso | Notas |
|---|---|---|
| A. Supabase prod | Pendiente acción manual | Migración 023 |
| B. Compensación jueces | ~35 % | Lib + export PDF + rol financiero |
| C. UI tarima (densidad) | En curso | Footer fuera de app, cards compactas |
| D. E2E profundo | 0 % | Tras compensación UI |
| E. Sustitución xlsx | 0 % | Backlog técnico |

---

## A. Acción Supabase (producción)

### A1. Migración 023 — comentario rechazo ascensos

**Archivo:** `supabase/migrations/023_promotion_review_comment.sql`

```sql
ALTER TABLE promotion_requests
  ADD COLUMN IF NOT EXISTS review_comment TEXT;
```

**Pasos en Supabase Dashboard → SQL Editor (producción):**

1. Ejecutar el SQL de arriba (idempotente con `IF NOT EXISTS`).
2. Verificar: `SELECT column_name FROM information_schema.columns WHERE table_name = 'promotion_requests' AND column_name = 'review_comment';`
3. Probar en app: rechazar un ascenso con comentario → debe persistir y mostrarse.

**También pendientes en prod (cuando toque compensación):**

- `024_judge_compensation.sql` — tablas claims, domicilio, sede
- `025_financial_role_and_receipt.sql` — rol `responsable_financiero_jueces`, metadatos recibo

---

## B. Compensación de gastos (plan único)

Responsable: **`responsable_financiero_jueces`** (no delegado zona / delegado jueces).

### B1. Hecho

- [x] Rol + RBAC (`canManageCompensation`)
- [x] Lib baremo, classify, calculate, Google distance
- [x] Migraciones 024/025 escritas
- [x] Tipos + mappers (domicilio, sede, organizer)
- [x] Recibo PDF club vs AEP (`receipt-document.ts`, `receipt-pdf.ts`)
- [x] IBAN **solo al exportar** — no en BD (`iban.ts`)
- [x] API `POST …/compensation/:refereeId/export`
- [x] Tests unitarios baremo + recibo + RBAC

### B2. Pendiente (orden)

| # | Tarea | Archivos / rutas |
|---|---|---|
| B2.1 | Servicio Supabase + memoria para claims | `supabase-compensation.ts`, `dataService` |
| B2.2 | API GET lista, POST recalculate, PATCH overrides, POST distance | `/api/v1/competitions/:id/compensation/*` |
| B2.3 | UI `/competitions/[id]/compensation` | Tabla jueces, totales, overrides km/alojamiento |
| B2.4 | Modal export: campo IBAN efímero → descarga PDF | Sin persistir |
| B2.5 | Form campeonato: organizer club/AEP, email devolución | `edit-competition-dialog` |
| B2.6 | Ficha juez: campo domicilio (geocodificación) | `referee-edit-form` |
| B2.7 | Enlace «Compensación» en cabecera tarima | Solo rol financiero |
| B2.8 | E2E smoke `compensation.spec.ts` | Playwright autenticado |
| B2.9 | Aplicar 024 + 025 en producción | Tras revisar RLS |

### B3. Reglas de negocio (recordatorio)

- Baremo PDF 31/10/2025
- Km Google Maps o manual; vehículo compartido = un pago
- Alojamiento: >150 km ida+vuelta + ≥2 funciones
- Recibo: plantillas reales adjuntadas por el usuario (club / AEP)

---

## C. UI tarima — densidad y espacio

**Problema (capturas):** el panel de jueces muestra ~3 tarjetas por pantalla; los huecos del cuadrante ocupan mucho alto con poco contenido; el footer global resta espacio vertical.

### C1. Hecho en este sprint

- [x] **Quitar `SiteFooter` del layout dashboard** — Documentación/Privacidad/Contacto siguen en `/docs` y widget Ayuda
- [x] **Tarjetas de juez más compactas** — una fila nombre+zona+nivel; stats en línea
- [x] **Panel jueces** — filtros en grid 2 cols; hint inferior reducido
- [x] **Huecos del cuadrante** — padding menor, badges inline, botones * / ↑↓ solo icono
- [x] **Altura tarima** — `100dvh` menos topbar (sin reservar footer)

### C2. Mejoras opcionales (siguiente iteración)

| # | Idea |
|---|---|
| C2.1 | Vista «lista densa» toggle en panel jueces (solo nombre + nivel) |
| C2.2 | Cuadrante en columnas fijas por rol (central | lateral | …) en pantallas anchas |
| C2.3 | Colapsar cabecera de sesión a una sola línea cuando hay scroll |
| C2.4 | Sticky bar de sesión activa más baja |
| C2.5 | Revisar `RosterHelpPanel` / stepper — colapsar por defecto en asignación |

---

## D. E2E profundo (después de B + C)

Flujo completo Playwright:

1. Login (`E2E_EMAIL` / `E2E_PASSWORD`)
2. Crear o abrir campeonato de prueba
3. Import horario PDF → plantilla
4. Import cuadrante PDF → asignaciones
5. Export cuadrante (HTML/XLSX)
6. *(Cuando exista UI)* compensación → export recibo con IBAN mock

**Archivo objetivo:** `tests/e2e/roster-import-export.spec.ts`

**Prioridad:** después de estabilizar UI tarima (C) y página compensación (B2.3).

---

## E. Sustitución librería `xlsx`

**Motivo:** vulnerabilidad high en dependencia actual; alternativas: `exceljs`, `sheetjs-ce` auditado, o export CSV-only.

**Alcance:**

- `src/lib/quadrant-excel.ts`
- `src/lib/judges-registry/parse-xlsx.ts`
- Scripts `import-judges-registry`

**Prioridad:** backlog técnico; no bloquea compensación ni UI. Hacer en sprint dedicado con regresión en tests de import.

---

## Orden de ejecución recomendado

```
A1 (023 en prod)  ──►  C (UI tarima)  ──►  B2 (compensación end-to-end)
                              │                        │
                              └──────────►  D (E2E profundo)
                                                    │
                                            E (xlsx) en paralelo bajo demanda
```

1. **Ahora:** aplicar 023 en Supabase prod (acción manual).
2. **Esta semana:** terminar C + B2.1–B2.4 (servicios, API, UI compensación, modal IBAN).
3. **Siguiente:** B2.5–B2.9, D (E2E), migraciones 024/025 en prod.
4. **Cuando haya tiempo:** E (xlsx).

---

## Criterios de «hecho» v1.5

- [ ] 023 aplicada en producción
- [ ] Responsable financiero puede: ver tarima → calcular → exportar recibo con IBAN puntual
- [ ] Sin footer en app autenticada; docs accesibles desde Ayuda
- [ ] Panel jueces muestra ≥6–8 filas visibles en laptop 1366×768
- [ ] E2E import → cuadrante → export pasa en CI
- [ ] 024 + 025 aplicadas antes de usar compensación en prod
