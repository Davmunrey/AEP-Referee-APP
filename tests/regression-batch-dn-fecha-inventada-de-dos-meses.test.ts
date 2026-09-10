import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAepCalendarText, parseAepCalendarCsv } from "@/lib/calendar-parser";
import { championshipDayCount } from "@/lib/judge-compensation/rates";
import { competitionDatesOverlap } from "@/lib/roster-conflicts";

/**
 * Una fila del calendario con el mes en vez del día.
 *
 * El calendario de la AEP trae filas cuya fecha es un rango de MESES —«OCT -
 * NOV **»— porque el día todavía no está decidido. El lector las resuelve al
 * día 1 del primer mes y al último del segundo para poder importarlas, y se
 * marca a sí mismo `pendiente: true` para decir que esa fecha NO es exacta.
 *
 * El aviso, en cambio, solo salía cuando además faltaba la fecha:
 *
 *     if (esEspaña && !dates.start) warnings.push(fechaPendienteWarning(…));
 *
 * Así que estas filas se importaban como un campeonato de DOS MESES sin que
 * nada lo dijera. Y eso no es un detalle de presentación: `championshipDayCount`
 * cuenta 61 días, y el mapa de choques compara rangos, así que ese campeonato
 * solapa con todos los de octubre y noviembre y marcaría a casi cualquier juez
 * como «ya asignado en otro campeonato de estas fechas».
 */

const CALENDARIO_REAL = readFileSync("tests/fixtures/calendario-aep-2026.txt", "utf8");

describe("el calendario AEP 2026 de verdad", () => {
  const parsed = parseAepCalendarText(CALENDARIO_REAL);
  const copa = parsed.entries.find((e) => e.nombre.includes("Copa de ESPAÑA de POWERLIFTING"));

  it("trae una fila con el rango de meses, y el lector la marca pendiente", () => {
    expect(copa?.pendiente).toBe(true);
    expect(copa?.fechaInicio).toBe("2026-10-01");
    expect(copa?.fechaFin).toBe("2026-11-30");
  });

  it("y ahora lo avisa, diciendo qué fechas va a poner", () => {
    const aviso = parsed.warnings.find(
      (w) => w.includes("Fecha pendiente") && w.includes("Copa de ESPAÑA de POWERLIFTING"),
    );
    expect(aviso).toBeDefined();
    expect(aviso).toContain("2026-10-01");
    expect(aviso).toContain("2026-11-30");
  });

  it("porque esa fecha inventada dura dos meses y choca con todo", () => {
    const dos_meses = { fecha: copa!.fechaInicio!, fechaFin: copa!.fechaFin! };
    expect(championshipDayCount(dos_meses.fecha, dos_meses.fechaFin)).toBe(61);
    // Cualquier campeonato de octubre o noviembre entra dentro.
    expect(
      competitionDatesOverlap(dos_meses, { fecha: "2026-10-03", fechaFin: "2026-10-04" }),
    ).toBe(true);
  });

  it("las filas que ya avisaban siguen avisando", () => {
    const pendientes = parsed.warnings.filter((w) => w.includes("Fecha pendiente"));
    expect(pendientes.some((w) => w.includes("AEP 3 - Tarragona"))).toBe(true);
    expect(pendientes.some((w) => w.includes("AEP 3 - Canarias"))).toBe(true);
  });

  it("y una fila con fecha exacta no gana ningún aviso", () => {
    const exacta = parsed.entries.find((e) => e.nombre.includes("IV Copa Black Crown"));
    expect(exacta?.pendiente).toBe(false);
    expect(
      parsed.warnings.some(
        (w) => w.includes("Fecha pendiente") && w.includes("IV Copa Black Crown"),
      ),
    ).toBe(false);
  });
});

describe("el lector de CSV dice lo mismo", () => {
  const csv = [
    "CALENDARIO de COMPETICIONES 2026",
    "TRIMESTRE,FECHA,COMPETICIÓN,LOCALIDAD,ORGANIZADOR,NIVEL,DIVISIONES",
    "T4,oct - nov,Copa de Otoño,Madrid,Club Ejemplo,AEP2,OPEN",
    "T1,24-25 ene,Campeonato con fecha,Madrid,Club Ejemplo,AEP2,OPEN",
  ].join("\n");
  const parsed = parseAepCalendarCsv(csv);

  it("avisa del rango de meses y dice qué fechas pone", () => {
    const aviso = parsed.warnings.find(
      (w) => w.includes("Fecha pendiente") && w.includes("Copa de Otoño"),
    );
    expect(aviso).toContain("2026-10-01");
    expect(aviso).toContain("2026-11-30");
  });

  it("y no avisa de la que sí tiene día", () => {
    expect(
      parsed.warnings.some(
        (w) => w.includes("Fecha pendiente") && w.includes("Campeonato con fecha"),
      ),
    ).toBe(false);
  });
});
