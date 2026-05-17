import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseJudgesRegistryXlsx } from "@/lib/judges-registry";
import {
  mapExcelActivo,
  mapExcelLevel,
  mapExcelZone,
  refereeIdFromExcelId,
} from "@/lib/judges-registry/maps";

const MASTER_XLSX = "/Users/mac/Downloads/Copia de Control jueces.xlsx";

describe("judges registry maps", () => {
  it("maps excel zones to geographic codes", () => {
    expect(mapExcelZone("1-NOROESTE")).toBe("N1");
    expect(mapExcelZone("2- CENTRO")).toBe("CENTRO");
    expect(mapExcelZone("3- MEDITERRANEO")).toBe("LEV");
    expect(mapExcelZone("4- ANDALUCIA")).toBe("SUR");
    expect(mapExcelZone("5- CANARIAS")).toBe("CAN");
  });

  it("overrides zone from Madrid locality", () => {
    expect(mapExcelZone("2- CENTRO", "Madrid")).toBe("MAD");
  });

  it("maps levels and ERA names", () => {
    expect(mapExcelLevel("IPF 2")).toBe("IPF Cat. 2");
    expect(mapExcelLevel("Nacional")).toBe("Nacional");
    expect(mapExcelLevel("")).toBe("Regional");
    expect(mapExcelActivo(true, "ERA Test").estado).toBe("Inactivo");
    expect(mapExcelActivo(true, "Juan Pérez").estado).toBe("Activo");
  });

  it("builds stable referee ids", () => {
    expect(refereeIdFromExcelId(42)).toBe("j-42");
  });
});

describe("parseJudgesRegistryXlsx", () => {
  if (!existsSync(MASTER_XLSX)) {
    it.skip("local Control jueces.xlsx not found", () => {});
    return;
  }

  const parsed = parseJudgesRegistryXlsx(readFileSync(MASTER_XLSX).buffer);

  it("parses judges from Datos sheet", () => {
    expect(parsed.referees.length).toBeGreaterThanOrEqual(80);
    const first = parsed.referees.find((r) => r.excelId === 1);
    expect(first?.id).toBe("j-1");
    expect(first?.nombre.length).toBeGreaterThan(2);
    expect(["N1", "CENTRO", "MAD", "CAT", "LEV", "SUR", "CAN"]).toContain(first?.zona);
  });

  it("parses 2026 competitions", () => {
    expect(parsed.competitions.length).toBeGreaterThanOrEqual(10);
    expect(parsed.competitions.every((c) => c.tipo.startsWith("AEP-"))).toBe(true);
  });
});
