import { describe, expect, it } from "vitest";
import { parseRosterSlotPosition } from "@/lib/referee-competition-history";
import { validateRosterOperation } from "@/lib/roster-rules";
import type { RosterSession } from "@/lib/types";

describe("parseRosterSlotPosition — sesiones con guiones bajos", () => {
  it("usa el parseo canónico (últimos segmentos = rol e índice)", () => {
    const pos = parseRosterSlotPosition("Day_1_central_0");
    expect(pos).not.toBeNull();
    expect(pos!.session).toBe("Day_1");
    expect(pos!.roleKey).toBe("central");
    expect(pos!.slotIndex).toBe(0);
    expect(pos!.roleLabel).toBe("Juez Central");
  });

  it("las claves simples siguen funcionando", () => {
    const pos = parseRosterSlotPosition("S1_pesaje_2");
    expect(pos!.session).toBe("S1");
    expect(pos!.roleKey).toBe("pesaje");
    expect(pos!.slotIndex).toBe(2);
  });
});

function session(sesion: string, dia: string): RosterSession {
  return {
    sesion,
    nombre: sesion,
    dia,
    categorias: [],
    horarioCompeticion: "10:00 - 13:30",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
    pesajeRoles: [{ rol: "Pesaje", slots: 1, key: "pesaje" }],
  };
}

describe("solape tarima→pesaje de sesión siguiente — solo mismo día", () => {
  it("bloquea tarima S1 + pesaje S2 cuando comparten día", () => {
    const template = [session("S1", "Viernes"), session("S2", "Viernes")];
    const result = validateRosterOperation({
      template,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
      flags: {},
    });
    expect(result.ok).toBe(false);
    expect(result.overridable).toBe(true);
  });

  it("NO bloquea cuando la sesión siguiente es de otro día", () => {
    const template = [session("S1", "Viernes"), session("S2", "Sábado")];
    const result = validateRosterOperation({
      template,
      assignments: { S1_central_0: "r1" },
      slotKey: "S2_pesaje_0",
      refereeId: "r1",
      flags: {},
    });
    expect(result.ok).toBe(true);
  });
});
