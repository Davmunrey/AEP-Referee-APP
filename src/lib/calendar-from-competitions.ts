import type { CalendarDayEvent, Competition } from "@/lib/types";

const MAX_RANGE_DAYS = 90;

function parseIsoDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/** Calendario operativo derivado de campeonatos en BD (sin datos demo). */
export function calendarEventsFromCompetitions(
  competitions: Competition[],
): Record<string, CalendarDayEvent> {
  const out: Record<string, CalendarDayEvent> = {};
  for (const c of competitions) {
    const label =
      c.nombre.length > 28 ? `${c.nombre.slice(0, 26).trim()}…` : c.nombre;
    const start = parseIsoDate(c.fecha);
    const end = parseIsoDate(c.fechaFin || c.fecha);
    if (!start || !end || end < start) continue;

    const days = Math.min(
      MAX_RANGE_DAYS,
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );
    for (let i = 0; i < days; i++) {
      const key = isoDate(addDays(start, i));
      out[key] = {
        id: c.id,
        label,
        tipo: c.tipo,
        estado: c.estado,
        fecha: c.fecha,
        fechaFin: c.fechaFin || c.fecha,
        rangePosition:
          days === 1 ? "single" : i === 0 ? "start" : i === days - 1 ? "end" : "middle",
      };
    }
  }
  return out;
}
