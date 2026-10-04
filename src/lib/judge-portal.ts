/**
 * Lo que ve un juez en su portal, construido igual en los dos backends.
 *
 * Solo datos del propio juez, y de su ficha solo lo que le sirve (sin notas
 * internas, informes ni evaluaciones): el portal no es una ventana al censo.
 */
import { isCompetitionPast } from "@/lib/competition-status";
import { isRosterLockedByApproval } from "@/lib/roster-coverage";
import { ROLE_LABELS, parseSlotKey } from "@/lib/roster-template";
import { sessionOrder } from "@/lib/session-order";
import type { Competition, Referee, RefereeSanction, RosterSession } from "@/lib/types";

export interface PortalSession {
  /** Clave de la sesión en la plantilla (`S1`, `S2`…). */
  session: string;
  nombre: string;
  dia: string;
  horarioCompeticion: string;
  horarioPesaje: string;
  /** Funciones del juez en esa sesión («Juez central», «Pesaje»…). */
  roles: string[];
}

export interface PortalDesignation {
  competitionId: string;
  competitionName: string;
  tipo: Competition["tipo"];
  sede: string;
  zona?: string;
  fecha: string;
  fechaFin: string;
  sessions: PortalSession[];
}

export interface JudgePortalProfile {
  id: string;
  nombre: string;
  zona: string;
  nivel: Referee["nivel"];
  estado: Referee["estado"];
  licencia?: string;
  email?: string;
  telefono?: string;
  localidad?: string;
  antiguedad?: string;
}

export interface JudgePortalData {
  profile: JudgePortalProfile;
  activeSanction?: { fechaFin: string };
  /**
   * Designaciones en tarimas APROBADAS de campeonatos que no han terminado.
   * Un borrador no se enseña: la tarima cambia hasta que se aprueba, y un juez
   * que se ve designado se organiza el viaje.
   */
  upcoming: PortalDesignation[];
  /** Campeonatos ya celebrados en los que arbitró (más reciente primero). */
  past: PortalDesignation[];
}

export function portalProfileOf(r: Referee): JudgePortalProfile {
  return {
    id: r.id,
    nombre: r.nombre,
    zona: r.zona,
    nivel: r.nivel,
    estado: r.estado,
    licencia: r.licencia,
    email: r.email,
    telefono: r.telefono,
    localidad: r.localidad,
    antiguedad: r.antiguedad,
  };
}

export function buildPortalDesignations(
  competitions: (Competition & { template?: RosterSession[] })[],
  templatesById: Map<string, RosterSession[]>,
  slotKeysByCompetition: Map<string, string[]>,
): Pick<JudgePortalData, "upcoming" | "past"> {
  const upcoming: PortalDesignation[] = [];
  const past: PortalDesignation[] = [];

  for (const c of competitions) {
    const keys = slotKeysByCompetition.get(c.id) ?? [];
    if (keys.length === 0) continue;
    const isPast = isCompetitionPast(c);
    if (!isPast && !isRosterLockedByApproval(c.aprobacion)) continue;

    const template = templatesById.get(c.id) ?? [];
    const bySession = new Map<string, Set<string>>();
    for (const key of keys) {
      const parsed = parseSlotKey(key);
      if (!parsed) continue;
      const roles = bySession.get(parsed.session) ?? new Set<string>();
      roles.add(ROLE_LABELS[parsed.roleKey] ?? parsed.roleKey);
      bySession.set(parsed.session, roles);
    }
    const sessions: PortalSession[] = [...bySession.entries()]
      .map(([session, roles]) => {
        const t = template.find((s) => s.sesion === session);
        return {
          session,
          nombre: t?.nombre || session,
          dia: t?.dia ?? "",
          horarioCompeticion: t?.horarioCompeticion ?? "",
          horarioPesaje: t?.horarioPesaje ?? "",
          roles: [...roles].sort((a, b) => a.localeCompare(b, "es")),
        };
      })
      .sort((a, b) => sessionOrder(a.session) - sessionOrder(b.session));
    if (sessions.length === 0) continue;

    const item: PortalDesignation = {
      competitionId: c.id,
      competitionName: c.nombre,
      tipo: c.tipo,
      sede: c.sede,
      zona: c.zona,
      fecha: c.fecha,
      fechaFin: c.fechaFin,
      sessions,
    };
    (isPast ? past : upcoming).push(item);
  }

  upcoming.sort((a, b) => a.fecha.localeCompare(b.fecha));
  past.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { upcoming, past };
}

export function portalSanctionOf(s: RefereeSanction | undefined): JudgePortalData["activeSanction"] {
  if (!s) return undefined;
  return { fechaFin: s.fechaFin };
}
