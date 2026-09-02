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

    expect(calendar["2026-05-15"]?.[0]?.rangePosition).toBe("start");
    expect(calendar["2026-05-16"]?.[0]?.rangePosition).toBe("middle");
    expect(calendar["2026-05-17"]?.[0]?.rangePosition).toBe("end");
    expect(calendar["2026-05-16"]?.[0]?.id).toBe("c1");
  });

  it("conserva todos los campeonatos que caen el mismo día", () => {
    // Antes cada fecha guardaba un único evento y la asignación pisaba al
    // anterior: con cinco zonas, dos campeonatos el mismo fin de semana es lo
    // normal y uno de los dos desaparecía del calendario sin rastro.
    const calendar = calendarEventsFromCompetitions([
      comp({ id: "c1", nombre: "Copa Centro", fecha: "2026-06-06", fechaFin: "2026-06-06" }),
      comp({ id: "c2", nombre: "Copa Canarias", fecha: "2026-06-06", fechaFin: "2026-06-06" }),
    ]);

    expect(calendar["2026-06-06"]?.map((e) => e.id)).toEqual(["c1", "c2"]);
  });

  it("solapa rangos largos con eventos de un solo día", () => {
    const calendar = calendarEventsFromCompetitions([
      comp({ id: "largo", fecha: "2026-05-15", fechaFin: "2026-05-17" }),
      comp({ id: "corto", fecha: "2026-05-16", fechaFin: "2026-05-16" }),
    ]);

    expect(calendar["2026-05-15"]?.map((e) => e.id)).toEqual(["largo"]);
    expect(calendar["2026-05-16"]?.map((e) => e.id)).toEqual(["largo", "corto"]);
    expect(calendar["2026-05-16"]?.[1]?.rangePosition).toBe("single");
  });

  it("marca single si fecha inicio y fin coinciden", () => {
    const calendar = calendarEventsFromCompetitions([
      comp({ fecha: "2026-05-23", fechaFin: "2026-05-23" }),
    ]);

    expect(calendar["2026-05-23"]?.[0]?.rangePosition).toBe("single");
  });
});
