import { resolveZoneCode } from "@/lib/aep-zones";
import type { SessionUser } from "@/lib/types";

/** Puede crear campeonatos y abrir el formulario `/competitions/new`. */
export function canCreateCompetition(role: SessionUser["role"]): boolean {
  return (
    role === "super_admin" || role === "delegado_jueces" || role === "delegado_zona"
  );
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
    return resolveZoneCode(user.zona) === resolveZoneCode(refereeZona);
  }
  return false;
}
