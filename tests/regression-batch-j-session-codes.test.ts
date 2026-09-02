import { describe, expect, it } from "vitest";
import { rosterTemplateSchema } from "@/lib/validations";
import { enumerateSlotKeys } from "@/lib/roster-template";
import { parsedToRosterTemplate } from "@/lib/schedule-parser/to-roster-template";
import type { ParsedHorario } from "@/lib/schedule-parser/types";
import type { RosterSession } from "@/lib/types";

// La clave de cada hueco es `${sesion}_${rol}_${indice}`, así que dos sesiones
// con el mismo código comparten huecos: el juez asignado a una aparecía también
// en la otra, y la cobertura contaba los huecos dos veces pero las asignaciones
// una sola, de modo que la tarima no llegaba nunca al 100 %.

function sesion(patch: Partial<RosterSession> = {}): RosterSession {
  return {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [{ genero: "Hombres", pesos: "-74" }],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles: [{ key: "central", rol: "Central", slots: 1 }],
    pesajeRoles: [],
    ...patch,
  };
}

describe("el choque de códigos de sesión es la raíz del problema", () => {
  it("dos sesiones con el mismo código generan claves de hueco idénticas", () => {
    const keys = enumerateSlotKeys([sesion(), sesion({ nombre: "Sesión 1 (domingo)" })]);
    expect(keys).toEqual(["S1_central_0", "S1_central_0"]);
    expect(new Set(keys).size).toBe(1);
  });
});

describe("rosterTemplateSchema", () => {
  it("rechaza la plantilla con códigos repetidos", () => {
    const parsed = rosterTemplateSchema.safeParse([sesion(), sesion()]);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((i) => /mismo código/.test(i.message))).toBe(true);
  });

  it("no distingue mayúsculas ni espacios al comparar", () => {
    expect(rosterTemplateSchema.safeParse([sesion(), sesion({ sesion: " s1 " })]).success).toBe(
      false,
    );
  });

  it("acepta códigos distintos", () => {
    expect(
      rosterTemplateSchema.safeParse([sesion(), sesion({ sesion: "S2", nombre: "Sesión 2" })])
        .success,
    ).toBe(true);
  });
});

describe("parsedToRosterTemplate", () => {
  function horario(codigos: string[]): ParsedHorario {
    return {
      header: {},
      sessions: codigos.map((num) => ({
        sesion: `S${num}`,
        nombre: `Sesión ${num}`,
        dia: { raw: "Sábado", short: "Sábado", iso: "2026-05-16" },
        categorias: [],
        grupos: [],
      })),
      warnings: [],
    } as unknown as ParsedHorario;
  }

  it("desambigua un horario que reinicia la numeración cada día", () => {
    // Dos «SESIÓN 1» en el mismo PDF (una por jornada) llegaban las dos como
    // "S1" y compartían huecos.
    const template = parsedToRosterTemplate(horario(["1", "2", "1"]), "AEP-2");
    expect(template.map((s) => s.sesion)).toEqual(["S1", "S2", "S1B"]);
    expect(new Set(enumerateSlotKeys(template)).size).toBe(enumerateSlotKeys(template).length);
  });

  it("no toca los códigos cuando ya son únicos", () => {
    expect(parsedToRosterTemplate(horario(["1", "2", "3"]), "AEP-2").map((s) => s.sesion)).toEqual([
      "S1",
      "S2",
      "S3",
    ]);
  });

  it("aguanta más de dos repeticiones del mismo código", () => {
    expect(parsedToRosterTemplate(horario(["1", "1", "1"]), "AEP-2").map((s) => s.sesion)).toEqual([
      "S1",
      "S1B",
      "S1C",
    ]);
  });
});
