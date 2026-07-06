import { describe, expect, it } from "vitest";
import { currentSeasonYear, operationalQuarterLabel, seasonLabel } from "@/lib/season";

describe("season utilities", () => {
  it("season equals the calendar year (no July shift)", () => {
    expect(currentSeasonYear(new Date(2026, 0, 1))).toBe(2026);
    expect(currentSeasonYear(new Date(2026, 5, 1))).toBe(2026);
    expect(currentSeasonYear(new Date(2026, 6, 1))).toBe(2026);
    expect(currentSeasonYear(new Date(2026, 11, 31))).toBe(2026);
  });

  it("builds human-readable season label", () => {
    expect(seasonLabel(2028)).toBe("temporada 2028");
  });

  it("maps calendar months to operational quarters", () => {
    expect(operationalQuarterLabel(new Date(2026, 4, 1))).toBe("T2 2026");
    expect(operationalQuarterLabel(new Date(2026, 11, 1))).toBe("T4 2026");
  });
});
