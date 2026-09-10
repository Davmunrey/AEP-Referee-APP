import { afterEach, describe, expect, it, vi } from "vitest";
import { daysUntil } from "@/lib/dashboard-intelligence";
import { isCompetitionPast } from "@/lib/competition-status";
import { businessDayIso } from "@/lib/business-date";

/**
 * El panel cuenta los días contra el día natural ESPAÑOL, no contra la
 * medianoche del huso del proceso.
 *
 * `daysUntil` tomaba «hoy» de `now.getFullYear()/getMonth()/getDate()`, que en
 * el servidor —donde se renderiza el panel, y va en UTC— es el día UTC. Entre
 * la medianoche española y las 01:00–02:00 UTC eso son dos días distintos:
 *
 *   - un campeonato que es HOY salía como «Mañana»;
 *   - el que terminó AYER seguía pasando el filtro de próximos (`d >= 0`) y
 *     encabezaba la previsión de cobertura.
 *
 * Y el mismo panel ya descarta los campeonatos pasados con `isCompetitionPast`,
 * que sí usa el día español: en esa franja los dos filtros decían cosas
 * distintas del mismo campeonato.
 */

// 00:30 del 14 de marzo de 2026 en España. En marzo el reloj español todavía
// va en UTC+1 (el cambio a horario de verano es el 29), así que son las 23:30
// UTC del día 13: dos días naturales distintos a la vez.
const MADRUGADA_ESPANOLA = new Date("2026-03-13T23:30:00Z");

afterEach(() => {
  vi.useRealTimers();
});

describe("en la madrugada española", () => {
  it("el día de negocio va un día por delante del día UTC", () => {
    expect(businessDayIso(MADRUGADA_ESPANOLA)).toBe("2026-03-14");
    expect(MADRUGADA_ESPANOLA.toISOString().slice(0, 10)).toBe("2026-03-13");
  });

  it("un campeonato de hoy es hoy, no mañana", () => {
    expect(daysUntil("2026-03-14", MADRUGADA_ESPANOLA)).toBe(0);
  });

  it("el de mañana es mañana", () => {
    expect(daysUntil("2026-03-15", MADRUGADA_ESPANOLA)).toBe(1);
  });

  it("y el de ayer ya es pasado, con el mismo criterio que isCompetitionPast", () => {
    vi.useFakeTimers();
    vi.setSystemTime(MADRUGADA_ESPANOLA);
    const ayer = { fecha: "2026-03-13", fechaFin: "2026-03-13" };
    expect(daysUntil(ayer.fechaFin, MADRUGADA_ESPANOLA)).toBeLessThan(0);
    expect(isCompetitionPast(ayer)).toBe(true);
  });
});

describe("a plena luz del día sigue contando igual", () => {
  const mediodia = new Date("2026-03-14T11:00:00Z");

  it("hoy, mañana y la semana que viene", () => {
    expect(daysUntil("2026-03-14", mediodia)).toBe(0);
    expect(daysUntil("2026-03-15", mediodia)).toBe(1);
    expect(daysUntil("2026-03-21", mediodia)).toBe(7);
  });

  it("y ayer sale en negativo", () => {
    expect(daysUntil("2026-03-13", mediodia)).toBe(-1);
  });
});

describe("el cambio de hora no mete días de 23 ni de 25 horas", () => {
  // En España el reloj se adelanta el último domingo de marzo (2026: día 29).
  const antes = new Date("2026-03-27T12:00:00Z");

  it("cuenta los días naturales por encima del salto", () => {
    expect(daysUntil("2026-03-28", antes)).toBe(1);
    expect(daysUntil("2026-03-29", antes)).toBe(2);
    expect(daysUntil("2026-03-30", antes)).toBe(3);
  });
});

describe("fechas que no se pueden leer", () => {
  it("devuelven null en vez de un número inventado", () => {
    expect(daysUntil("", MADRUGADA_ESPANOLA)).toBeNull();
    expect(daysUntil("pendiente", MADRUGADA_ESPANOLA)).toBeNull();
    expect(daysUntil("2026-02-30", MADRUGADA_ESPANOLA)).toBeNull();
  });

  it("y una fecha con hora se lee por su día", () => {
    expect(daysUntil("2026-03-15T18:00:00Z", MADRUGADA_ESPANOLA)).toBe(1);
  });
});
