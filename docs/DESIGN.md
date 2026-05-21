# Diseño

## Principios

- Pantalla 14" como base.
- Menos verticalidad, más densidad útil.
- Nombres completos visibles antes que iniciales.
- Tokens, no colores hardcodeados.
- Preview antes de aplicar cualquier import/export.

## Tokens

Fuente verdad:

- `src/styles/tokens.css`
- `src/app/globals.css`
- `src/lib/design-tokens.ts`

## Layout

- Sidebar expandido para operación normal.
- Sidebar colapsado solo iconos, sin labels cortados.
- Tarima usa distribución horizontal: jueces disponibles izquierda, sesiones/slots derecha.
- Tablas preview deben permitir scroll interno sin solapar headers.

## Estados

| Estado | UI |
|---|---|
| Correcto | Verde suave |
| Atención | Ámbar |
| Bloqueo | Rojo |
| Solo lectura | Neutral |

## No hacer

- No mostrar fuentes internas tipo `(Excel: ...)`.
- No mezclar "Evento" visible con "Competición/Campeonato".
- No usar plantillas precargadas como verdad si competición trae plantilla propia.
- No ocultar errores de parser; mostrar warnings accionables.
