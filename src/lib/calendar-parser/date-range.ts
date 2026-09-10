/**
 * Cierre de un rango de fechas del calendario AEP.
 *
 * El calendario es de un año natural y ese año se aplicaba a los dos extremos
 * del rango. Cuando el mes de fin es ANTERIOR al de inicio —«28-3 dic-ene»— el
 * fin es del año siguiente; escrito con el mismo año, el campeonato nace con la
 * fecha de fin once meses antes que la de inicio, y a partir de ahí:
 *
 *   - `isCompetitionPast` lo da por celebrado en cuanto se importa, así que no
 *     aparece en el panel ni entre los próximos;
 *   - `championshipDayCount` lo cuenta como un solo día, y el alojamiento se
 *     calcula sobre ese día.
 *
 * El lector del Excel de campeonatos ya hacía las dos cosas —rodar el año
 * («31-Dic/01-Ene-26») y no dejar un fin anterior al inicio—; los dos lectores
 * del calendario, el del PDF y el del CSV, se habían quedado sin ellas.
 *
 * Vive aquí, y no en cada lector, por lo mismo que `entry-warnings`: son el
 * mismo calendario leído de dos formas y no pueden decir cosas distintas.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Último día del mes (para los rangos de mes a mes: «nov-dic»). */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Rango del calendario con los años ya resueltos.
 *
 * `endDay` opcional: sin él se toma el último día del mes de fin, que es lo que
 * necesita un rango escrito de mes a mes.
 */
export function resolveCalendarRange(
  year: number,
  startMonth: number,
  startDay: number,
  endMonth: number,
  endDay?: number,
): { start: string; end: string } {
  // Un mes de fin anterior al de inicio solo puede ser el año siguiente.
  const endYear = endMonth < startMonth ? year + 1 : year;
  const dia = endDay ?? lastDayOfMonth(endYear, endMonth);
  const start = iso(year, startMonth, startDay);
  const end = iso(endYear, endMonth, dia);
  // Dentro del mismo mes no hay año que rodar, y adivinar el mes siguiente sería
  // inventar: un fin anterior al inicio se trata como un campeonato de un solo
  // día, que es lo que ya hacen `competitionDateRange` y el lector del Excel.
  return { start, end: end < start ? start : end };
}
