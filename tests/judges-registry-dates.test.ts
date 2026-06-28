import { describe, expect, it } from "vitest";
import { parseCompetitionDateRange, excelDateToIso } from "@/lib/judges-registry/parse-dates";
import { mapExcelZone } from "@/lib/judges-registry/maps";

describe("judges registry dates", () => {
  it("parses Spanish month dates", () => {
    expect(excelDateToIso("17-ene-26")).toBe("2026-01-17");
    expect(excelDateToIso("7-mar-26")).toBe("2026-03-07");
  });

  it("keeps local calendar day for Date objects (no UTC shift)", () => {
    const local = new Date(2026, 5, 1); // 1 Jun 2026 local
    expect(excelDateToIso(local)).toBe("2026-06-01");
  });

  it("parses dual-day ranges", () => {
    const r = parseCompetitionDateRange("21/22-Mar-26");
    expect(r?.fecha).toBe("2026-03-21");
    expect(r?.fechaFin).toBe("2026-03-22");
  });

  it("keeps Excel macro zone for Tarragona (not split by locality)", () => {
    expect(mapExcelZone("3- MEDITERRANEO", "Tarragona", "Tarragona")).toBe(
      "MEDITERRANEO",
    );
  });

  it("keeps Excel macro zone for Madrid in CENTRO", () => {
    expect(mapExcelZone("2- CENTRO", "Madrid", "Madrid")).toBe("CENTRO");
  });
});
