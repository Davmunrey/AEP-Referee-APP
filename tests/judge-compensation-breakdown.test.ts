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
    unitAmount: 30,
    quantity: 1,
    amount: 30,
    slotKeys: ["S2:central:1"],
  },
  {
    dutyType: "pesaje",
    session: "S1",
    unitAmount: 15,
    quantity: 1,
    amount: 15,
    slotKeys: ["S1:pesaje:1"],
  },
  {
    dutyType: "session",
    session: "S1",
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

  it("puts ordenador before pesaje within same session", () => {
    const groups = groupDutiesBySession(duties);
    const s1 = groups.find((g) => g.label === "S1");
    expect(s1?.lines.map((l) => l.kind)).toEqual(["ordenador", "pesaje"]);
  });

  it("labels lines as Sx · Ordenador / Pesaje", () => {
    const lines = buildClaimBreakdown({
      dutyLines: duties,
      travelMode: "none",
      travelAmount: 0,
      lodgingAmount: 0,
      lodgingDays: 0,
      competitionManagerAmount: 0,
    } as never);
    expect(lines[0]?.label).toBe("S1 · Ordenador");
    expect(lines[1]?.label).toBe("S1 · Pesaje");
    expect(lines[2]?.label).toBe("S2 · Ordenador");
  });

  it("formats session summary compact", () => {
    expect(formatDutySessionsSummary({ dutyLines: duties })).toBe("S1(O+P) · S2");
  });
});
