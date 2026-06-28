import { describe, expect, it } from "vitest";
import { buildHubSummary } from "@/lib/judge-compensation/hub";
import type { CompetitionCompensationSummary } from "@/lib/judge-compensation/types";
import type { Competition } from "@/lib/types";

const baseComp = (id: string, fecha: string): Competition =>
  ({
    id,
    nombre: `Evento ${id}`,
    fecha,
    fechaFin: fecha,
    sede: "Madrid",
    estado: "Completo",
    tipo: "AEP-1",
    zona: "CENTRO",
  }) as Competition;

const baseSummary = (overrides: Partial<CompetitionCompensationSummary> = {}): CompetitionCompensationSummary => ({
  competitionId: "c1",
  claims: [{ refereeId: "r1" } as CompetitionCompensationSummary["claims"][0]],
  grandTotal: 120,
  provisionalTotal: 120,
  readiness: {
    venueReady: true,
    allTravelResolved: true,
    pendingTravelReferees: [],
    missingDomicilioReferees: [],
    issues: [],
    readyForExport: true,
  },
  ...overrides,
});

describe("buildHubSummary", () => {
  it("filtra campeonatos sin jueces y calcula totales", () => {
    const comps = [baseComp("c1", "2026-03-01"), baseComp("c2", "2026-02-01")];
    const summaries = new Map<string, CompetitionCompensationSummary>([
      ["c1", baseSummary()],
      ["c2", baseSummary({ claims: [], readiness: { ...baseSummary().readiness, readyForExport: false } })],
    ]);

    const hub = buildHubSummary(comps, summaries);
    expect(hub.items).toHaveLength(1);
    expect(hub.items[0]?.competitionId).toBe("c1");
    expect(hub.readyCount).toBe(1);
    expect(hub.totalPendingKm).toBe(0);
  });

  it("ordena por fecha descendente", () => {
    const comps = [baseComp("old", "2026-01-01"), baseComp("new", "2026-06-01")];
    const summaries = new Map<string, CompetitionCompensationSummary>([
      ["old", baseSummary({ competitionId: "old" })],
      ["new", baseSummary({ competitionId: "new" })],
    ]);

    const hub = buildHubSummary(comps, summaries);
    expect(hub.items[0]?.competitionId).toBe("new");
  });
});
