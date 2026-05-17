# Auditoría Backend / API / dominio

## Alcance

38 rutas `src/app/api/v1/`, `supabase-service`, parsers, dedupe, sanctions.

## Hallazgos

| ID | Sev | Hallazgo | Recomendación |
|----|-----|----------|----------------|
| BE-01 | P1 | `meetsMinLevel` duplicado en cliente (`roster-builder`) y servidor (`roster-rules`) | UI usa API error message; alinear con servidor como fuente verdad |
| BE-02 | P1 | `assignReferee` valida en servidor; cliente no pre-valida sanción activa visualmente antes de drop | Mostrar motivo si API rechaza (sanción, nivel) |
| BE-03 | P2 | `regulations` page sin `getSession` redirect | Añadir auth como resto dashboard |
| BE-04 | P2 | Calendar import `apply` dedupe side-effect puede sorprender | Mostrar `dedupeRemoved` en UI antes de crear |
| BE-05 | P1 | Sin tests API route handlers | Vitest para roster assign/submit/dedupe |
| BE-06 | P2 | `referee-sanctions` service sin tests unitarios | Tests con memory service mock |
| BE-07 | P3 | `normalizeAepCalendarPdfText` sin tests dedicados | Añadir tests fixture PDF |

## Contratos API críticos (tarima)

- `GET/PUT .../roster/template`
- `POST .../assign`, `POST .../clear`, `PATCH .../flags`
- `POST .../draft`, `POST .../submit`
- `GET .../export`

## Resumen

- Prioridad tests API roster + auth regulations + mensajes error estructurados en UI
