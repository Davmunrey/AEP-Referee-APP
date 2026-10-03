import { todayIso } from "@/lib/business-date";
import type { Competition } from "@/lib/types";

/** Primer campeonato operativo para el acceso rápido «Tarima activa». */
export function pickActiveRosterHref(
  competitions: (Pick<Competition, "id" | "fecha" | "estado"> & { fechaFin?: string })[],
): string {
  if (competitions.length === 0) return "/competitions";

  // Día natural español: en UTC, entre medianoche y las 01:00–02:00 el
  // campeonato de hoy dejaba de contar como próximo.
  const today = todayIso();
  const sorted = [...competitions].sort((a, b) => a.fecha.localeCompare(b.fecha));
  // Vigente = no ha TERMINADO (`fechaFin`), no «empieza hoy o después»: un
  // campeonato de dos días que empezó ayer es justo el que se está arbitrando,
  // y antes se saltaba.
  const vigentes = sorted.filter((c) => (c.fechaFin || c.fecha) >= today);

  // Antes, si todos los próximos estaban completos, el atajo caía en el
  // campeonato incompleto MÁS ANTIGUO del calendario: con temporadas pasadas
  // importadas como histórico, «Tarima activa» llevaba a uno de hace años.
  // Ahora: el primer vigente sin completar, si no el primer vigente, y si no
  // hay ninguno, el último celebrado.
  const focus =
    vigentes.find((c) => c.estado !== "Completo") ?? vigentes[0] ?? sorted[sorted.length - 1];

  return focus ? `/competitions/${focus.id}` : "/competitions";
}
