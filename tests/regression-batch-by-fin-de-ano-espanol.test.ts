import { describe, expect, it } from "vitest";
import { businessMonthIndex, businessYear } from "@/lib/business-date";
import { currentSeasonYear, formatMonthYear, operationalQuarterLabel } from "@/lib/season";

/**
 * La aplicación se despliega en UTC, y `Date.prototype.getFullYear()` da el año
 * del huso del proceso: UTC en el servidor, la hora local en el navegador.
 *
 * Entre la medianoche española y la 01:00 UTC del 1 de enero eso son DOS AÑOS
 * DISTINTOS. El panel abría la temporada anterior, y el navegador la reescribía
 * al hidratar. Lo mismo en cada cambio de trimestre.
 *
 * `businessHour` existe en el módulo de fechas exactamente por esta razón, y el
 * año se había quedado sin ella.
 */

// 31 de diciembre a las 23:30 UTC = 1 de enero, 00:30, en Madrid.
const NOCHEVIEJA_UTC = new Date("2026-12-31T23:30:00Z");
// 31 de marzo a las 23:30 UTC = 1 de abril en Madrid: T1 pasa a T2.
const FIN_DE_T1_UTC = new Date("2026-03-31T23:30:00Z");

describe("el cambio de año se mira en hora española", () => {
  it("a las 00:30 del 1 de enero en Madrid, la temporada ya es la nueva", () => {
    expect(currentSeasonYear(NOCHEVIEJA_UTC)).toBe(2027);
    expect(NOCHEVIEJA_UTC.getUTCFullYear()).toBe(2026); // lo que decía antes
  });

  it("el trimestre del panel también", () => {
    expect(operationalQuarterLabel(NOCHEVIEJA_UTC)).toBe("T1 2027");
    expect(operationalQuarterLabel(FIN_DE_T1_UTC)).toBe("T2 2026");
  });

  it("y el mes con año que se pinta en la documentación", () => {
    expect(formatMonthYear(NOCHEVIEJA_UTC)).toMatch(/enero de 2027/i);
  });

  it("a media tarde no cambia nada: es el mismo día en los dos husos", () => {
    const tarde = new Date("2026-06-15T14:00:00Z");
    expect(currentSeasonYear(tarde)).toBe(2026);
    expect(operationalQuarterLabel(tarde)).toBe("T2 2026");
  });
});

describe("los ladrillos del día natural español", () => {
  it("dan el año y el mes de Madrid, no los del proceso", () => {
    expect(businessYear(NOCHEVIEJA_UTC)).toBe(2027);
    expect(businessMonthIndex(NOCHEVIEJA_UTC)).toBe(0);
    expect(businessMonthIndex(FIN_DE_T1_UTC)).toBe(3);
  });
});
