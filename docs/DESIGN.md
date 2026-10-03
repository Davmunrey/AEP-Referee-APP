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

- Sidebar expandido en escritorio y agrupado en General · Competiciones · Jueces · Referencia · Administración; usuario en **topbar** (no en pie del sidebar).
- El *eyebrow* de cada página repite el grupo del menú en el que vive; la barra superior no repite el título (la última miga y el `h1` ya lo dicen).
- En móvil, cajón de navegación desde el botón ☰ y nombre de la página en la barra superior.
- Tarima: panel jueces izquierda, sesiones/slots derecha.
- Sin footer legal en dashboard (`/docs` + widget Ayuda).
- Widget Ayuda flotante (esquina inferior derecha).

## Tarima — densidad

- Cards de juez compactas (`RefereeCard`).
- **Badges de nivel abreviados** en tarima: Regional **R**, Nacional **N**, IPF Cat. 1 **I**, IPF Cat. 2 **II**. El directorio mantiene el nombre completo.
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

- Las tiras de cifras usan `MetricTile`; nada de tarjetas de KPI hechas a mano por pantalla.
- Una cifra que no se puede calcular se muestra como «—», no como 0 (p. ej. tasa de aprobación sin exámenes).
- Nada de gráficos decorativos que parezcan datos (se retiraron las «mini-gráficas» de los KPIs del dashboard).
- Plurales con `contar()`/`palabra()`; vocabulario de la casa: tarima, hueco, plantilla (no roster, slot, diff).

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

**Producción:** [https://aep-tarima.vercel.app](https://aep-tarima.vercel.app) · v2.4
