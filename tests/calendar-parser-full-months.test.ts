import { describe, expect, it } from "vitest";
import { parseAepCalendarText } from "@/lib/calendar-parser";

/**
 * Regresión: los regex de fecha limitaban el nombre de mes a 3–5 letras, así
 * que los meses largos escritos completos («septiembre», «noviembre»…) nunca
 * casaban y la entrada se perdía sin aviso. Ahora aceptan 3–10 letras.
 */
const TEXT = `ASOCIACIÓN ESPAÑOLA DE POWERLIFTING
CALENDARIO de COMPETICIONES 2026

FECHA

12-septiembre

Campeonato de Prueba Septiembre

Madrid

ESPAÑA

AEP2

OPEN

7-8 noviembre

Campeonato de Prueba Noviembre

Sevilla

ESPAÑA

AEP1

OPEN

21-diciembre

Campeonato de Prueba Diciembre

Valencia

ESPAÑA

AEP3

OPEN
`;

describe("parser de calendario con nombres de mes completos", () => {
  const parsed = parseAepCalendarText(TEXT);

  it("reconoce una fecha simple con mes largo (12-septiembre)", () => {
    const entry = parsed.entries.find((e) => e.fechaInicio === "2026-09-12");
    expect(entry).toBeDefined();
    expect(entry?.fechaFin).toBe("2026-09-12");
  });

  it("reconoce un rango en el mismo mes largo (7-8 noviembre)", () => {
    const entry = parsed.entries.find((e) => e.fechaInicio === "2026-11-07");
    expect(entry).toBeDefined();
    expect(entry?.fechaFin).toBe("2026-11-08");
  });

  it("reconoce diciembre completo (21-diciembre)", () => {
    const entry = parsed.entries.find((e) => e.fechaInicio === "2026-12-21");
    expect(entry).toBeDefined();
  });

  it("las abreviaturas de siempre siguen funcionando", () => {
    const abbrev = parseAepCalendarText(
      "CALENDARIO de COMPETICIONES 2026\n\n17-ene\n\nCampeonato Abreviado\n\nValladolid\n\nESPAÑA\n\nAEP1\n\nOPEN\n",
    );
    expect(abbrev.entries.some((e) => e.fechaInicio === "2026-01-17")).toBe(true);
  });
});
