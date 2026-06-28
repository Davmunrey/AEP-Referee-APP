import type { Competition } from "@/lib/types";
import { isRosterLockedByApproval } from "@/lib/roster-coverage";

export type RosterRouteGuardFailure = {
  ok: false;
  status: 404 | 403 | 423;
  error: string;
};

export type RosterRouteGuardSuccess = { ok: true };

export type RosterRouteGuardResult = RosterRouteGuardSuccess | RosterRouteGuardFailure;

/** Lógica compartida por rutas POST de tarima (assign, template, submit, …). */
export function checkRosterMutationAllowed(
  comp: Pick<Competition, "fechaFin" | "fecha" | "aprobacion"> | null | undefined,
  userCanEdit: boolean,
): RosterRouteGuardResult {
  if (!comp) {
    return { ok: false, status: 404, error: "Competición no encontrada" };
  }
  if (!userCanEdit) {
    return { ok: false, status: 403, error: "Sin permiso en esta zona" };
  }
  if (isRosterLockedByApproval(comp.aprobacion)) {
    return {
      ok: false,
      status: 423,
      error:
        "La tarima está aprobada. Usa «Registrar imprevisto» en la cabecera para permitir cambios.",
    };
  }
  return { ok: true };
}
