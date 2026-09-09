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

/**
 * Año de una fecha ISO, o `null` si no se puede leer.
 *
 * Estaba duplicada, byte a byte, en `memory-helpers` y `supabase-helpers`, y
 * las dos hacían `Number(String(date).slice(0, 4))`. Eso deja pasar lo que
 * `Number` acepta de más: la cadena vacía es 0, así que un campeonato sin
 * fecha aparecía como «año 0» en el selector de la analítica, con su propio
 * grupo de campeonatos; y «  20» daba el año 20. Se exigen cuatro dígitos y
 * un año que pueda ser de verdad.
 */
export function yearFromIso(date: string | null | undefined): number | null {
  const match = /^(\d{4})(?:-|$)/.exec(String(date ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  return year >= 1900 && year <= 2200 ? year : null;
}
