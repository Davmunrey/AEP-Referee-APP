import { describe, it, expect } from "vitest";
import {
  cloneTemplate,
  enumerateSlotKeys,
  formatRequiredSlots,
  getPresetForEventType,
  mergeRosterTemplateSessions,
  parseSlotKey,
  pruneAssignments,
  summarizeRequiredSlots,
} from "@/lib/roster-template";
import { PRESET_AEP1, PRESET_AEP2, PRESET_AEP3 } from "@/lib/mock-data";
import type { RosterSession } from "@/lib/types";

describe("getPresetForEventType", () => {
  it("returns distinct presets per AEP type", () => {
    const aep1 = getPresetForEventType("AEP-1");
    const aep2 = getPresetForEventType("AEP-2");
    const aep3 = getPresetForEventType("AEP-3");
    expect(aep1.length).toBe(PRESET_AEP1.length);
    expect(aep2.length).toBe(PRESET_AEP2.length);
    expect(aep3.length).toBe(PRESET_AEP3.length);
    // AEP-1 añade Jurado×3; AEP-2/3 no llevan jurado.
    expect(aep1[0]?.roles.find((r) => r.key === "jurado")?.slots).toBe(3);
    expect(aep2[0]?.roles.some((r) => r.key === "jurado")).toBe(false);
    // AEP-2/3 al generar: speaker/mesa×2 y sin liftingcast/mesa (ordenador los engloba).
    expect(aep2[0]?.roles.find((r) => r.key === "speaker")?.slots).toBe(2);
    expect(aep2[0]?.roles.some((r) => r.key === "liftingcast" || r.key === "mesa")).toBe(
      false,
    );
  });
});

describe("pruneAssignments", () => {
  it("removes orphan assignments and flags when lineup shrinks", () => {
    const template = cloneTemplate(PRESET_AEP1).slice(0, 1);
    const keys = enumerateSlotKeys(template);
    const assignments: Record<string, string> = {
      [keys[0]!]: "ref-1",
      S99_central_0: "ref-orphan",
    };
    const flags = {
      [keys[0]!]: { compartido: true },
      S99_central_0: { intercambio: true },
    };
    const pruned = pruneAssignments(template, assignments, flags);
    expect(Object.keys(pruned.assignments)).toEqual([keys[0]]);
    expect(Object.keys(pruned.flags)).toEqual([keys[0]]);
    expect(pruned.flags[keys[0]!]?.compartido).toBe(true);
  });

  it("keeps only valid slot keys after template change", () => {
    const small = cloneTemplate(PRESET_AEP3);
    small[0]!.roles = small[0]!.roles.slice(0, 1).map((r) => ({ ...r, slots: 1 }));
    small[0]!.pesajeRoles = [];
    const valid = new Set(enumerateSlotKeys(small));
    const onlyKey = [...valid][0]!;
    const pruned = pruneAssignments(
      small,
      { [onlyKey]: "ref-1", orphan_key: "ref-2" },
      { orphan_key: { intercambio: true } },
    );
    expect(Object.keys(pruned.assignments)).toEqual([onlyKey]);
    expect(pruned.flags.orphan_key).toBeUndefined();
  });
});

describe("parseSlotKey", () => {
  it("parses a standard slot key", () => {
    expect(parseSlotKey("S1_central_0")).toEqual({
      session: "S1",
      roleKey: "central",
      index: 0,
    });
  });

  it("handles session names that contain underscores", () => {
    expect(parseSlotKey("Day_1_pesaje_2")).toEqual({
      session: "Day_1",
      roleKey: "pesaje",
      index: 2,
    });
  });

  it("rejects malformed keys", () => {
    expect(parseSlotKey("only_two")).toBeNull();
    expect(parseSlotKey("S1_central_x")).toBeNull();
    expect(parseSlotKey("")).toBeNull();
  });
});

