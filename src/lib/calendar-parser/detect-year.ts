import { currentSeasonYear } from "@/lib/season";
import type { DetectedCalendarYear } from "./types";

/**
 * El año que fecha TODA la temporada importada.
 *
 * Solo la cabecera («CALENDARIO de COMPETICIONES 2027») es una respuesta. Las
 * otras dos son conjeturas, y hasta ahora ninguna lo decía:
 *
 * - el primer «20xx» suelto del documento puede ser un código postal, un
 *   teléfono, el año de fundación de un club o un récord;
 * - el reloj, que además se leía en el huso del proceso: importar el calendario
 *   a las 00:30 del 1 de enero en España, con un PDF sin año, creaba la
 *   temporada entera en el año anterior.
 *
 * Se devuelve la procedencia para poder avisar en el preview, que es donde
 * alguien puede corregirlo antes de aplicar.
 */
export function detectCalendarYear(text: string): DetectedCalendarYear {
  const header = text.match(/CALENDARIO\s+de\s+COMPETICIONES\s+(\d{4})/i);
  if (header) return { year: Number(header[1]), source: "cabecera" };
  const any = text.match(/\b(20\d{2})\b/);
  if (any) return { year: Number(any[1]), source: "suelto" };
  return { year: currentSeasonYear(), source: "reloj" };
}

/** Aviso para el preview cuando el año no venía en la cabecera. */
export function calendarYearWarning({ year, source }: DetectedCalendarYear): string | null {
  if (source === "cabecera") return null;
  if (source === "suelto") {
    return `El año no aparece en la cabecera: se ha tomado ${year} del primer número de cuatro cifras del documento. Comprueba que las fechas son de esa temporada antes de aplicar.`;
  }
  return `El documento no trae ningún año: se han fechado todas las competiciones en ${year}. Comprueba que es la temporada correcta antes de aplicar.`;
}
