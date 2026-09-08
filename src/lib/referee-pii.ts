import type { Referee, SessionUser } from "@/lib/types";

/**
 * Recorta los datos de contacto/domicilio de un juez para el rol `solo_ver`,
 * que es de solo lectura y no tiene ninguna necesidad operativa de la PII
 * (email, teléfono, dirección postal, coordenadas ni notas). El resto de roles
 * los conserva: el financiero necesita el domicilio para calcular kilometraje y
 * los delegados gestionan el censo. Minimización de datos por rol.
 *
 * Vive fuera de `api/referee-scope` porque las páginas del panel también tienen
 * que aplicarlo: son ellas las que entregan el censo al navegador, así que un
 * recorte que solo hicieran las rutas API no recorta nada en la práctica.
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
