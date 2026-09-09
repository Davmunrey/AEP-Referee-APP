import { describe, expect, it } from "vitest";
import {
  duplicateSessionCodes,
  enumerateSlotKeys,
  mergeRosterTemplateSessions,
} from "@/lib/roster-template";
import { rosterTemplateSchema } from "@/lib/validations";
import type { RosterSession } from "@/lib/types";

/**
 * Dos sesiones con el mismo código generan las mismas claves de hueco
 * (`${sesion}_${rol}_${indice}`): el juez asignado a una aparece también en la
 * otra y los huecos de la segunda no existen. Guardar la plantilla a mano ya
 * lo impedía; importarla desde un PDF, no — y la fusión podía crear el
 * duplicado ella sola.
 */

function sesion(sesionCode: string, extra: Partial<RosterSession> = {}): RosterSession {
  return {
    sesion: sesionCode,
    nombre: `Sesión ${sesionCode}`,
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00",
    horarioPesaje: "08:00",
    roles: [{ key: "central", rol: "Juez Central", slots: 1 }],
    pesajeRoles: [],
    ...extra,
  } as RosterSession;
}

describe("códigos de sesión repetidos", () => {
  it("se detectan ignorando espacios y mayúsculas", () => {
    expect(duplicateSessionCodes([sesion("S1"), sesion(" s1 ")])).toEqual(["s1"]);
    expect(duplicateSessionCodes([sesion("S1"), sesion("S2")])).toEqual([]);
  });

  it("la fusión ya no puede crear el duplicado ella sola", () => {
    // El import trae la misma sesión dos veces: la primera no marcaba nada y
    // la segunda volvía a entrar.
    const fusionada = mergeRosterTemplateSessions([], [sesion("S1"), sesion("S1")], new Set());
    expect(fusionada).toHaveLength(1);
    expect(duplicateSessionCodes(fusionada)).toEqual([]);
  });

  it("la fusión sigue conservando lo que ya había y añadiendo lo nuevo", () => {
    const fusionada = mergeRosterTemplateSessions(
      [sesion("S1")],
      [sesion("S2")],
      new Set(),
    );
    expect(fusionada.map((s) => s.sesion)).toEqual(["S1", "S2"]);
  });

  it("y sigue sustituyendo la sesión marcada para reemplazo", () => {
    const nueva = sesion("S1", { nombre: "Reimportada" });
    const fusionada = mergeRosterTemplateSessions([sesion("S1")], [nueva], new Set(["S1"]));
    expect(fusionada).toHaveLength(1);
    expect(fusionada[0]!.nombre).toBe("Reimportada");
  });

  it("con el código repetido, la segunda sesión no aporta ni un hueco", () => {
    // Esto es lo que hacía la corrupción invisible: la cobertura contaba una
    // sola plaza para dos sesiones distintas.
    expect(enumerateSlotKeys([sesion("S1"), sesion("S1")])).toEqual(["S1_central_0"]);
  });

  it("el esquema de la plantilla sigue rechazándolo, y con el mismo criterio", () => {
    const out = rosterTemplateSchema.safeParse([sesion("S1"), sesion("s1")]);
    expect(out.success).toBe(false);
    if (!out.success) {
      expect(out.error.issues.some((i) => /mismo código/.test(i.message))).toBe(true);
    }
  });
});
