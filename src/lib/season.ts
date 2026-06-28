/**
 * Utilidades de temporada — evita acoplar la app a un año fijo en UI y KPIs.
 * Los datos (competiciones, analytics) siguen siendo multi-año por fechas ISO.
 */

/** Año deportivo AEP: a partir de julio la temporada etiqueta el año siguiente. */
export function currentSeasonYear(now = new Date()): number {
  const year = now.getFullYear();
  return now.getMonth() >= 6 ? year + 1 : year;
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
