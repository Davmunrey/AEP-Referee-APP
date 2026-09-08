import { describe, expect, it } from "vitest";
import {
  duplicateRoleKeys,
  enumerateSlotKeys,
  sessionRoleEntries,
} from "@/lib/roster-template";
import { computeRosterCoverage, countRequiredSlots, deriveCompetitionEstado } from "@/lib/roster-coverage";
import { countOpenSlots } from "@/lib/roster-rules";
import { collectOpenSlots, sessionProgress } from "@/components/competitions/roster-session-helpers";
import { rosterTemplateSchema } from "@/lib/validations";
import type { RosterRole, RosterSession } from "@/lib/types";

function sesion(roles: RosterRole[], pesajeRoles: RosterRole[] = []): RosterSession {
  return {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-83 kg" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles,
    pesajeRoles,
  };
}

const CENTRAL: RosterRole = { rol: "Juez Central", slots: 1, key: "central" };
const LATERAL: RosterRole = { rol: "Juez Lateral", slots: 2, key: "lateral" };

describe("roles repetidos dentro de una sesión", () => {
  const duplicada = [sesion([CENTRAL, { ...CENTRAL }, LATERAL])];

  it("las claves de hueco no se repiten", () => {
    const keys = enumerateSlotKeys(duplicada);
    expect(keys).toEqual(["S1_central_0", "S1_lateral_0", "S1_lateral_1"]);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("las plazas requeridas son los huecos que existen, no la suma de slots", () => {
    // Antes: 1 + 1 + 2 = 4 requeridos con solo 3 huecos asignables.
    expect(countRequiredSlots(duplicada)).toBe(3);
  });

  it("con la tarima cubierta llega al 100 % y a Completo", () => {
    const assignments = Object.fromEntries(
      enumerateSlotKeys(duplicada).map((key, i) => [key, `ref-${i}`]),
    );
    const coverage = computeRosterCoverage(duplicada, assignments);
    // Antes: 3 de 4, 75 %, un hueco libre que nadie podía ocupar.
    expect(coverage).toMatchObject({ requeridos: 3, confirmados: 3, openSlots: 0, pct: 100 });
    expect(countOpenSlots(duplicada, assignments)).toBe(0);
    expect(deriveCompetitionEstado(coverage)).toBe("Completo");
  });

  it("un rol repetido entre competición y pesaje tampoco duplica huecos", () => {
    const cruzada = [
      sesion([CENTRAL, { rol: "Pesaje", slots: 1, key: "pesaje" }], [
        { rol: "Pesaje", slots: 1, key: "pesaje" },
      ]),
    ];
    expect(enumerateSlotKeys(cruzada)).toEqual(["S1_central_0", "S1_pesaje_0"]);
    expect(duplicateRoleKeys(cruzada[0]!)).toEqual(["pesaje"]);
  });

  it("el progreso de la sesión llega al 100 % y los huecos libres no salen dos veces", () => {
    const session = duplicada[0]!;
    const assignments = { S1_central_0: "ref-1" };
    expect(sessionProgress(session, assignments)).toMatchObject({ filled: 1, slots: 3 });
    const abiertos = collectOpenSlots(session, assignments);
    expect(abiertos.map((s) => s.slotKey)).toEqual(["S1_lateral_0", "S1_lateral_1"]);
  });

  it("el esquema rechaza la sesión con el rol repetido y explica cómo arreglarlo", () => {
    const parsed = rosterTemplateSchema.safeParse(duplicada);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.message.includes("repite un rol"))).toBe(true);
    }
  });

  it("una sesión con cada rol una sola vez sigue siendo válida", () => {
    expect(rosterTemplateSchema.safeParse([sesion([CENTRAL, LATERAL])]).success).toBe(true);
    expect(duplicateRoleKeys(sesion([CENTRAL, LATERAL]))).toEqual([]);
    expect(sessionRoleEntries(sesion([CENTRAL], [{ rol: "Pesaje", slots: 1, key: "pesaje" }])))
      .toHaveLength(2);
  });

  it("plantilla degradada: sesión sin roles no revienta la enumeración", () => {
    const degradada = [{ sesion: "S1" }, sesion([CENTRAL])] as unknown as RosterSession[];
    expect(enumerateSlotKeys(degradada)).toEqual(["S1_central_0"]);
    expect(countRequiredSlots(degradada)).toBe(1);
  });
});