describe("summarizeRequiredSlots", () => {
  const session: RosterSession = {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "",
    horarioPesaje: "",
    roles: [
      { rol: "Juez Central", slots: 1, key: "central" },
      { rol: "Juez Lateral", slots: 2, key: "lateral" },
      { rol: "Ordenador", slots: 1, key: "ordenador" },
      { rol: "Speaker / Mesa", slots: 1, key: "speaker" },
      { rol: "Juez Control", slots: 1, key: "control" },
    ],
    pesajeRoles: [
      { rol: "Pesaje", slots: 1, key: "pesaje" },
      { rol: "Control Equipamiento", slots: 1, key: "equipamiento" },
    ],
  };

  it("groups required slots into tarima / mesa-ordenador / control / pesaje", () => {
    const groups = summarizeRequiredSlots(session);
    expect(groups).toEqual([
      { key: "tarima", label: "Tarima", count: 3 }, // 1 central + 2 lateral
      { key: "mesa", label: "Mesa/Ordenador", count: 2 }, // ordenador + speaker
      { key: "control", label: "Control", count: 1 },
      { key: "pesaje", label: "Pesaje", count: 2 }, // pesaje + equipamiento
    ]);
  });

  it("breaks out jurado as its own group (AEP-1)", () => {
    const withJurado: RosterSession = {
      ...session,
      roles: [...session.roles, { rol: "Jurado", slots: 3, key: "jurado" }],
    };
    const groups = summarizeRequiredSlots(withJurado);
    expect(groups).toEqual([
      { key: "tarima", label: "Tarima", count: 3 },
      { key: "jurado", label: "Jurado", count: 3 },
      { key: "mesa", label: "Mesa/Ordenador", count: 2 },
      { key: "control", label: "Control", count: 1 },
      { key: "pesaje", label: "Pesaje", count: 2 },
    ]);
  });

  it("omits groups with no required slots", () => {
    const tarimaOnly: RosterSession = {
      ...session,
      roles: [{ rol: "Juez Central", slots: 1, key: "central" }],
      pesajeRoles: [],
    };
    const groups = summarizeRequiredSlots(tarimaOnly);
    expect(groups.map((g) => g.key)).toEqual(["tarima"]);
  });

  it("aggregates totals across every session of a template", () => {
    const groups = summarizeRequiredSlots([session, session]);
    expect(groups).toEqual([
      { key: "tarima", label: "Tarima", count: 6 },
      { key: "mesa", label: "Mesa/Ordenador", count: 4 },
      { key: "control", label: "Control", count: 2 },
      { key: "pesaje", label: "Pesaje", count: 4 },
    ]);
  });

  it("formats a compact summary string", () => {
    expect(formatRequiredSlots(session)).toBe(
      "Tarima 3 · Mesa/Ordenador 2 · Control 1 · Pesaje 2",
    );
  });
});

describe("mergeRosterTemplateSessions", () => {
  const session = (sesion: string): RosterSession => ({
    sesion,
    nombre: `Sesión ${sesion}`,
    dia: "Viernes",
    categorias: [{ genero: "Hombres", pesos: "-83kg" }],
    horarioCompeticion: "12:00",
    horarioPesaje: "10:00",
    roles: cloneTemplate(PRESET_AEP1)[0]!.roles,
    pesajeRoles: cloneTemplate(PRESET_AEP1)[0]!.pesajeRoles,
  });

  it("replaces only selected sessions and keeps the rest", () => {
    const existing = [session("S1"), session("S2"), session("S3")];
    const incoming = [{ ...session("S2"), nombre: "Sesión 2 importada" }];
    const merged = mergeRosterTemplateSessions(existing, incoming, new Set(["S2"]));
    expect(merged.map((s) => s.sesion)).toEqual(["S1", "S2", "S3"]);
    expect(merged[1]?.nombre).toBe("Sesión 2 importada");
    expect(merged[0]?.nombre).toBe("Sesión S1");
  });

  it("appends new sessions from import", () => {
    const existing = [session("S1")];
    const incoming = [session("S4")];
    const merged = mergeRosterTemplateSessions(existing, incoming, new Set(["S4"]));
    expect(merged.map((s) => s.sesion)).toEqual(["S1", "S4"]);
  });
});
