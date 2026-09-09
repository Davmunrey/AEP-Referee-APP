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

describe("qué copia sobrevive cuando una está aprobada", () => {
  /**
   * La limpieza de duplicados se dispara sola al APLICAR la importación del
   * calendario, antes de que nadie vea qué se va a borrar. El criterio miraba
   * solo la tarima (`confirmados`, `Completo`), así que podía tirar justamente
   * la copia aprobada —la que alguien firmó— para quedarse con un borrador que
   * tenía un juez más.
   */
  const aprobada = comp({
    id: "evt-900",
    nombre: "Open Madrid",
    fecha: "2026-05-01",
    confirmados: 6,
    aprobacion: "Aprobado",
  });
  const borrador = comp({
    id: "evt-001",
    nombre: "Open Madrid",
    fecha: "2026-05-01",
    confirmados: 9,
    estado: "Completo",
  });

  it("gana la aprobada aunque tenga menos jueces confirmados", () => {
    expect(pickCompetitionToKeep([borrador, aprobada]).id).toBe("evt-900");
    expect(competitionsToRemoveInGroup([borrador, aprobada]).map((c) => c.id)).toEqual(["evt-001"]);
  });

  it("una propuesta enviada también pesa más que un borrador", () => {
    const pendiente = comp({
      id: "evt-901",
      nombre: "Open Madrid",
      fecha: "2026-05-01",
      confirmados: 1,
      aprobacion: "Propuesta enviada",
    });
    expect(pickCompetitionToKeep([borrador, pendiente]).id).toBe("evt-901");
  });

  it("una tarima aprobada pesa más que una propuesta enviada", () => {
    const pendiente = comp({
      id: "evt-000",
      nombre: "Open Madrid",
      fecha: "2026-05-01",
      confirmados: 9,
      aprobacion: "Propuesta enviada",
    });
    expect(pickCompetitionToKeep([pendiente, aprobada]).id).toBe("evt-900");
  });

  it("un estado con espacios de más sigue contando como aprobado", () => {
    const sucia = comp({
      id: "evt-902",
      nombre: "Open Madrid",
      fecha: "2026-05-01",
      confirmados: 0,
      aprobacion: "  aprobado  ",
    });
    expect(pickCompetitionToKeep([borrador, sucia]).id).toBe("evt-902");
  });

  it("sin ninguna aprobada, sigue mandando la tarima con más confirmados", () => {
    const pocos = comp({ id: "evt-002", nombre: "Open Madrid", fecha: "2026-05-01", confirmados: 2 });
    expect(pickCompetitionToKeep([pocos, borrador]).id).toBe("evt-001");
  });
});
