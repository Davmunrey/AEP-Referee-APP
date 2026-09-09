import { canEditRoster } from "@/lib/auth/session";
import { jsonError, jsonRouteError } from "@/lib/api/route-utils";
import { checkRosterMutationAllowed } from "@/lib/roster-route-guards";
import type { Competition, SessionUser } from "@/lib/types";
import { dataService } from "@/server/services";

/** Devuelve una Response de error o `null` si la mutación de tarima está permitida. */
export function guardRosterWrite(
  comp: Pick<Competition, "zona" | "fecha" | "fechaFin" | "aprobacion"> | null | undefined,
  user: SessionUser,
) {
  const guard = checkRosterMutationAllowed(comp, canEditRoster(user, comp?.zona));
  if (!guard.ok) return jsonError(guard.error, guard.status);
  return null;
}

/**
 * Las cuatro líneas con que empieza toda mutación de tarima, en una:
 *
 *   const comp = await dataService.getCompetition(id);
 *   const blocked = guardRosterWrite(comp, user);
 *   if (blocked) return blocked;
 *   if (!comp) return jsonError("Competición no encontrada", 404);
 *
 * Estaban copiadas en ocho rutas, y ninguna tenía la lectura dentro de un
 * `try`. `getCompetition` ya no se traga el error de lectura, así que sin esto
 * un corte saldría de Next como un 500 sin cuerpo JSON.
 *
 * Devuelve el campeonato, o la `Response` que hay que devolver tal cual.
 */
export async function loadCompetitionForRosterWrite(
  competitionId: string,
  user: SessionUser,
  scope: string,
): Promise<Competition | Response> {
  let comp: Competition | undefined;
  try {
    comp = await dataService.getCompetition(competitionId);
  } catch (err) {
    return jsonRouteError(scope, err, "No se pudo cargar el campeonato");
  }
  const blocked = guardRosterWrite(comp, user);
  if (blocked) return blocked;
  if (!comp) return jsonError("Competición no encontrada", 404);
  return comp;
}
