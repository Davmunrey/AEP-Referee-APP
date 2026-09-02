import { todayIso } from "@/lib/business-date";
import type { Competition } from "@/lib/types";

/** Primer campeonato operativo para el acceso rápido «Tarima activa». */
export function pickActiveRosterHref(
  competitions: Pick<Competition, "id" | "fecha" | "estado">[],
): string {
  if (competitions.length === 0) return "/competitions";

  // Día natural español: en UTC, entre medianoche y las 01:00–02:00 el
  // campeonato de hoy dejaba de contar como próximo.
  const today = todayIso();
  const sorted = [...competitions].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const focus =
    sorted.find((c) => c.estado !== "Completo" && c.fecha >= today) ??
    sorted.find((c) => c.estado !== "Completo") ??
    sorted.find((c) => c.fecha >= today) ??
    sorted[0];

  return focus ? `/competitions/${focus.id}` : "/competitions";
}
