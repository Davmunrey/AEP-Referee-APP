import type { Competition } from "@/lib/types";

/**
 * Devuelve `true` si la fecha fin del campeonato es anterior a hoy (UTC).
 * Campeonatos pasados pasan a modo solo lectura: no se puede editar plantilla,
 * asignaciones, flags ni enviar a aprobación.
 */
export function isCompetitionPast(competition: Pick<Competition, "fechaFin" | "fecha">): boolean {
  const reference = competition.fechaFin || competition.fecha;
  if (!reference) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(`${reference}T23:59:59`);
  return end.getTime() < today.getTime();
}
