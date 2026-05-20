import { describe, expect, it } from "vitest";
import {
  competitionDedupKey,
  competitionsToRemoveInGroup,
  groupCompetitionDuplicates,
  normalizeCompetitionName,
  pickCompetitionToKeep,
} from "@/lib/competition-dedup";
import type { Competition } from "@/lib/types";

function comp(partial: Partial<Competition> & Pick<Competition, "id" | "nombre" | "fecha">): Competition {
  return {
    tipo: "AEP-2",
    fechaFin: partial.fecha,
    sede: "Madrid",
    sesiones: 3,
    requeridos: 9,
    confirmados: 0,
    estado: "Borrador",
    aprobacion: "Sin propuesta",
    zona: "CENTRO",
    ...partial,
  };
}

describe("competition-dedup", () => {
  it("normalizes accents and spaces", () => {
    expect(normalizeCompetitionName("  Campeonato  León  ")).toBe("campeonato leon");
  });

  it("groups duplicates by nombre+fecha+tipo", () => {
    const list = [
      comp({ id: "evt-001", nombre: "Open Madrid", fecha: "2026-05-01" }),
      comp({ id: "evt-002", nombre: "open madrid", fecha: "2026-05-01" }),
      comp({ id: "evt-003", nombre: "Otro", fecha: "2026-06-01" }),
    ];
    const groups = groupCompetitionDuplicates(list);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.competitions).toHaveLength(2);
    expect(competitionDedupKey(list[0]!)).toBe(competitionDedupKey(list[1]!));
  });

  it("keeps competition with more confirmados", () => {
    const group = [
      comp({ id: "evt-001", nombre: "X", fecha: "2026-01-01", confirmados: 1 }),
      comp({ id: "evt-002", nombre: "X", fecha: "2026-01-01", confirmados: 5 }),
    ];
    expect(pickCompetitionToKeep(group).id).toBe("evt-002");
    expect(competitionsToRemoveInGroup(group).map((c) => c.id)).toEqual(["evt-001"]);
  });
});
