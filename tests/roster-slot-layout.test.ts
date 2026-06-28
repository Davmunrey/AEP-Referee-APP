import { describe, expect, it } from "vitest";
import {
  COMPETICION_ROLES_AEP1,
  COMPETICION_ROLES_AEP2,
  COMPETICION_ROLES_AEP2_LIFT,
  GEN_ROLES_AEP23,
  PESAJE_ROLES,
  cloneRosterRoles,
} from "@/lib/mock-data";
import { buildCompetitionSlotLayout, buildPesajeSlotLayout } from "@/lib/roster-slot-layout";

describe("buildCompetitionSlotLayout", () => {
  it("places central and two laterals in one 3-column tarima row", () => {
    const rows = buildCompetitionSlotLayout(cloneRosterRoles(COMPETICION_ROLES_AEP2));
    expect(rows[0]?.cells).toHaveLength(3);
    expect(rows[0]?.cells[0]?.role.key).toBe("central");
    expect(rows[0]?.cells[1]?.role.key).toBe("lateral");
    expect(rows[0]?.cells[2]?.role.key).toBe("lateral");
    expect(rows[0]?.cells[1]?.slotIndex).toBe(0);
    expect(rows[0]?.cells[2]?.slotIndex).toBe(1);
  });

  it("places liftingcast, control and mesa in the second row", () => {
    const rows = buildCompetitionSlotLayout(cloneRosterRoles(COMPETICION_ROLES_AEP2_LIFT));
    expect(rows[1]?.cells.map((c) => c?.role.key)).toEqual(["liftingcast", "control", "mesa"]);
  });

  it("places three jurado slots in a dedicated row for AEP-1", () => {
    const rows = buildCompetitionSlotLayout(cloneRosterRoles(COMPETICION_ROLES_AEP1));
    const juradoRow = rows.find((r) => r.label === "Jurado");
    expect(juradoRow?.cells).toHaveLength(3);
    expect(juradoRow?.cells.every((c) => c?.role.key === "jurado")).toBe(true);
  });

  it("covers every slot exactly once for GEN AEP-2/3 template", () => {
    const roles = cloneRosterRoles(GEN_ROLES_AEP23);
    const rows = buildCompetitionSlotLayout(roles);
    const refs = rows.flatMap((r) => r.cells.filter(Boolean));
    const expected = roles.reduce((n, r) => n + r.slots, 0);
    expect(refs).toHaveLength(expected);
  });
});

describe("buildPesajeSlotLayout", () => {
  it("lays out pesaje roles in up to 3 columns", () => {
    const rows = buildPesajeSlotLayout(cloneRosterRoles(PESAJE_ROLES));
    expect(rows[0]?.cells.map((c) => c?.role.key ?? null)).toEqual(["pesaje", "equipamiento", null]);
  });
});
