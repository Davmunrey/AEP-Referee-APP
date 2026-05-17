import type { SessionUser, UserRole } from "@/lib/types";

export interface ProfileRow {
  id: string;
  email: string;
  nombre: string;
  rol_label: string;
  iniciales: string;
  role: UserRole;
  zona: string | null;
  activo: boolean;
}

export function profileToSessionUser(row: ProfileRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    nombre: row.nombre,
    rol: row.rol_label,
    iniciales: row.iniciales,
    role: row.role,
    zona: row.zona ?? undefined,
  };
}

export function orgLabelForUser(user: SessionUser): { org: string; subtitle: string } {
  if (user.role === "super_admin") {
    return { org: "AEP Nacional", subtitle: user.rol };
  }
  if (user.role === "delegado_jueces") {
    return { org: "AEP · Comité de Jueces", subtitle: user.rol };
  }
  if (user.role === "delegado_zona" && user.zona) {
    return { org: `AEP Regional · ${user.zona}`, subtitle: user.rol };
  }
  return { org: "AEP Consulta", subtitle: user.rol };
}
