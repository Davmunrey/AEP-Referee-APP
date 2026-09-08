import { describe, expect, it } from "vitest";
import {
  buildRefereeBusyMap,
  busyElsewhereLabel,
  competitionDateRange,
  competitionDatesOverlap,
} from "@/lib/roster-conflicts";
import { scoreRefereeForSlot } from "@/lib/roster-ui";
import type { Referee, RosterSession } from "@/lib/types";

const COMPETICION = { id: "c1", fecha: "2026-06-13", fechaFin: "2026-06-14" };

describe("solape de fechas entre campeonatos", () => {
  it("detecta el fin de semana compartido", () => {
    expect(competitionDatesOverlap(COMPETICION, { fecha: "2026-06-14", fechaFin: "2026-06-15" })).toBe(true);
    expect(competitionDatesOverlap(COMPETICION, { fecha: "2026-06-13", fechaFin: "2026-06-13" })).toBe(true);
  });

  it("no inventa solapes con fechas contiguas", () => {
    expect(competitionDatesOverlap(COMPETICION, { fecha: "2026-06-15", fechaFin: "2026-06-16" })).toBe(false);
    expect(competitionDatesOverlap(COMPETICION, { fecha: "2026-06-11", fechaFin: "2026-06-12" })).toBe(false);
  });

  it("con fechas no utilizables no afirma el choque", () => {
    expect(competitionDatesOverlap(COMPETICION, { fecha: "", fechaFin: "" })).toBe(false);
    expect(competitionDatesOverlap(COMPETICION, { fecha: "mañana", fechaFin: "pasado" })).toBe(false);
    expect(competitionDatesOverlap(COMPETICION, null)).toBe(false);
  });

  it("una fechaFin anterior al inicio se trata como un solo día", () => {
    expect(competitionDateRange({ fecha: "2026-06-13", fechaFin: "2026-06-01" })).toEqual({
      start: "2026-06-13",
      end: "2026-06-13",
    });
    expect(competitionDateRange({ fecha: "2026-06-13T10:00:00Z", fechaFin: "" })).toEqual({
      start: "2026-06-13",
      end: "2026-06-13",
    });
  });
});

describe("mapa de jueces ocupados en otro campeonato", () => {
  const others = [
    { id: "c1", nombre: "Este mismo", fecha: "2026-06-13", fechaFin: "2026-06-14" },
    { id: "c2", nombre: "Copa Iron Fira", fecha: "2026-06-14", fechaFin: "2026-06-14" },
    { id: "c3", nombre: "Trofeo de Otoño", fecha: "2026-10-03", fechaFin: "2026-10-04" },
  ];
  const assignments = [
    { competitionId: "c1", refereeId: "r1" },
    { competitionId: "c2", refereeId: "r1" },
    { competitionId: "c2", refereeId: "r1" },
    { competitionId: "c3", refereeId: "r2" },
  ];

  it("marca solo a quien está en otro campeonato de estas fechas", () => {
    const map = buildRefereeBusyMap({ competition: COMPETICION, others, assignments });
    expect(Object.keys(map)).toEqual(["r1"]);
    // Dos huecos del mismo campeonato son un solo aviso, y el campeonato que se
    // está montando no cuenta como choque consigo mismo.
    expect(map.r1).toEqual([
      { competitionId: "c2", competitionName: "Copa Iron Fira", fecha: "2026-06-14", fechaFin: "2026-06-14" },
    ]);
  });

  it("sin campeonatos solapados devuelve un mapa vacío", () => {
    const map = buildRefereeBusyMap({
      competition: { id: "c9", fecha: "2027-01-01", fechaFin: "2027-01-01" },
      others,
      assignments,
    });
    expect(map).toEqual({});
  });

  it("el texto de la ficha resume uno o varios choques", () => {
    expect(busyElsewhereLabel(undefined)).toBeNull();
    expect(busyElsewhereLabel([])).toBeNull();
    expect(
      busyElsewhereLabel([
        { competitionId: "c2", competitionName: "Copa Iron Fira", fecha: "2026-06-14", fechaFin: "2026-06-14" },
      ]),
    ).toBe("Ya asignado en Copa Iron Fira");
    expect(
      busyElsewhereLabel([
        { competitionId: "c2", competitionName: "A", fecha: "2026-06-14", fechaFin: "2026-06-14" },
        { competitionId: "c4", competitionName: "B", fecha: "2026-06-13", fechaFin: "2026-06-13" },
      ]),
    ).toBe("Ya asignado en 2 campeonatos de estas fechas");
  });
});

describe("sugerencias de hueco", () => {
  const template: RosterSession[] = [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Sábado",
      categorias: [],
      horarioCompeticion: "10:00 - 13:00",
      horarioPesaje: "08:00 - 09:30",
      roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
      pesajeRoles: [],
    },
  ];
  const referee = (id: string): Referee =>
    ({
      id,
      nombre: id,
      zona: "CENTRO",
      nivel: "Nacional",
      estado: "Activo",
      disp: true,
      eventos: 0,
    }) as Referee;

  const ctx = {
    slotKey: "S1_central_0",
    roleKey: "central" as const,
    eventType: "AEP-2" as const,
    template,
    assignments: {},
    regulations: [],
  };

  it("quien ya está en otro campeonato de estas fechas deja de proponerse el primero", () => {
    const libre = scoreRefereeForSlot(referee("r1"), ctx);
    const ocupado = scoreRefereeForSlot(referee("r2"), {
      ...ctx,
      busyElsewhereIds: new Set(["r2"]),
    });
    expect(ocupado).toBeLessThan(libre);
    // Sigue siendo asignable: es un aviso, no un bloqueo.
    expect(ocupado).toBeGreaterThan(0);
  });
});
