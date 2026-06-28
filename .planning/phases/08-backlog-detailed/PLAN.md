# Plan detallado v1.5 — Compensación, tarima UI y backlog

Última actualización: 2026-06-28. Un solo plan integrado (no ramas paralelas).

---

## Estado resumido

| Bloque | Progreso | Notas |
|---|---|---|
| A. Supabase prod | ✅ Hecho | 023, 024, 025 aplicadas vía MCP (2026-06-28) |
| B. Compensación jueces | ~90 % | Servicios, API, UI, export PDF; falta E2E |
| C. UI tarima (densidad) | ✅ Hecho | Footer fuera de app, cards compactas |
| D. E2E profundo | 0 % | Tras E2E smoke compensación |
| E. Sustitución xlsx | 0 % | Backlog técnico |

---

## A. Acción Supabase (producción) — ✅ COMPLETADO

Migraciones aplicadas en proyecto `foaemadggmpbcrhtpems` (eu-west-2) el 2026-06-28:

| Migración | Nombre MCP | Contenido |
|---|---|---|
| 023 | `promotion_review_comment` | `review_comment` en ascensos |
| 024 | `judge_compensation` | Claims, duty lines, domicilio, sede |
| 025 | `financial_role_and_receipt` | Rol financiero + metadatos recibo |

Verificación: `list_migrations` en Supabase MCP confirma las tres entradas.

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

### B2. Hecho (2026-06-28)

| # | Tarea | Estado |
|---|---|---|
| B2.1 | Servicio Supabase + memoria para claims | ✅ |
| B2.2 | API GET lista, POST recalculate, PATCH overrides, POST distance | ✅ |
| B2.3 | UI `/competitions/[id]/compensation` | ✅ |
| B2.4 | Modal export: campo IBAN efímero → descarga PDF | ✅ |
| B2.5 | Config organizer en página compensación | ✅ |
| B2.6 | Ficha juez: campo domicilio | ✅ |
| B2.7 | Enlace «Compensación» en cabecera tarima | ✅ |
| B2.8 | E2E smoke `compensation.spec.ts` | Pendiente |
| B2.9 | Aplicar 024 + 025 en producción | ✅ |

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
A (023–025 en prod) ✅  ──►  C (UI tarima) ✅  ──►  B2 (compensación) ~90%
                              │                        │
                              └──────────►  D (E2E profundo) pendiente
                                                    │
                                            E (xlsx) en paralelo bajo demanda
```

**Siguiente:** B2.8 E2E smoke compensación, D (E2E profundo), E (xlsx).

---

## Criterios de «hecho» v1.5

- [x] 023–025 aplicadas en producción
- [x] Responsable financiero puede: ver tarima → calcular → exportar recibo con IBAN puntual
- [x] Sin footer en app autenticada; docs accesibles desde Ayuda
- [x] Panel jueces más denso (cards compactas, slots menores)
- [ ] E2E import → cuadrante → export pasa en CI
- [ ] E2E smoke compensación pasa en CI
