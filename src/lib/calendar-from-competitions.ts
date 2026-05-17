import type { CalendarDayEvent, Competition } from "@/lib/types";

/** Calendario operativo derivado de campeonatos en BD (sin datos demo). */
export function calendarEventsFromCompetitions(
  competitions: Competition[],
): Record<string, CalendarDayEvent> {
  const out: Record<string, CalendarDayEvent> = {};
  for (const c of competitions) {
    const label =
      c.nombre.length > 28 ? `${c.nombre.slice(0, 26).trim()}…` : c.nombre;
    out[c.fecha] = {
      id: c.id,
      label,
      tipo: c.tipo,
      estado: c.estado,
    };
  }
  return out;
}
