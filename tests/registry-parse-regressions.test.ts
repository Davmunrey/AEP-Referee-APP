import { describe, expect, it } from "vitest";
import { excelDateToIso, parseCompetitionDateRange } from "@/lib/judges-registry/parse-dates";
import { parseCampeonatosCsv } from "@/lib/judges-registry/parse-csv";
import { mapExcelLevel } from "@/lib/judges-registry/maps";

describe("excelDateToIso — validación de rangos", () => {
  it("rechaza fechas con mes fuera de rango (formato US colado)", () => {
    expect(excelDateToIso("05/13/2026")).toBeUndefined();
    expect(excelDateToIso("00/10/2026")).toBeUndefined();
    expect(excelDateToIso("32/01/2026")).toBeUndefined();
  });

  it("acepta DD/MM válidos con año de 2 y 4 dígitos", () => {
    expect(excelDateToIso("13/05/2026")).toBe("2026-05-13");
    expect(excelDateToIso("1/3/26")).toBe("2026-03-01");
  });
});

describe("parseCompetitionDateRange — rango que cruza el año", () => {
  it("31-Dic/01-Ene-26 empieza en 2025 y termina en 2026", () => {
    const range = parseCompetitionDateRange("31-Dic/01-Ene-26");
    expect(range).toEqual({ fecha: "2025-12-31", fechaFin: "2026-01-01" });
  });

  it("los rangos dentro del mismo año no cambian", () => {
    expect(parseCompetitionDateRange("28-Feb/01-Mar-26")).toEqual({
      fecha: "2026-02-28",
      fechaFin: "2026-03-01",
    });
  });
});

describe("parseCampeonatosCsv — separador ; del Excel español", () => {
  // Mismas columnas que el Excel real: Nº, Nombre, Localidad, Provincia,
  // Zona, Nivel, Fecha Completa, Fecha.
  const HEADER_SEMI =
    "Nº Camp;Nombre Camp;Localidad;Provincia;Zona;Nivel;Fecha Complet;Fecha";
  const ROW_SEMI = "1;Campeonato CSV Prueba;Madrid;Madrid;2- CENTRO;AEP2;21/22-Mar-26;mar-26";

  it("detecta ; y parsea las filas igual que con comas", () => {
    const parsed = parseCampeonatosCsv(`${HEADER_SEMI}\n${ROW_SEMI}\n`);
    expect(parsed.competitions.length).toBe(1);
    expect(parsed.competitions[0]!.nombre).toContain("Campeonato CSV Prueba");
  });

  it("los CSV con comas siguen funcionando", () => {
    const parsed = parseCampeonatosCsv(
      "Nº Camp,Nombre Camp,Localidad,Provincia,Zona,Nivel,Fecha Complet,Fecha\n" +
        "1,Campeonato Coma,Madrid,Madrid,2- CENTRO,AEP2,21/22-Mar-26,mar-26\n",
    );
    expect(parsed.competitions.length).toBe(1);
  });
});

describe("mapExcelLevel — variantes reales de escritura", () => {
  it("reconoce las variantes IPF sin degradarlas a Regional", () => {
    expect(mapExcelLevel("IPF 2")).toBe("IPF Cat. 2");
    expect(mapExcelLevel("IPF Cat. 2")).toBe("IPF Cat. 2");
    expect(mapExcelLevel("IPF2")).toBe("IPF Cat. 2");
    expect(mapExcelLevel("IPF-1")).toBe("IPF Cat. 1");
    expect(mapExcelLevel("ipf cat. 1")).toBe("IPF Cat. 1");
    expect(mapExcelLevel("NACIONAL")).toBe("Nacional");
  });

  it("mantiene Regional como fallback", () => {
    expect(mapExcelLevel(undefined)).toBe("Regional");
    expect(mapExcelLevel("Internacional")).toBe("Regional");
  });
});
