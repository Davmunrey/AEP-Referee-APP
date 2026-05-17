import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAepCalendarText } from "@/lib/calendar-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/calendario-aep-2026.txt"),
  "utf8",
);

describe("parseAepCalendarText", () => {
  const parsed = parseAepCalendarText(FIXTURE);

  it("detecta el año del calendario", () => {
    expect(parsed.year).toBe(2026);
  });

  it("extrae al menos 30 entradas", () => {
    expect(parsed.entries.length).toBeGreaterThanOrEqual(30);
  });

  it("filtra correctamente España vs extranjero", () => {
    const espanol = parsed.entries.filter((e) => e.esEspaña);
    const extranjero = parsed.entries.filter((e) => !e.esEspaña);
    expect(espanol.length).toBeGreaterThan(0);
    expect(extranjero.length).toBeGreaterThan(0);
    // EPF / IPF no deben colarse
    expect(espanol.every((e) => e.tipo && ["AEP-1", "AEP-2", "AEP-3"].includes(e.tipo))).toBe(true);
  });

  it("parsea fechas single y rango", () => {
    const single = parsed.entries.find((e) => e.rawDate === "17-ene");
    expect(single?.fechaInicio).toBe("2026-01-17");
    expect(single?.fechaFin).toBe("2026-01-17");

    const sameMonth = parsed.entries.find((e) => e.rawDate === "24-25 ene");
    expect(sameMonth?.fechaInicio).toBe("2026-01-24");
    expect(sameMonth?.fechaFin).toBe("2026-01-25");

    const cross = parsed.entries.find((e) => e.rawDate === "28-01 feb-mar");
    expect(cross?.fechaInicio).toBe("2026-02-28");
    expect(cross?.fechaFin).toBe("2026-03-01");
  });

  it("deduce zonas a partir de la provincia", () => {
    const madrid = parsed.entries.find((e) => /Black Crown/i.test(e.nombre));
    expect(madrid?.zona).toBe("MAD");

    const malaga = parsed.entries.find((e) => /Guadalteba/i.test(e.nombre));
    expect(malaga?.zona).toBe("AND");
  });

  it("excluye campeonatos europeos / mundiales", () => {
    const epf = parsed.entries.find((e) => /EUROPEAN/i.test(e.nombre));
    expect(epf?.tipo).toBeNull();
    expect(epf?.esEspaña).toBe(false);
  });

  it("preserva el nombre del Campeonato de ESPAÑA", () => {
    const cto = parsed.entries.find((e) =>
      /Campeonato de ESPAÑA de Press Banca/i.test(e.nombre),
    );
    expect(cto?.tipo).toBe("AEP-1");
    expect(cto?.esEspaña).toBe(true);
  });
});
