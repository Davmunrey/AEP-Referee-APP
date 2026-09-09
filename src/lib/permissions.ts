import { resolveZoneCode } from "@/lib/aep-zones";
import type { SessionUser } from "@/lib/types";

/** Puede crear campeonatos y abrir el formulario `/competitions/new`. */
export function canCreateCompetition(role: SessionUser["role"]): boolean {
  return (
    role === "super_admin" || role === "delegado_jueces" || role === "delegado_zona"
  );
}

/**
 * Limpiar campeonatos duplicados del calendario.
 *
 * Borra filas, así que se queda en el ámbito nacional. Estaba escrito a mano
 * dentro de la ruta como `role !== "super_admin" && role !== "delegado_jueces"`.
 */
export function canDedupeCompetitions(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "delegado_jueces";
}

/** Importar calendario PDF AEP. */
export function canImportCalendar(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "delegado_jueces";
}

/** Importar Excel maestro «Control jueces». */
export function canImportJudgesRegistry(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "delegado_jueces";
}

/** Imponer o revocar sanciones a jueces. */
export function canManageSanctions(
  user: SessionUser,
  refereeZona?: string,
): boolean {
  if (user.role === "solo_ver") return false;
  if (user.role === "super_admin" || user.role === "delegado_jueces") return true;
  if (user.role === "delegado_zona" && user.zona && refereeZona) {
    // `undefined === undefined` es `true`: con la zona del delegado y la del
    // juez ilegibles —dos zonas distintas y ajenas—, esto daba permiso. Y
    // sancionar deja al juez no disponible para designaciones. Su hermana
    // `canEditRoster` ya cortaba con este mismo `!!`; esta no.
    const userZone = resolveZoneCode(user.zona);
    return !!userZone && userZone === resolveZoneCode(refereeZona);
  }
  return false;
}
