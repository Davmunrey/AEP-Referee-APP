import { describe, expect, it } from "vitest";
import { countRegulationViolations, countRosterSlots } from "@/lib/roster-ui";
import { countRequiredSlots } from "@/lib/roster-coverage";
import type { RegulationRule, RosterSession } from "@/lib/types";

/**
 * El contador de avisos de normativa enumeraba los huecos por su cuenta en vez
 * de pedirle la lista a `enumerateSlotKeys`, que es quien la define para el
 * resto de la aplicación —y que quita los repetidos—.
 *
 * Dos filas del mismo rol en una sesión, o dos sesiones con el mismo código,
 * comparten clave de hueco: son UNA designación. Sin quitar repetidos, la
 * misma designación se contaba dos veces y la tarima decía «2 avisos de
 * normativa» donde había uno. Es el número que se mira antes de enviar la
 * propuesta.
 */

const REGLA: RegulationRule = {
  id: "reg-1",
  rol: "Juez Central",
  roleKey: "central",
  eventTypes: ["AEP-1"],
  minLevel: "IPF Cat. 1",
  note: "Central en AEP-1",
};

function sesion(codigo: string, roles: RosterSession["roles"]): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles,
    pesajeRoles: [],
  };
}

const CENTRAL = { rol: "Juez Central", slots: 1, key: "central" as const };

describe("una designación con un rol repetido en la sesión", () => {
  const template = [sesion("S1", [CENTRAL, { ...CENTRAL }])];

  it("es un solo hueco, como dice la lista canónica", () => {
    expect(countRequiredSlots(template)).toBe(1);
    expect(countRosterSlots(template)).toBe(1);
  });

  it("y produce un solo aviso de normativa, no dos", () => {
    const avisos = countRegulationViolations(
      template,
      { S1_central_0: "ref-1" },
      "AEP-1",
      () => "Regional",
      [REGLA],
    );
    expect(avisos).toBe(1);
  });
});

describe("dos sesiones con el mismo código", () => {
  const template = [sesion("S1", [CENTRAL]), sesion("S1", [CENTRAL])];

  it("comparten hueco: un aviso, no dos", () => {
    expect(countRequiredSlots(template)).toBe(1);
    const avisos = countRegulationViolations(
      template,
      { S1_central_0: "ref-1" },
      "AEP-1",
      () => "Regional",
      [REGLA],
    );
    expect(avisos).toBe(1);
  });
});

describe("lo que sí son designaciones distintas se sigue contando entero", () => {
  const template = [sesion("S1", [{ ...CENTRAL, slots: 2 }]), sesion("S2", [CENTRAL])];

  it("tres huecos, tres avisos", () => {
    expect(countRequiredSlots(template)).toBe(3);
    const avisos = countRegulationViolations(
      template,
      { S1_central_0: "ref-1", S1_central_1: "ref-2", S2_central_0: "ref-3" },
      "AEP-1",
      () => "Regional",
      [REGLA],
    );
    expect(avisos).toBe(3);
  });

  it("y una asignación a un hueco que ya no está en la plantilla no cuenta", () => {
    const avisos = countRegulationViolations(
      template,
      { S9_central_0: "ref-1" },
      "AEP-1",
      () => "Regional",
      [REGLA],
    );
    expect(avisos).toBe(0);
  });
});
