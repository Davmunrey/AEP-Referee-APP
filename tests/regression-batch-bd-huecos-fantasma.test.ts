import { describe, expect, it } from "vitest";
import { classifyCompensationDuties } from "@/lib/judge-compensation/classify-duties";
import { computeRosterCoverage } from "@/lib/roster-coverage";
import type { RosterSession } from "@/lib/types";

function sesion(codigo: string, slots: number): RosterSession {
  return {
    sesion: codigo,
    nombre: `Sesión ${codigo}`,
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ key: "central", rol: "Central", slots }],
    pesajeRoles: [],
  };
}

const clasificar = (template: RosterSession[], assignments: Record<string, string>) =>
  classifyCompensationDuties({
    template,
    assignments,
    refereeId: "j1",
    tipo: "AEP-2",
    ambito: "nacional",
  });

describe("el dinero se calcula sobre los huecos que existen en la plantilla", () => {
  it("un hueco que ya no está en la plantilla no genera línea ni importe", () => {
    // `S1_central_2` sobrevivió a una plantilla que bajó de 3 a 2 puestos: la
    // cobertura ya lo ignoraba —el juez no sale en el cuadrante— pero la
    // liquidación seguía pagándolo, porque `template` llegaba a
    // `classifyCompensationDuties` y no se miraba.
    const template = [sesion("S1", 2)];
    const lines = clasificar(template, { S1_central_0: "j1", S1_central_2: "j1" });
    expect(lines).toHaveLength(1);
    expect(lines[0]?.slotKeys).toEqual(["S1_central_0"]);
  });

  it("una sesión entera que ya no está tampoco", () => {
    const lines = clasificar([sesion("S1", 1)], { S1_central_0: "j1", S2_central_0: "j1" });
    expect(lines.map((l) => l.session)).toEqual(["S1"]);
  });

  it("el dinero y el cuadrante cuentan lo mismo", () => {
    // El criterio es literalmente el de `computeRosterCoverage`: si el hueco
    // no cuenta para la cobertura, tampoco cuenta para el importe.
    const template = [sesion("S1", 2)];
    const assignments = { S1_central_0: "j1", S1_central_1: "j2", S1_central_5: "j1" };
    const coverage = computeRosterCoverage(template, assignments, 2);
    expect(coverage.confirmados).toBe(2);
    const suyas = clasificar(template, assignments);
    expect(suyas.flatMap((l) => l.slotKeys)).toEqual(["S1_central_0"]);
  });

  it("con la plantilla intacta no cambia nada", () => {
    const template = [sesion("S1", 2), sesion("S2", 1)];
    const lines = clasificar(template, { S1_central_0: "j1", S2_central_0: "j1" });
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.amount > 0)).toBe(true);
  });
});
