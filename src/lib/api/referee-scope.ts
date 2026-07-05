import { resolveZoneCode } from "@/lib/aep-zones";
import { jsonError } from "@/lib/api/route-utils";
import type { Referee, SessionUser } from "@/lib/types";
import { dataService } from "@/server/services";

function zonesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return (resolveZoneCode(a) ?? a) === (resolveZoneCode(b) ?? b);
}

/**
 * Recorta los datos de contacto/domicilio de un juez para el rol `solo_ver`,
 * que es de solo lectura y no tiene ninguna necesidad operativa de la PII
 * (email, teléfono, dirección postal, coordenadas ni notas). El resto de roles
 * los conserva: el financiero necesita el domicilio para calcular kilometraje y
 * los delegados gestionan el censo. Minimización de datos por rol.
 */
export function stripRefereePII<T extends Partial<Referee>>(referee: T, user: SessionUser): T {
  if (user.role !== "solo_ver") return referee;
  const {
    email: _email,
    telefono: _telefono,
    domicilio: _domicilio,
    domicilioLat: _lat,
    domicilioLng: _lng,
    notas: _notas,
    ...rest
  } = referee;
  return rest as T;
}

/** Aplica {@link stripRefereePII} a una lista de jueces. */
export function stripRefereeListPII<T extends Partial<Referee>>(
  referees: T[],
  user: SessionUser,
): T[] {
  if (user.role !== "solo_ver") return referees;
  return referees.map((r) => stripRefereePII(r, user));
}

/** 403 si delegado_zona intenta actuar fuera de su zona. */
export async function assertRefereeInUserZone(
  user: SessionUser,
  refereeId: string,
): Promise<Response | null> {
  if (user.role !== "delegado_zona") return null;
  // Fail-closed: un delegado de zona sin zona asignada no puede actuar.
  if (!user.zona) return jsonError("Tu cuenta no tiene zona asignada", 403);
  const referee = await dataService.getReferee(refereeId);
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
  const competition = await dataService.getCompetition(competitionId);
  if (!competition || !zonesMatch(competition.zona, user.zona)) {
    return jsonError("Sin permiso para esta competición", 403);
  }
  return null;
}
