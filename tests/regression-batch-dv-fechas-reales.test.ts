import { describe, expect, it } from "vitest";
import { isIsoDate, validateCompetitionFields } from "@/app/api/_lib/validation";

// Validar solo con el patrón AAAA-MM-DD dejaba pasar «2026-02-30»: en memoria
// se guardaba tal cual y en Supabase la columna DATE lo rechazaba con un 500.
describe("isIsoDate comprueba el calendario, no solo la forma", () => {
  it("rechaza días que no existen", () => {
    for (const f of ["2026-02-30", "2026-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00"]) {
      expect(isIsoDate(f), f).toBe(false);
    }
  });

  it("acepta los que sí, incluido el 29 de febrero bisiesto", () => {
    for (const f of ["2028-02-29", "2026-12-31", "2026-01-01"]) expect(isIsoDate(f), f).toBe(true);
  });

  it("rechaza lo que no es texto o no tiene la forma", () => {
    for (const f of [undefined, null, 20260101, "2026-1-1", "01/02/2026", ""]) expect(isIsoDate(f)).toBe(false);
  });

  it("los campeonatos lo usan al crear y al editar", () => {
    expect(validateCompetitionFields({ fecha: "2026-02-30", fechaFin: "2026-03-01" })).toMatch(/no es válida/);
    expect(validateCompetitionFields({ fechaFin: "2026-02-31" }, { fecha: "2026-02-01", fechaFin: "2026-02-02" })).toMatch(/no es válida/);
  });
});
