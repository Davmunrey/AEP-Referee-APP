# Diseño

## Principios

- Pantalla 14" como base de referencia.
- Densidad útil en tarima: más jueces visibles, menos scroll.
- Nombres completos visibles antes que iniciales.
- Tokens de diseño, no colores hardcodeados.
- Preview antes de aplicar cualquier import/export.

## Lenguaje visual (v2.12)

- **Tipografía**: Archivo (grotesca de deporte y datos, con eje de anchura) para toda la interfaz; los `h1` van algo ensanchados (`font-stretch: 112%`), sin cursivas. Geist Mono solo para código y bloques preformateados. Cifras tabulares en toda la app (`font-variant-numeric: tabular-nums` en `body`). Sustituye a Geist (v2.12), la grotesca de cualquier panel generado.
- **Tres planos**: el marco (sidebar + fondo, gris `neutral-100`), el lienzo de cada página (panel `canvas` con borde fino y esquinas de 12 px en escritorio) y las tarjetas blancas encima. Neutros fríos tipo zinc; nada de beige.
- **Rótulos en minúscula de frase**: sin versales ni tracking ancho (cabeceras de tabla, grupos del menú, rótulos de formulario). Las píldoras de estado van capitalizadas.
- **Un solo acento**: el rojo AEP, reservado a la acción principal y al estado activo. Las cifras de los KPI van en el color del texto; el tono del indicador es un punto junto al rótulo.
- **Sin halos**: sombras de 1–2 px como mucho; la jerarquía la marcan el plano y el borde. Insignias sin borde, con fondo suave y radio de 6 px.
- **Menú lateral compacto**: ítems de 32 px; el activo es una tarjeta blanca sobre el marco con el icono en rojo.
- **Modo oscuro**: menú de usuario → Tema (Sistema / Claro / Oscuro). La preferencia se guarda en el navegador (`aep-tarima:theme`) y un script de arranque en `layout.tsx` pone `data-theme` en `<html>` antes del primer pintado. Los tokens oscuros viven en `tokens.css` (`:root[data-theme="dark"]`, con la misma lista repetida para `prefers-color-scheme` sin JavaScript; un test comprueba que coinciden). La variante `dark:` de Tailwind sigue a `data-theme`. Los logos tienen variante clara (`aep-mark-dark.png`, `aep-master-logo-light.png`); la vista previa del cuadrante se queda en blanco porque es el documento imprimible.

## Tokens

Todo valor de diseño sale de un token; un test (`regression-batch-ei-diseno`) falla si vuelve un valor suelto.

| Qué | Tokens | Uso |
|---|---|---|
| Color | `--background`, `--card`, `--foreground`, `--muted-foreground`, `--primary`, `--success`… | clases semánticas (`bg-card`, `text-success`); nunca hex en componentes |
| Tamaño de letra | `--text-2xs` (11 px), `xs` (12), `ui` (13), `sm`, `title` (15), `base`, `heading` (22), `2xl`, `display` (26) | `text-ui`, `text-title`… (en px los propios: no bajan de 11 px cuando el `html` baja a 15 px) |
| Espaciado de letra | `--tracking-tighter`, `tight`, `snug` | `tracking-snug` |
| Capas | `--z-raised`, `sticky`, `header`, `sidebar`, `drawer`, `modal`, `float`, `confirm`, `skip` | `z-(--z-modal)` |
| Movimiento | `--ease-out`, `--duration-fast/base/enter/slow/slower/shimmer`, `--scale-press/enter/lift` | `duration-(--duration-base)`, `active:scale-(--scale-press)` |
| Composición | `--size-page`, `--size-dialog-h`, `--size-popover`, `--size-topbar`, `--size-sidebar`, `--size-drawer`, `--grid-dashboard`, `--grid-tarima` | `max-w-(--size-page)`, `md:grid-cols-(--grid-tarima)` |
| Documentos | `BRAND`, `PRINT`, `QUADRANT_ROLE_FILL` en `lib/document-tokens.ts` | correos, recibo PDF y cuadrante imprimible (no cargan CSS); la marca se comprueba contra `tokens.css` |

`cn()` (`lib/utils.ts`) conoce la escala propia: sin eso, `text-ui` se tomaba por un color y borraba el color real del texto.

Fuente de verdad:

- `src/styles/tokens.css`
- `src/app/globals.css`
- `src/lib/design-tokens.ts`
- `src/lib/document-tokens.ts`
- `src/lib/status-tone.ts` (color de cobertura)

## Layout

