import { describe, expect, it } from "vitest";
import { parseAepCalendarText, parseAepCalendarCsv } from "@/lib/calendar-parser";
import { isCompetitionPast } from "@/lib/competition-status";
import { championshipDayCount } from "@/lib/judge-compensation/rates";
import { competitionDateRange } from "@/lib/roster-conflicts";

/**
 * Un rango del calendario que cruza el año.
 *
 * El calendario es de un año natural y ese año se aplicaba a los DOS extremos
 * del rango. Con «28-3 dic-ene» el campeonato se creaba del 28 de diciembre al
 * 3 de ENERO DEL MISMO AÑO: la fecha de fin once meses antes que la de inicio.
 * A partir de ahí `isCompetitionPast` lo daba por celebrado en cuanto se
 * importaba —fuera del panel y de los próximos— y `championshipDayCount` lo
 * contaba como un solo día, que es sobre lo que se calcula el alojamiento.
 *
 * El lector del Excel de campeonatos (`judges-registry/parse-dates`) ya rodaba
 * el año y ya impedía un fin anterior al inicio. Los dos lectores del
 * calendario, el del PDF y el del CSV, se habían quedado sin las dos reglas.
 */

// Mismo reparto que el PDF real: cada campo en su bloque, separados por
// líneas en blanco.
function pdf(fila: string): string {
  return [
    "CALENDARIO de COMPETICIONES 2026",
    fila,
    "Campeonato de Fin de Año",
    "Madrid",
    "Club Ejemplo",
    "AEP2",
    "OPEN",
    "P",
    "R",
  ].join("\n\n");
}

function primeraEntrada(texto: string) {
  const parsed = parseAepCalendarText(texto);
  return parsed.entries.find((e) => e.nombre.includes("Fin de Año"));
}

describe("el PDF del calendario", () => {
  it("pone el fin de «28-3 dic-ene» en el año siguiente", () => {
    const entrada = primeraEntrada(pdf("28-3 dic-ene"));
    expect(entrada?.fechaInicio).toBe("2026-12-28");
    expect(entrada?.fechaFin).toBe("2027-01-03");
  });

  it("y el campeonato no nace ya celebrado", () => {
    const entrada = primeraEntrada(pdf("28-3 dic-ene"));
    const comp = { fecha: entrada!.fechaInicio!, fechaFin: entrada!.fechaFin! };
    expect(comp.fechaFin >= comp.fecha).toBe(true);
    expect(isCompetitionPast(comp)).toBe(false);
    expect(championshipDayCount(comp.fecha, comp.fechaFin)).toBe(7);
  });

  it("un rango normal del mismo año no se toca", () => {
    const entrada = primeraEntrada(pdf("07-15 feb"));
    expect(entrada?.fechaInicio).toBe("2026-02-07");
    expect(entrada?.fechaFin).toBe("2026-02-15");
  });

  it("y un rango entre meses del mismo año tampoco", () => {
    const entrada = primeraEntrada(pdf("30-1 abr-may"));
    expect(entrada?.fechaInicio).toBe("2026-04-30");
    expect(entrada?.fechaFin).toBe("2026-05-01");
  });

  it("dentro del mismo mes, un fin anterior al inicio se trata como un día", () => {
    // No hay año que rodar y adivinar el mes siguiente sería inventar: mismo
    // criterio que `competitionDateRange` y que el lector del Excel.
    const entrada = primeraEntrada(pdf("28-2 mar"));
    expect(entrada?.fechaInicio).toBe("2026-03-28");
    expect(entrada?.fechaFin).toBe("2026-03-28");
  });
});

function csv(fila: string): string {
  return [
    "CALENDARIO de COMPETICIONES 2026",
    "TRIMESTRE,FECHA,COMPETICIÓN,LOCALIDAD,ORGANIZADOR,NIVEL,DIVISIONES",
    `T4,${fila},Campeonato de Fin de Año,Madrid,Club Ejemplo,AEP2,OPEN`,
  ].join("\n");
}

describe("el CSV del calendario dice lo mismo", () => {
  it("pone el fin de «28-3 dic-ene» en el año siguiente", () => {
    const parsed = parseAepCalendarCsv(csv("28-3 dic-ene"));
    const entrada = parsed.entries.find((e) => e.nombre.includes("Fin de Año"));
    expect(entrada?.fechaInicio).toBe("2026-12-28");
    expect(entrada?.fechaFin).toBe("2027-01-03");
  });

  it("con el rango escrito con espacios, igual", () => {
    const parsed = parseAepCalendarCsv(csv("28 dic - 3 ene"));
    const entrada = parsed.entries.find((e) => e.nombre.includes("Fin de Año"));
    expect(entrada?.fechaInicio).toBe("2026-12-28");
    expect(entrada?.fechaFin).toBe("2027-01-03");
  });

  it("y un rango normal no se toca", () => {
    const parsed = parseAepCalendarCsv(csv("07-15 feb"));
    const entrada = parsed.entries.find((e) => e.nombre.includes("Fin de Año"));
    expect(entrada?.fechaInicio).toBe("2026-02-07");
    expect(entrada?.fechaFin).toBe("2026-02-15");
  });
});

describe("el resto del dominio ya contaba con la regla", () => {
  it("un fin anterior al inicio se lee como un solo día", () => {
    expect(competitionDateRange({ fecha: "2026-12-28", fechaFin: "2026-01-03" })).toEqual({
      start: "2026-12-28",
      end: "2026-12-28",
    });
  });
});
