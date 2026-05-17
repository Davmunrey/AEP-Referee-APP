# Auditoría Frontend + a11y

## Alcance

`roster-builder.tsx`, `roster-header-actions.tsx`, `events-table.tsx`, `design-tokens.ts`

## Hallazgos

| ID | Sev | Hallazgo | Recomendación |
|----|-----|----------|----------------|
| FE-01 | P0 | `roster-builder.tsx` monolito dificulta mantenimiento | Extraer subcomponentes (pool, acta, slot, banners) |
| FE-02 | P1 | Violación normativa solo color en slot, sin texto para SR | `aria-label` + texto corto en badge violación |
| FE-03 | P1 | Filtros zona/nivel sin `aria-describedby` en modo asignación | Conectar label a filtros |
| FE-04 | P1 | Drag solo en grip icon; target pequeño en móvil | Zona drop ampliada en slot |
| FE-05 | P2 | `statusMsg` genérico, desaparece rápido | Toast o banner persistente hasta dismiss |
| FE-06 | P2 | Tabla eventos sin CTA visual "Montar tarima" destacado | Botón/link primario por fila |
| FE-07 | P1 | TopBar oculta búsqueda en `/events/*` | Coherente con resto o búsqueda local en tarima |

## a11y

| ID | Sev | Hallazgo | Recomendación |
|----|-----|----------|----------------|
| A11Y-01 | P1 | Slots drag sin `role="button"` cuando vacíos | `role="button"` + `aria-pressed` si seleccionado |
| A11Y-02 | P2 | Contraste warning subtle revisar en dark mode | Verificar tokens warning |
| A11Y-03 | P2 | Selectores filtro sin label visible asociada en SR | `<label>` explícitos |

## Refactors propuestos

- `src/lib/roster-ui.ts` — helpers puros
- `src/components/events/roster/` — subcomponentes
- `src/components/events/roster-stepper.tsx`
- `src/components/events/roster-help-panel.tsx`
