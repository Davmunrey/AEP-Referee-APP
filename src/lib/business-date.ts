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

/** Día natural español (AAAA-MM-DD) del instante dado. */
export function businessDayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TZ }).format(now);
}

/** Hoy (AAAA-MM-DD) en la zona horaria de negocio. */
export function todayIso(): string {
  return businessDayIso();
}

/** Año natural español del instante dado. */
export function businessYear(now = new Date()): number {
  return Number(businessDayIso(now).slice(0, 4));
}

/** Mes natural español (0-11) del instante dado. */
export function businessMonthIndex(now = new Date()): number {
  return Number(businessDayIso(now).slice(5, 7)) - 1;
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

const SOLO_DIA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El instante que hay que formatear para una fecha de la aplicación.
 *
 * Una fecha solo-día no tiene hora: `new Date("2026-03-14")` la lee como
 * medianoche UTC, y leída en cualquier huso al oeste cae en el día anterior.
 * Se ancla al mediodía UTC, que es lo que ya hacía `formatSanctionPeriod`, para
 * que en hora española sea siempre ese mismo día natural.
 *
 * `null` si la cadena no es una fecha utilizable; quien llama decide qué
 * enseñar en su lugar.
 */
function instanteDeNegocio(iso: string | null | undefined): Date | null {
  const texto = String(iso ?? "").trim();
  if (!texto) return null;
  const date = new Date(SOLO_DIA.test(texto) ? `${texto}T12:00:00Z` : texto);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fecha formateada en hora ESPAÑOLA.
 *
 * Sin `timeZone`, `toLocaleDateString` usa el huso de quien renderiza: el
 * servidor va en UTC y el navegador en la hora del usuario, así que un
 * componente cliente —que se pinta en los dos sitios— podía servir un día y
 * reescribirlo a otro al hidratar. Es el mismo motivo por el que
 * `formatSanctionPeriod` y el cuadrante en HTML ya la pasaban.
 */
export function formatBusinessDate(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" },
): string {
  const date = instanteDeNegocio(iso);
  if (!date) return String(iso ?? "");
  return date.toLocaleDateString("es-ES", { timeZone: BUSINESS_TZ, ...opts });
}

/** Ídem con la hora, para los sellos de tiempo (comentarios, avisos, accesos). */
export function formatBusinessDateTime(
  iso: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const date = instanteDeNegocio(iso);
  if (!date) return String(iso ?? "");
  return date.toLocaleString("es-ES", { timeZone: BUSINESS_TZ, ...opts });
}