- Sidebar expandido en escritorio y agrupado en General · Competiciones · Jueces · Referencia · Administración; usuario en **topbar** (no en pie del sidebar).
- Sin rótulo (*eyebrow*) encima del título: la miga de pan y el menú ya dicen dónde estás. La barra superior no repite el título (la última miga y el `h1` ya lo dicen). Las acciones de la página van a la derecha del título y, en móvil, debajo.
- En móvil, cajón de navegación desde el botón ☰ y nombre de la página en la barra superior.
- Tarima: panel jueces izquierda, sesiones/slots derecha.
- Sin footer legal en dashboard (`/docs` + widget Ayuda).
- Widget Ayuda flotante (esquina inferior derecha).

## Tarima — densidad

- Cards de juez compactas (`RefereeCard`).
- **Badges de nivel abreviados** en tarima: Regional **R**, Nacional **N**, IPF Cat. 1 **I**, IPF Cat. 2 **II**. El directorio mantiene el nombre completo.
- Los niveles son una escala neutra, no colores de estado: Regional con borde, Nacional relleno claro, IPF Cat. 2 relleno oscuro, IPF Cat. 1 invertido. Igual los tipos de campeonato (AEP-3 → AEP-1).
- Slots de cuadrante con altura reducida; rejilla hasta 3 columnas.
- Tooltip `title` en badge compacto muestra el nivel completo.

## Selección rápida de jueces

- Al elegir un hueco, la lista se ordena por **idoneidad** (disponibilidad confirmada como criterio dominante, luego zona, nivel y solapes).
- La selección rápida actúa **solo sobre los jueces disponibles**: va después del paso de disponibilidad.
- El nivel recomendado es un **aviso** (no bloquea la asignación).

## Arbitrajes por año

- Ficha de juez: **selector de año natural** + «Histórico» (censo vs. agregado).
- Directorio: filtro de censo por año natural.

## Recibo de compensación

- Organizador con 3 estilos: **club**, **AEP**, **custom**.
- PDF con logo AEP en la cabecera (solo en el tipo AEP).

## Cifras y textos

- Las cifras de una pantalla van en una sola franja (`MetricStrip` + `MetricTile`): celdas separadas por un filete, sin iconos en cuadrados de color. El tono es un punto junto al rótulo y solo se usa cuando la cifra pide hacer algo (pendientes, incidencias, km sin rellenar).
- Una cifra que no se puede calcular se muestra como «—», no como 0 (p. ej. tasa de aprobación sin exámenes).
- Nada de gráficos decorativos que parezcan datos (se retiraron las «mini-gráficas» de los KPIs del dashboard).
- Plurales con `contar()`/`palabra()`; vocabulario de la casa: tarima, hueco, plantilla (no roster, slot, diff).

## Contraste

- Todo texto pasa 4,5:1 (WCAG AA) sobre las superficies en las que aparece, incluido el gris del marco. Los tonos de estado tienen dos usos: el semántico (`text-success`, `text-warning`…, más oscuro) para texto e insignias, y el de gráfico (`bg-chart-success`, `bg-chart-warning`, `bg-chart-danger`, más vivo) para barras y puntos. La cobertura se pinta con `lib/status-tone.ts`.
- `--subtle-muted` ya no es un gris más claro que `--subtle`: un gris más claro no llegaba a 4,5:1. La jerarquía terciaria la da el tamaño.

## Confirmaciones

- Nunca `window.confirm` ni `alert`: `confirmar()` (`components/ui/confirm-dialog.tsx`) abre un diálogo de la app. El botón nombra la acción («Eliminar juez», «Vaciar asignaciones»); con `peligro` se pinta en rojo y el foco empieza en «Cancelar».
- Lo destructivo nunca es el botón más visible de la pantalla: va como acción discreta o dentro del menú «…».

## Estados

| Estado | UI |
|---|---|
| Correcto | Verde suave |
| Atención | Ámbar |
| Bloqueo | Rojo |
| Solo lectura / Histórico | Neutral |
| Pagada | Distintivo «pagada»; la fila no se puede editar |

## No hacer

- No mostrar fuentes internas tipo `(Excel: ...)`.
- No mezclar «Evento» visible con «Campeonato».
- No ocultar errores de parser; mostrar warnings accionables.
- No llamar APIs de mapas desde el cliente (usar `/api/v1/geocode/search`).
- No dejar un botón activo si la acción va a fallar seguro: desactívalo y explica por qué en su `title` (p. ej. «Enviar a aprobación» sin plantilla).
- No esconder datos sin decirlo: si un filtro o una regla oculta elementos, dilo (jueces no disponibles en la tarima).

## Domicilio (v1.8)

- Campo con autocomplete OSM y botón **Eliminar ubicación** (texto rojo, junto a la etiqueta).
- Tras eliminar, desaparecen coordenadas y mensaje verde «Ubicación OpenStreetMap OK».

---

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.12
