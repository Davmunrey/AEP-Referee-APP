import type { SessionUser } from "@/lib/types";

/** Puede crear campeonatos y abrir el formulario `/events/new`. */
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

/** Gestión de usuarios en `/admin/users`. */
export function canManageUsers(role: SessionUser["role"]): boolean {
  return role === "super_admin" || role === "delegado_jueces";
}
