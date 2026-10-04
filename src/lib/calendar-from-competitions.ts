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

/**
 * Calendario operativo derivado de campeonatos en BD (sin datos demo).
 *
 * Cada día lleva una lista: antes era un solo evento por fecha y la asignación
 * pisaba al anterior, así que de dos campeonatos el mismo día —cosa normal con
 * cinco zonas— el calendario solo enseñaba uno y el otro desaparecía sin rastro.
 */
export function calendarEventsFromCompetitions(
  competitions: Competition[],
): Record<string, CalendarDayEvent[]> {
  const out: Record<string, CalendarDayEvent[]> = {};
  // Orden estable: primero lo que empieza antes y, a igual inicio, lo que dura
  // más. Así un campeonato de varios días ocupa la misma fila en todos sus días
  // en lugar de saltar de posición según quién más caiga ese día.
  const ordered = [...competitions].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (b.fechaFin || b.fecha).localeCompare(a.fechaFin || a.fecha) ||
      a.nombre.localeCompare(b.nombre, "es") ||
      a.id.localeCompare(b.id),
  );
  for (const c of ordered) {
    // Nombre entero: antes se cortaba aquí a 28 caracteres y el recorte acababa
    // también en el título emergente, donde sí cabe completo.
    const label = c.nombre;
    const start = parseIsoDate(c.fecha);
    const end = parseIsoDate(c.fechaFin || c.fecha);
    if (!start || !end || end < start) continue;

    const days = Math.min(
      MAX_RANGE_DAYS,
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );
    for (let i = 0; i < days; i++) {
      const key = isoDate(addDays(start, i));
      const day = (out[key] ??= []);
      day.push({
        id: c.id,
        label,
        sede: c.sede || undefined,
        zona: c.zona || undefined,
        tipo: c.tipo,
        estado: c.estado,
        fecha: c.fecha,
        fechaFin: c.fechaFin || c.fecha,
        rangePosition:
          days === 1 ? "single" : i === 0 ? "start" : i === days - 1 ? "end" : "middle",
      });
    }
  }
  return out;
}
