import { canEditRoster } from "@/lib/auth/session";
import { jsonError } from "@/lib/api/route-utils";
import { checkRosterMutationAllowed } from "@/lib/roster-route-guards";
import type { Competition, SessionUser } from "@/lib/types";

/** Devuelve una Response de error o `null` si la mutación de tarima está permitida. */
export function guardRosterWrite(
  comp: Pick<Competition, "zona" | "fecha" | "fechaFin" | "aprobacion"> | null | undefined,
  user: SessionUser,
) {
  const guard = checkRosterMutationAllowed(comp, canEditRoster(user, comp?.zona));
  if (!guard.ok) return jsonError(guard.error, guard.status);
  return null;
}
