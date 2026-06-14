import { describe, it, expect } from "vitest";
import {
  cloneTemplate,
  enumerateSlotKeys,
  getPresetForEventType,
  pruneAssignments,
} from "@/lib/roster-template";
import { PRESET_AEP1, PRESET_AEP2, PRESET_AEP3 } from "@/lib/mock-data";

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
