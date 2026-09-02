import { todayIso } from "@/lib/business-date";
import type { Competition } from "@/lib/types";

/**
 * Devuelve `true` si la fecha fin del campeonato es anterior a hoy.
 * Se usa como contexto visual ("finalizado"), no como bloqueo de edición:
 * cuadrantes históricos y correcciones pueden cargarse con permisos.
 *
 * Se compara contra el día natural español, no contra la medianoche del huso
 * del servidor: el despliegue va en UTC, así que un campeonato terminado ayer
 * seguía contando como vigente hasta las 02:00 de España.
 */
export function isCompetitionPast(competition: Pick<Competition, "fechaFin" | "fecha">): boolean {
  const reference = competition.fechaFin || competition.fecha;
  if (!reference) return false;
  // Ambas son fechas ISO solo-día: comparar como texto evita crear Date y
  // volver a mezclar husos.
  return reference < todayIso();
}