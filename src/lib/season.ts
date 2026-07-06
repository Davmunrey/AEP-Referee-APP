/**
 * Utilidades de temporada — evita acoplar la app a un año fijo en UI y KPIs.
 * Los datos (competiciones, analytics, arbitrajes) son multi-año por fechas ISO.
 */

/**
 * Temporada AEP = **año natural** (enero–diciembre). Coincide exactamente con el
 * año de las fechas ISO de competiciones, la analítica por año y los arbitrajes
 * por año natural. No hay desfase julio–junio: cambiar de año natural cambia de
 * temporada de forma limpia en toda la app.
 */
export function currentSeasonYear(now = new Date()): number {
  return now.getFullYear();
}

export function seasonLabel(year = currentSeasonYear()): string {
  return `temporada ${year}`;
}

/** Etiqueta trimestre operativo para el dashboard (T1–T4 + año calendario). */
export function operationalQuarterLabel(now = new Date()): string {
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month < 3) return `T1 ${year}`;
  if (month < 6) return `T2 ${year}`;
  if (month < 9) return `T3 ${year}`;
  return `T4 ${year}`;
}

export function formatMonthYear(date = new Date(), locale = "es-ES"): string {
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
}
