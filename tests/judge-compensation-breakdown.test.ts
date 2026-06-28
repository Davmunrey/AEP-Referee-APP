import { describe, expect, it } from "vitest";
import {
  buildClaimBreakdown,
  formatDutySessionsSummary,
  groupDutiesBySession,
} from "@/lib/judge-compensation/breakdown";
import type { CompensationDutyLine } from "@/lib/judge-compensation/types";

const duties: CompensationDutyLine[] = [
  {
    dutyType: "session",
    session: "S2",
    roleKey: "central",
    roleLabel: "Juez Central",
    unitAmount: 30,
    quantity: 1,
    amount: 30,
    slotKeys: ["S2:central:1"],
  },
  {
    dutyType: "pesaje",
    session: "S1",
    roleKey: "pesaje",
    roleLabel: "Pesaje",
    unitAmount: 15,
    quantity: 1,
    amount: 15,
    slotKeys: ["S1:pesaje:1"],
  },
  {
    dutyType: "session",
    session: "S1",
    roleKey: "central",
    roleLabel: "Juez Central",
    unitAmount: 30,
    quantity: 1,
    amount: 30,
    slotKeys: ["S1:central:1"],
  },
];

describe("compensation breakdown by session", () => {
  it("orders groups S1 before S2", () => {
    const groups = groupDutiesBySession(duties);
    expect(groups.map((g) => g.label)).toEqual(["S1", "S2"]);
  });

  it("puts tarima before pesaje within same session", () => {
    const groups = groupDutiesBySession(duties);
    const s1 = groups.find((g) => g.label === "S1");
    expect(s1?.lines.map((l) => l.roleLabel)).toEqual(["Juez Central", "Pesaje"]);
  });

  it("labels lines as Sx · posición en tarima", () => {
    const lines = buildClaimBreakdown({
      dutyLines: duties,
      travelMode: "none",
      travelAmount: 0,
      lodgingAmount: 0,
      lodgingDays: 0,
      competitionManagerAmount: 0,
      computerSetupAmount: 0,
    } as never);
    expect(lines[0]?.label).toBe("S1 · Juez Central");
    expect(lines[1]?.label).toBe("S1 · Pesaje");
    expect(lines[2]?.label).toBe("S2 · Juez Central");
  });

  it("formats session summary compact with position abbreviations", () => {
    expect(formatDutySessionsSummary({ dutyLines: duties })).toBe("S1(Cent+Pz) · S2");
  });
});
