import { zonesMatch } from "@/lib/aep-zones";
import { jsonError, jsonRouteError } from "@/lib/api/route-utils";
import type { SessionUser } from "@/lib/types";
import { dataService } from "@/server/services";

// Reexportado desde aquí para no tocar las rutas que ya lo importaban: la
// implementación vive en lib/referee-pii porque las páginas también la usan.
export { stripRefereePII, stripRefereeListPII } from "@/lib/referee-pii";

/** 403 si delegado_zona intenta actuar fuera de su zona. */
export async function assertRefereeInUserZone(
  user: SessionUser,
  refereeId: string,
): Promise<Response | null> {
  if (user.role !== "delegado_zona") return null;
  // Fail-closed: un delegado de zona sin zona asignada no puede actuar.
  if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  // Esta lectura decide un 403, así que un fallo suyo no puede pasar por «no
  // existe»: se dice, con cuerpo JSON, en vez de salir como un 500 pelado.
  let referee;
  try {
    referee = await dataService.getReferee(refereeId);
  } catch (err) {
    return jsonRouteError("referee-scope.juez", err, "No se pudo comprobar la zona del juez");
  }
  if (!referee || !zonesMatch(referee.zona, user.zona)) {
    return jsonError("Sin permiso para este juez", 403);
  }
  return null;
}

/** 403 si delegado_zona intenta leer/actuar sobre competición fuera de su zona. */
export async function assertCompetitionInUserZone(
  user: SessionUser,
  competitionId: string,
): Promise<Response | null> {
  if (user.role !== "delegado_zona") return null;
  if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  let competition;
  try {
    competition = await dataService.getCompetition(competitionId);
  } catch (err) {
    return jsonRouteError(
      "referee-scope.competicion",
      err,
      "No se pudo comprobar la zona del campeonato",
    );
  }
  if (!competition || !zonesMatch(competition.zona, user.zona)) {
    return jsonError("Sin permiso para esta competición", 403);
  }
  return null;
}
