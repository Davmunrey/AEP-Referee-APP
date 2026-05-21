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

const MACRO_ZONES = [
  "NOROESTE",
  "CENTRO",
  "MEDITERRANEO",
  "ANDALUCIA",
  "CANARIAS",
] as const;

describe("judges registry maps", () => {
  it("maps excel zones to macro codes", () => {
    expect(mapExcelZone("1-NOROESTE")).toBe("NOROESTE");
    expect(mapExcelZone("2- CENTRO")).toBe("CENTRO");
    expect(mapExcelZone("3- MEDITERRANEO")).toBe("MEDITERRANEO");
    expect(mapExcelZone("4- ANDALUCIA")).toBe("ANDALUCIA");
    expect(mapExcelZone("5- CANARIAS")).toBe("CANARIAS");
  });

  it("does not override excel zone from locality", () => {
    expect(mapExcelZone("3- MEDITERRANEO", "Tarragona", "Tarragona")).toBe(
      "MEDITERRANEO",
    );
    expect(mapExcelZone("2- CENTRO", "Madrid", "Madrid")).toBe("CENTRO");
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
  it("rejects non-xlsx input before parser work", () => {
    const bad = new TextEncoder().encode("not an xlsx").buffer;
    expect(() => parseJudgesRegistryXlsx(bad)).toThrow(/Formato Excel no válido/);
  });

  it("rejects oversized xlsx input", () => {
    const bad = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer;
    expect(() => parseJudgesRegistryXlsx(bad, { maxBytes: 4 })).toThrow(/demasiado grande/);
  });

  if (!existsSync(MASTER_XLSX)) {
    it.skip("local Control jueces.xlsx not found", () => {});
    return;
  }

  const localBuffer = readFileSync(MASTER_XLSX);
  const parsed = parseJudgesRegistryXlsx(
    localBuffer.buffer.slice(
      localBuffer.byteOffset,
      localBuffer.byteOffset + localBuffer.byteLength,
    ),
  );

  it("parses judges from Datos sheet", () => {
    expect(parsed.referees.length).toBeGreaterThanOrEqual(80);
    const first = parsed.referees.find((r) => r.excelId === 1);
    expect(first?.id).toBe("j-1");
    expect(first?.nombre.length).toBeGreaterThan(2);
    expect(MACRO_ZONES).toContain(first?.zona);
  });

  it("parses 2026 competitions", () => {
    expect(parsed.competitions.length).toBeGreaterThanOrEqual(10);
    expect(parsed.competitions.every((c) => c.tipo.startsWith("AEP-"))).toBe(true);
    expect(parsed.competitions.every((c) => MACRO_ZONES.includes(c.zona))).toBe(
      true,
    );
  });
});
