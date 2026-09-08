/**
 * Qué enseña el panel de historial de la tarima en cada momento.
 *
 * Los cuatro estados se solapaban en el JSX con condiciones sueltas, y de ahí
 * salía el fallo que importa: un error de lectura se pintaba como «Sin cambios
 * registrados», que es una afirmación sobre el acta —«aquí no ha tocado nadie
 * nada»— y no sobre la petición que falló.
 */
export type RosterHistoryView = "cargando" | "error" | "vacio" | "lista";

export function rosterHistoryView(state: {
  loading: boolean;
  error: boolean;
  entries: { id: string }[] | null;
}): RosterHistoryView {
  // Mientras se recarga se mantienen a la vista las entradas ya cargadas: el
  // panel se recarga en cada apertura y parpadear a «Cargando…» cada vez sería
  // peor que enseñar lo de hace un segundo.
  if (state.loading && state.entries === null) return "cargando";
  if (state.error) return "error";
  if (state.entries === null) return "cargando";
  return state.entries.length === 0 ? "vacio" : "lista";
}
