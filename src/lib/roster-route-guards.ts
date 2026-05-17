import { isCompetitionPast } from "@/lib/competition-status";
import type { Competition } from "@/lib/types";

export type RosterRouteGuardFailure = {
  ok: false;
  status: 404 | 403 | 423;
  error: string;
};

export type RosterRouteGuardSuccess = { ok: true };

export type RosterRouteGuardResult = RosterRouteGuardSuccess | RosterRouteGuardFailure;

/** Lógica compartida por rutas POST de tarima (assign, template, submit, …). */
export function checkRosterMutationAllowed(
  comp: Pick<Competition, "fechaFin" | "fecha"> | null | undefined,
  userCanEdit: boolean,
): RosterRouteGuardResult {
  if (!comp) {
    return { ok: false, status: 404, error: "Competición no encontrada" };
  }
  if (!userCanEdit) {
    return { ok: false, status: 403, error: "Sin permiso en esta zona" };
  }
  if (isCompetitionPast(comp)) {
    return { ok: false, status: 423, error: "Campeonato finalizado: solo lectura" };
  }
  return { ok: true };
}
