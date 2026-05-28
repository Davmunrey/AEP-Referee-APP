import type { AssignmentsMap, RosterSession, Zone } from "@/lib/types";
import { zoneUiName } from "@/lib/aep-zones";

export function zoneName(zones: Zone[], code: string) {
  return zoneUiName(zones.find((z) => z.code === code)?.code ?? code);
}

/** Agrupa sesiones por día preservando el orden. */
export function groupSessionsByDay(sessions: RosterSession[]): [string, RosterSession[]][] {
  const groups: [string, RosterSession[]][] = [];
  for (const s of sessions) {
    const dia = s.dia || "Sesiones";
    const existing = groups.find(([d]) => d === dia);
    if (existing) existing[1].push(s);
    else groups.push([dia, [s]]);
  }
  return groups;
}

export function summarizeSessionCategories(session: RosterSession) {
  const categories = (session.categorias ?? [])
    .map((category) => `${category.genero} ${category.pesos}`)
    .join(" · ");
  return categories || "Sin categorías";
}

export function summarizeSessionGroups(session: RosterSession) {
  return (session.grupos ?? [])
    .map((g) => {
      const categories = g.categorias.map((c) => `${c.genero} ${c.pesos}`).join(" · ");
      const total = typeof g.levantadores === "number" ? ` (${g.levantadores} lev.)` : "";
      return `${g.nombre}: ${categories || "—"}${total}`;
    })
    .join(" · ");
}

export function slotRoleEntries(session: RosterSession) {
  return [...session.roles, ...(session.pesajeRoles ?? [])];
}

export function sessionProgress(session: RosterSession, assignments: AssignmentsMap) {
  const allRoles = slotRoleEntries(session);
  const slots = allRoles.reduce((a, r) => a + r.slots, 0);
  let filled = 0;
  for (const role of allRoles) {
    for (let i = 0; i < role.slots; i++) {
      if (assignments[`${session.sesion}_${role.key}_${i}`]) filled++;
    }
  }
  const pct = slots > 0 ? Math.round((filled / slots) * 100) : 0;
  return { filled, slots, pct };
}

export function findNextOpenSlot(
  session: RosterSession,
  assignments: AssignmentsMap,
  afterSlotKey?: string,
) {
  const orderedSlots = slotRoleEntries(session).flatMap((role) =>
    Array.from({ length: role.slots }, (_, idx) => `${session.sesion}_${role.key}_${idx}`),
  );

  if (orderedSlots.length === 0) return null;
  const startIndex = afterSlotKey ? orderedSlots.indexOf(afterSlotKey) : -1;
  const rotated =
    startIndex >= 0
      ? [...orderedSlots.slice(startIndex + 1), ...orderedSlots.slice(0, startIndex + 1)]
      : orderedSlots;

  return rotated.find((slotKey) => !assignments[slotKey]) ?? null;
}

export function describeSlot(session: RosterSession, slotKey: string) {
  const [, roleKey, slotIndexRaw] = slotKey.split("_");
  const role = slotRoleEntries(session).find((entry) => entry.key === roleKey);
  if (!role) return null;
  return {
    slotKey,
    sessionLabel: session.sesion,
    roleLabel: role.rol,
    slotNumber: Number(slotIndexRaw) + 1,
  };
}

export function collectOpenSlots(session: RosterSession, assignments: AssignmentsMap) {
  return slotRoleEntries(session).flatMap((role) =>
    Array.from({ length: role.slots }, (_, idx) => {
      const slotKey = `${session.sesion}_${role.key}_${idx}`;
      if (assignments[slotKey]) return null;
      return {
        slotKey,
        sessionLabel: session.sesion,
        roleLabel: role.rol,
        slotNumber: idx + 1,
      };
    }).filter(Boolean) as Array<{
      slotKey: string;
      sessionLabel: string;
      roleLabel: string;
      slotNumber: number;
    }>,
  );
}
