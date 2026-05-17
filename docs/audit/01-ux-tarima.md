# Auditoría UX — Tarima y journeys

## Alcance

Flujos: crear campeonato → plantilla (manual/PDF) → asignar → borrador → enviar → aprobación. Personas: delegado_zona, delegado_jueces, solo_ver.

## Hallazgos

| ID | Sev | Hallazgo | Recomendación |
|----|-----|----------|----------------|
| UX-01 | P0 | No hay hub de tarimas; "Tarima activa" = 1 deep-link arbitrario | Lista "Tarimas abiertas" en `/events` + selector si >1 activo |
| UX-02 | P0 | Breadcrumb muestra id crudo (`evt-001`) no nombre campeonato | Pasar `eventName` a `getPageMeta` |
| UX-03 | P0 | Dos imports PDF sin guía (calendario vs horario) | Copy unificado + tooltips en diálogos |
| UX-04 | P1 | Constructor monolítico (~900+ líneas), curva aprendizaje alta | Stepper Plantilla → Asignación → Revisión |
| UX-05 | P1 | Sin estados vacíos guiados en plantilla vacía | CTA "Importar horario" + enlace calendario |
| UX-06 | P2 | Mismo flujo aprobaciones OK pero desconectado del hub tarimas | Badge pendientes en lista tarimas |
| UX-07 | P2 | Tablet en pista: drag-drop usable pero denso | Responsive: paneles apilados, filtros sticky |

## Journey ideal (≤2 clics)

1. Dashboard o Campeonatos → fila → **Montar tarima**
2. (Opcional) Elegir campeonato si varios abiertos
3. Stepper guía plantilla → asignación → revisión → enviar

## Wireframe textual

```
[Campeonatos]
  |-- CTA primario "Montar tarima" por fila
  |-- Sección "Tarimas abiertas" (cards: nombre, zona, %, estado)
  v
[Constructor /events/:id]
  [Plantilla] [Asignación] [Revisión]  <- stepper
  |-- Izq: jueces + motivo si no asignable
  |-- Der: acta por día/sesión + % global
  |-- Footer: Guardar | Exportar | Enviar (resumen huecos)
```

## Resumen

- Top 3: navegación tarima, breadcrumb, imports confusos
- Quick wins: copy imports, breadcrumb con nombre, CTA en lista eventos

## Estado post-implementación (2026-05-17)

| ID | Estado | Notas |
|----|--------|-------|
| UX-01 | Parcial | `OpenRostersPanel` en `/events`; sidebar «Tarima activa» sigue siendo un deep-link |
| UX-02 | Hecho | `useEventCrumbLabel` en topbar |
| UX-03 | Parcial | Wizards unificados + copy en `import-export-ui` (calendario vs horario) |
| UX-04 | Parcial | `RosterStepper`, `RosterHelpPanel`, `RosterRevisionPanel` |
| UX-05 | Parcial | CTAs en panel de ayuda; empty states en editor pendientes de pulir |
| UX-06 | Pendiente | Badge aprobaciones en lista tarimas |
| UX-07 | Pendiente | Responsive tablet |
