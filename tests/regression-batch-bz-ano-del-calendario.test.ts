import { describe, expect, it } from "vitest";
import { calendarYearWarning, detectCalendarYear } from "@/lib/calendar-parser/detect-year";
import { parseAepCalendarCsv } from "@/lib/calendar-parser/parse-calendar-csv";
import { currentSeasonYear } from "@/lib/season";

/**
 * El año fecha la temporada ENTERA que se importa. Solo la cabecera es una
 * respuesta; las otras dos vías eran conjeturas, y ninguna lo decía:
 *
 *  - el primer «20xx» suelto del documento, que puede ser un código postal, un
 *    teléfono, el año de fundación de un club o un récord;
 *  - el reloj del proceso, que además es UTC en el servidor: importar a las
 *    00:30 del 1 de enero en España creaba la temporada entera en el año
 *    anterior.
 */

describe("de dónde sale el año del calendario", () => {
  it("la cabecera manda y no genera aviso", () => {
    const d = detectCalendarYear("CALENDARIO de COMPETICIONES 2027\notra cosa 1999");
    expect(d).toEqual({ year: 2027, source: "cabecera" });
    expect(calendarYearWarning(d)).toBeNull();
  });

  it("un 20xx suelto se usa, pero se avisa de que es una conjetura", () => {
    const d = detectCalendarYear("Club fundado en 2019\nSala 28001 Madrid");
    expect(d).toEqual({ year: 2019, source: "suelto" });
    expect(calendarYearWarning(d)).toMatch(/no aparece en la cabecera/i);
    expect(calendarYearWarning(d)).toContain("2019");
  });

  it("sin ningún año, se usa la temporada en curso y se dice", () => {
    const d = detectCalendarYear("Documento sin fechas reconocibles");
    expect(d.source).toBe("reloj");
    expect(d.year).toBe(currentSeasonYear());
    expect(calendarYearWarning(d)).toMatch(/no trae ningún año/i);
  });
});

describe("el aviso llega al preview de la importación", () => {
  it("un CSV sin cabecera de año avisa antes que ninguna otra cosa", () => {
    const csv = [
      "FECHA;COMPETICION;LOCALIDAD;ORGANIZADOR;NIVEL;DIVISIONES;MODALIDAD;EQUIPAMIENTO",
      "12/03;Open de Primavera;Madrid;Club Uno;AEP2;OPEN;P;R",
    ].join("\n");
    const out = parseAepCalendarCsv(csv);
    expect(out.warnings[0]).toMatch(/año/i);
  });

  it("con la cabecera puesta, ese aviso no aparece", () => {
    const csv = [
      "CALENDARIO de COMPETICIONES 2027",
      "FECHA;COMPETICION;LOCALIDAD;ORGANIZADOR;NIVEL;DIVISIONES;MODALIDAD;EQUIPAMIENTO",
      "12/03;Open de Primavera;Madrid;Club Uno;AEP2;OPEN;P;R",
    ].join("\n");
    const out = parseAepCalendarCsv(csv);
    expect(out.year).toBe(2027);
    expect(out.warnings.some((w) => /no aparece en la cabecera|no trae ningún año/i.test(w))).toBe(
      false,
    );
  });
});
