import type { Competition } from "@/lib/types";

/** Primer campeonato operativo para el acceso rápido «Tarima activa». */
export function pickActiveRosterHref(
  competitions: Pick<Competition, "id" | "fecha" | "estado">[],
): string {
  if (competitions.length === 0) return "/events";

  const today = new Date().toISOString().slice(0, 10);
  const sorted = [...competitions].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const focus =
    sorted.find((c) => c.estado !== "Completo" && c.fecha >= today) ??
    sorted.find((c) => c.estado !== "Completo") ??
    sorted.find((c) => c.fecha >= today) ??
    sorted[0];

  return focus ? `/events/${focus.id}` : "/events";
}
