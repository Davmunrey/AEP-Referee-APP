# Diseño

## Principios

- Pantalla 14" como base de referencia.
- Densidad útil en tarima: más jueces visibles, menos scroll.
- Nombres completos visibles antes que iniciales.
- Tokens de diseño, no colores hardcodeados.
- Preview antes de aplicar cualquier import/export.

## Tokens

Fuente de verdad:

- `src/styles/tokens.css`
- `src/app/globals.css`
- `src/lib/design-tokens.ts`

## Layout

- Sidebar expandido en escritorio; usuario en **topbar** (no en pie del sidebar).
- Enlaces **Documentación**, **Normativa**, **Compensación** (rol financiero) en sidebar.
- Tarima: panel jueces izquierda, sesiones/slots derecha.
- Sin footer legal en dashboard (`/docs` + widget Ayuda).
- Widget Ayuda flotante (esquina inferior derecha).

## Tarima — densidad

- Cards de juez compactas (`RefereeCard`).
- **Badges de nivel abreviados** en tarima: Regional **R**, Nacional **N**, IPF Cat. 1 **I**, IPF Cat. 2 **II**. El directorio mantiene el nombre completo.
- Slots de cuadrante con altura reducida; rejilla hasta 3 columnas.
- Tooltip `title` en badge compacto muestra el nivel completo.

## Estados

| Estado | UI |
|---|---|
| Correcto | Verde suave |
| Atención | Ámbar |
| Bloqueo | Rojo |
| Solo lectura | Neutral |

## No hacer

- No mostrar fuentes internas tipo `(Excel: ...)`.
- No mezclar «Evento» visible con «Campeonato».
- No ocultar errores de parser; mostrar warnings accionables.
- No llamar APIs de mapas desde el cliente (usar `/api/v1/geocode/search`).
