import { ROLE_LABELS } from "@/lib/roster-template";
import type {
  Competition,
  RefereeCompetitionHistoryItem,
  RefereeCompetitionPosition,
  RoleKey,
  SlotFlags,
} from "@/lib/types";

export interface RefereeAssignmentHistoryRow {
  competitionId: string;
  slotKey: string;
  flags?: SlotFlags | Record<string, unknown> | null;
}

const ROLE_ORDER: RoleKey[] = [
  "central",
  "lateral",
  "ordenador",
  "speaker",
  "control",
  "jurado",
  "pesaje",
  "equipamiento",
  "material",
  "mesa",
  "liftingcast",
];

function sessionOrder(session: string): number {
  const number = Number(session.replace(/\D/g, ""));
  return Number.isFinite(number) && number > 0 ? number : Number.MAX_SAFE_INTEGER;
}

function roleOrder(roleKey: RoleKey): number {
  const index = ROLE_ORDER.indexOf(roleKey);
  return index >= 0 ? index : ROLE_ORDER.length;
}

function normalizeFlags(flags: RefereeAssignmentHistoryRow["flags"]): SlotFlags | undefined {
  if (!flags) return undefined;
  const normalized: SlotFlags = {
    compartido: Boolean(flags.compartido),
    intercambio: Boolean(flags.intercambio),
  };
  return normalized.compartido || normalized.intercambio ? normalized : undefined;
}

export function parseRosterSlotPosition(
  slotKey: string,
  flags?: RefereeAssignmentHistoryRow["flags"],
): RefereeCompetitionPosition | null {
  const parts = slotKey.split("_");
  if (parts.length < 3) return null;
  const session = parts[0]!;
  const roleKey = parts[1] as RoleKey;
  const slotIndex = Number(parts[2]);
  return {
    slotKey,
    session,
    roleKey,
    roleLabel: ROLE_LABELS[roleKey] ?? roleKey,
    slotIndex: Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : 0,
    flags: normalizeFlags(flags),
  };
}

export function buildRefereeCompetitionHistory(
  competitions: Competition[],
  assignments: RefereeAssignmentHistoryRow[],
): RefereeCompetitionHistoryItem[] {
  const competitionById = new Map(competitions.map((competition) => [competition.id, competition]));
  const byCompetition = new Map<string, RefereeCompetitionPosition[]>();

  for (const assignment of assignments) {
    const position = parseRosterSlotPosition(assignment.slotKey, assignment.flags);
    if (!position) continue;
    const bucket = byCompetition.get(assignment.competitionId) ?? [];
    bucket.push(position);
    byCompetition.set(assignment.competitionId, bucket);
  }

  return [...byCompetition.entries()]
    .map(([competitionId, positions]) => {
      const competition = competitionById.get(competitionId);
      if (!competition) return null;
      const sortedPositions = [...positions].sort((a, b) => {
        const bySession = sessionOrder(a.session) - sessionOrder(b.session);
        if (bySession !== 0) return bySession;
        const byRole = roleOrder(a.roleKey) - roleOrder(b.roleKey);
        if (byRole !== 0) return byRole;
        return a.slotIndex - b.slotIndex;
      });
      const roles = [...new Set(sortedPositions.map((position) => position.roleLabel))].sort(
        (a, b) => a.localeCompare(b, "es"),
      );
      return {
        competitionId,
        competitionName: competition.nombre,
        tipo: competition.tipo,
        fecha: competition.fecha,
        fechaFin: competition.fechaFin,
        sede: competition.sede,
        estado: competition.estado,
        aprobacion: competition.aprobacion,
        roles,
        positions: sortedPositions,
        slotCount: sortedPositions.length,
      } satisfies RefereeCompetitionHistoryItem;
    })
    .filter((item): item is RefereeCompetitionHistoryItem => Boolean(item))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
