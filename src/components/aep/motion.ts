/**
 * Lenguaje de movimiento compartido de la app (entradas de diálogo y de
 * contenido plegable).
 *
 * Antes cada diálogo se montaba de golpe y las pocas transiciones repartidas
 * por la app usaban duraciones y curvas distintas. Aquí vive un único par
 * duración + curva para que todas las apariciones se sientan de la misma
 * mano: entrada rápida que frena suave, siempre desde un estado ya visible
 * (nunca desde escala 0) y solo sobre `opacity`/`scale`, que no repintan
 * layout.
 *
 * La curva es una deceleración fuerte, no la `ease-out` blanda del navegador:
 * el token `--ease-out` de tokens.css, que además es ya la transición por
 * defecto de toda la app.
 *
 * `prefers-reduced-motion` ya está neutralizado globalmente en globals.css.
 */

/** Velo del modal: solo opacidad; entra a la vez que el panel. */
export const dialogOverlayEnter =
  "transition-opacity duration-200 ease-(--ease-out) starting:opacity-0";

/**
 * Panel del modal: escala desde 0.97 + opacidad. Origen centrado a propósito:
 * un modal no cuelga de un disparador concreto, aparece en el centro.
 */
export const dialogPanelEnter =
  "scale-100 opacity-100 transition-[opacity,scale] duration-200 ease-(--ease-out) starting:scale-[0.97] starting:opacity-0";

/** Contenido que se despliega dentro de una fila o tarjeta ya visible. */
export const disclosureEnter =
  "transition-opacity duration-150 ease-(--ease-out) starting:opacity-0";
