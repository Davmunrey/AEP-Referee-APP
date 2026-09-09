import { describe, expect, it } from "vitest";
import { excelDateToIso, parseCompetitionDateRange } from "@/lib/judges-registry/parse-dates";

/**
 * Las fechas del censo se escriben a mano en un Excel, y de ahí salen la
 * antigüedad de cada juez y las fechas de los campeonatos importados.
 *
 * Dos cosas pasaban de largo: un día que no existe en su mes, y el año de dos
 * cifras, que se convertía siempre en 20xx.
 */

describe("un día que no existe en su mes", () => {
  it("«31/02/2026» ya no sale como 2026-02-31", () => {
    // El rango 1-31 no basta: la comprobación existía para «2026-13-05» y
    // dejaba pasar este.
    expect(excelDateToIso("31/02/2026")).toBeUndefined();
  });

  it("el 29 de febrero solo vale en año bisiesto", () => {
    expect(excelDateToIso("29/02/2024")).toBe("2024-02-29");
    expect(excelDateToIso("29/02/2026")).toBeUndefined();
  });

  it("el 31 de abril tampoco", () => {
    expect(excelDateToIso("31/04/2026")).toBeUndefined();
    expect(excelDateToIso("30/04/2026")).toBe("2026-04-30");
  });

  it("en una fila de campeonato, eso pasa a ser una fila descartada con aviso", () => {
    // El importador avisa y salta la fila cuando el rango no se reconoce; antes
    // se le colaba una fecha imposible.
    expect(parseCompetitionDateRange("31/02/2026")).toBeUndefined();
  });
});

describe("el año de dos cifras", () => {
  it("la antigüedad de un juez de 1985 ya no es de 2085", () => {
    expect(excelDateToIso("12/05/85")).toBe("1985-05-12");
    expect(excelDateToIso("01/01/99")).toBe("1999-01-01");
  });

  it("y una fecha reciente sigue siendo de este siglo", () => {
    expect(excelDateToIso("12/05/26")).toBe("2026-05-12");
    expect(excelDateToIso("31/12/09")).toBe("2009-12-31");
  });

  it("el mes en texto sigue el mismo convenio", () => {
    expect(excelDateToIso("12-may-85")).toBe("1985-05-12");
    expect(excelDateToIso("12-may-26")).toBe("2026-05-12");
  });
});

describe("lo que ya funcionaba sigue funcionando", () => {
  it("un rango que cruza el año conserva su lectura", () => {
    expect(parseCompetitionDateRange("31-Dic/01-Ene-26")).toEqual({
      fecha: "2025-12-31",
      fechaFin: "2026-01-01",
    });
  });

  it("dos días del mismo mes", () => {
    expect(parseCompetitionDateRange("21/22-Mar-26")).toEqual({
      fecha: "2026-03-21",
      fechaFin: "2026-03-22",
    });
  });
});
