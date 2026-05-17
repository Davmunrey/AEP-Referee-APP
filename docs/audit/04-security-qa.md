# Auditoría Seguridad + QA

## Alcance

`session-rbac.ts`, permisos API, cobertura tests.

## Hallazgos

| ID | Sev | Hallazgo | Recomendación |
|----|-----|----------|----------------|
| SEC-01 | P1 | `regulations` sin guard sesión en page | Redirect si no auth |
| SEC-02 | P1 | `solo_ver` bloqueado en muchas rutas POST — OK | Documentar matriz rol × acción |
| SEC-03 | P2 | Evento pasado: `canEdit` false en page pero lista puede confundir | Badge "Solo lectura" en lista si `isPast` |
| SEC-04 | P1 | Sin tests E2E flujo tarima | Playwright: login → assign → submit (smoke) |
| SEC-05 | P2 | Sin contract tests API | Vitest con mocks de request handlers |
| SEC-06 | P3 | Reports page "Sandbox" en nav sin advertencia | Renombrar o badge "Interno" |

## Matriz riesgo (resumen)

| Riesgo | Sev | Mitigación |
|--------|-----|------------|
| Drift reglas nivel UI/servidor | Med | Errores API con mensaje claro |
| RBAC bypass zona | Alto | Tests session-rbac + manual checklist |
| Regresión import PDF | Med | Tests calendar + schedule parsers existentes |

## Plan tests mínimo

1. Vitest: `api-roster.test.ts` — assign, submit, template PUT
2. Vitest: `referee-sanctions-service.test.ts` — si se extrae lógica testeable
3. Playwright (opcional P1): 1 spec happy path tarima
