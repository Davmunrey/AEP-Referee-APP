import { resolveZoneCode } from "@/lib/aep-zones";
import type { AepMacroZoneId } from "@/lib/aep-zones";
import type { SessionUser } from "@/lib/types";

/**
 * Ámbito de zona de un usuario, con los tres casos separados.
 *
 * El código repetía en ocho sitios esta forma:
 *
 *     const userZone =
 *       user.role === "delegado_zona" && user.zona ? resolveZoneCode(user.zona) : undefined;
 *     …filter((x) => !userZone || resolveZoneCode(x.zona) === userZone)
 *
 * Y ahí `undefined` significaba dos cosas que no son la misma: «este usuario
 * no tiene que ver una parte» (un super admin) y «es delegado de zona pero su
 * zona NO se reconoce». Las dos caían en el `!userZone`, así que un delegado
 * con la zona mal escrita en su perfil pasaba a verlo todo.
 */
export type ZoneScope =
  /** Sin restricción: ve todo (super admin, delegado de jueces, financiero…). */
  | { kind: "all" }
  /** Restringido a una zona concreta. */
  | { kind: "zone"; code: AepMacroZoneId }
  /** Es delegado de zona y su zona no se puede resolver: no ve nada. */
  | { kind: "unresolved" };

export function zoneScopeOf(user: SessionUser | null | undefined): ZoneScope {
  if (user?.role !== "delegado_zona") return { kind: "all" };
  const code = resolveZoneCode(user.zona);
  return code ? { kind: "zone", code } : { kind: "unresolved" };
}

/**
 * Predicado listo para `filter`: qué filas de esa zona puede ver el usuario.
 *
 * Un ámbito irresoluble devuelve siempre `false`. Eso deja al delegado con la
 * zona mal escrita sin ver nada, que es incómodo pero honesto: la alternativa
 * era enseñarle el censo y el calendario de todas las zonas.
 */
export function zoneVisibilityFilter(
  user: SessionUser | null | undefined,
): (zona: string | null | undefined) => boolean {
  const scope = zoneScopeOf(user);
  if (scope.kind === "all") return () => true;
  if (scope.kind === "unresolved") return () => false;
  return (zona) => resolveZoneCode(zona) === scope.code;
}
