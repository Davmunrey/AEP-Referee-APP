import { describe, expect, it } from "vitest";
import { calendarEventsFromCompetitions } from "@/lib/calendar-from-competitions";
import type { Competition } from "@/lib/types";

function comp(patch: Partial<Competition>): Competition {
  return {
    id: "c1",
    nombre: "Campeonato de ESPAÑA JUNIOR",
    tipo: "AEP-1",
    fecha: "2026-05-15",
    fechaFin: "2026-05-17",
    sede: "Murcia",
    sesiones: 10,
    requeridos: 110,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    ...patch,
  };
}

describe("calendarEventsFromCompetitions", () => {
  it("pinta todo el rango de fechas de una competición", () => {
    const calendar = calendarEventsFromCompetitions([comp({})]);

    expect(calendar["2026-05-15"]?.rangePosition).toBe("start");
    expect(calendar["2026-05-16"]?.rangePosition).toBe("middle");
    expect(calendar["2026-05-17"]?.rangePosition).toBe("end");
    expect(calendar["2026-05-16"]?.id).toBe("c1");
  });

  it("marca single si fecha inicio y fin coinciden", () => {
    const calendar = calendarEventsFromCompetitions([
      comp({ fecha: "2026-05-23", fechaFin: "2026-05-23" }),
    ]);

    expect(calendar["2026-05-23"]?.rangePosition).toBe("single");
  });
});
