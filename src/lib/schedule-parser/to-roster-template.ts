import {
  COMPETICION_ROLES_AEP1,
  COMPETICION_ROLES_AEP2,
  COMPETICION_ROLES_AEP2_LIFT,
  PESAJE_ROLES,
  cloneRosterRoles,
} from "@/lib/mock-data";
import type { EventType, RosterRole, RosterSession } from "@/lib/types";
import type { ParsedHorario, ParsedSession } from "./types";

function rolesForType(tipo: EventType): RosterRole[] {
  switch (tipo) {
    case "AEP-1":
      return cloneRosterRoles(COMPETICION_ROLES_AEP1);
    case "AEP-2":
      return cloneRosterRoles(COMPETICION_ROLES_AEP2_LIFT);
    case "AEP-3":
      return cloneRosterRoles(COMPETICION_ROLES_AEP2);
    default:
      return cloneRosterRoles(COMPETICION_ROLES_AEP1);
  }
}

function sessionToRoster(
  parsed: ParsedSession,
  tipo: EventType,
): RosterSession {
  return {
    sesion: parsed.sesion,
    nombre: parsed.nombre,
    dia: parsed.dia.short || parsed.dia.raw,
    categorias: parsed.categorias.length > 0
      ? parsed.categorias.map((c) => ({ ...c }))
      : [{ genero: "Hombres", pesos: parsed.rawCategoria ?? "" }],
    horarioCompeticion: parsed.horarioCompeticion ?? "",
    horarioPesaje: parsed.horarioPesaje ?? "",
    roles: rolesForType(tipo),
    pesajeRoles: cloneRosterRoles(PESAJE_ROLES),
    grupos:
      parsed.grupos.length > 0
        ? parsed.grupos.map((g) => ({
            nombre: g.nombre,
            categorias: g.categorias.map((c) => ({ ...c })),
            levantadores: g.levantadores,
          }))
        : undefined,
  };
}

/** Convierte un horario parseado en un `RosterSession[]` listo para guardar. */
export function parsedToRosterTemplate(
  parsed: ParsedHorario,
  tipo: EventType,
): RosterSession[] {
  return parsed.sessions.map((s) => sessionToRoster(s, tipo));
}
