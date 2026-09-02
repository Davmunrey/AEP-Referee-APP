/**
 * Fechas de negocio: días naturales en España.
 *
 * La aplicación se despliega en UTC, así que `new Date().toISOString()` da el
 * día equivocado entre la medianoche española y las 01:00–02:00 UTC. Para todo
 * lo que sea una fecha con valor propio —el inicio de una sanción, qué
 * campeonato cuenta como «próximo», la fecha por defecto de un examen— hay que
 * usar el día natural español, no el UTC.
 */
export const BUSINESS_TZ = "Europe/Madrid";

/** Hoy (AAAA-MM-DD) en la zona horaria de negocio. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(new Date());
}

/**
 * Suma días naturales a una fecha ISO.
 *
 * Todo el cálculo va en UTC: anclar a mediodía en hora del servidor y volver a
 * `toISOString()` mezcla dos husos y desplaza el día en despliegues que no
 * estén en UTC.
 */
export function addDaysIso(startIso: string, days: number): string {
  const d = new Date(`${startIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return startIso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Hora (0-23) en la zona horaria de negocio.
 *
 * El saludo del panel la usaba vía `new Date().getHours()`, que en el servidor
 * es UTC y en el navegador es la hora local: entre las 22:00 y la medianoche
 * españolas el HTML servido decía «Buenas tardes» y el cliente lo reescribía a
 * «Buenas noches», con el aviso de hidratación correspondiente.
 */
export function businessHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return Number(hour);
}
