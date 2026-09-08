import { describe, expect, it } from "vitest";
import { computeRosterCoverage, coveragePct, countRequiredSlots } from "@/lib/roster-coverage";
import { enumerateSlotKeys, normalizeCompetitionTemplate } from "@/lib/roster-template";
import { mapApproval } from "@/server/db/mappers";
import type { RosterSession } from "@/lib/types";

// `competitions.template` es JSONB: la base de datos no garantiza su forma.
// Filas escritas por versiones anteriores, importaciones a medias o ediciones
// manuales traen sesiones sin `roles` o con `slots` en texto. Como
// `normalizeCompetitionTemplate` se ejecuta al mapear CADA campeonato, lo que
// entra roto por aquí se lleva por delante pantallas enteras.

/** Fila tal y como puede venir de la base de datos, sin garantías de forma. */
function filaJsonb(patch: Record<string, unknown>): RosterSession[] {
  return [
    {
      sesion: "S1",
      nombre: "Sesión 1",
      dia: "Sábado",
      categorias: [],
      horarioCompeticion: "10:00 - 13:00",
      horarioPesaje: "08:00 - 09:30",
      roles: [{ key: "central", rol: "Central", slots: 2 }],
      pesajeRoles: [],
      ...patch,
    },
  ] as unknown as RosterSession[];
}

describe("plantilla con forma inesperada", () => {
  it("una sesión sin roles ya no tumba el mapeo de campeonatos", () => {
    // Antes: «session.roles is not iterable» dentro de cloneTemplate, y con él
    // la lista de campeonatos, el panel y la analítica al completo.
    const tpl = normalizeCompetitionTemplate(filaJsonb({ roles: undefined }), "AEP-2");
    expect(tpl[0]?.roles).toEqual([]);
    expect(countRequiredSlots(tpl)).toBe(0);
    expect(enumerateSlotKeys(tpl)).toEqual([]);
  });

  it("aguanta roles nulos, no-array y entradas basura", () => {
    expect(normalizeCompetitionTemplate(filaJsonb({ roles: null }), "AEP-2")[0]?.roles).toEqual([]);
    expect(normalizeCompetitionTemplate(filaJsonb({ roles: "roto" }), "AEP-2")[0]?.roles).toEqual([]);
    expect(
      normalizeCompetitionTemplate(filaJsonb({ roles: [null, 3, "x"] }), "AEP-2")[0]?.roles,
    ).toEqual([]);
  });

  it("`slots` en texto se suma, no se concatena", () => {
    // `total += role.slots` con "3" y "2" daba 32 plazas requeridas, y ese
    // número se persistía en la competición.
    const tpl = normalizeCompetitionTemplate(
      filaJsonb({
        roles: [
          { key: "central", rol: "Central", slots: "3" },
          { key: "lateral", rol: "Lateral", slots: "2" },
        ],
      }),
      "AEP-2",
    );
    expect(countRequiredSlots(tpl)).toBe(5);
    expect(enumerateSlotKeys(tpl)).toHaveLength(5);
  });

  it("`slots` imposible cuenta como cero en vez de contaminar el total", () => {
    for (const slots of [null, undefined, "muchas", -4, Number.NaN, Infinity]) {
      const tpl = normalizeCompetitionTemplate(
        filaJsonb({ roles: [{ key: "central", rol: "Central", slots }] }),
        "AEP-2",
      );
      expect(countRequiredSlots(tpl), String(slots)).toBe(0);
    }
  });

  it("`slots` decimal se trunca a plazas enteras", () => {
    const tpl = normalizeCompetitionTemplate(
      filaJsonb({ roles: [{ key: "central", rol: "Central", slots: 2.7 }] }),
      "AEP-2",
    );
    expect(countRequiredSlots(tpl)).toBe(2);
  });

  it("una plantilla que no es un array se trata como ausente", () => {
    expect(normalizeCompetitionTemplate({} as unknown as RosterSession[], "AEP-2")).toEqual([]);
    expect(normalizeCompetitionTemplate("roto" as unknown as RosterSession[], "AEP-2")).toEqual([]);
    expect(normalizeCompetitionTemplate([null, 7] as unknown as RosterSession[], "AEP-2")).toEqual([]);
  });

  it("los campos de texto sobreviven a un número o un nulo", () => {
    const tpl = normalizeCompetitionTemplate(filaJsonb({ sesion: 1, nombre: null, dia: 5 }), "AEP-2");
    expect(tpl[0]?.sesion).toBe("1");
    expect(tpl[0]?.nombre).toBe("");
    expect(tpl[0]?.dia).toBe("5");
  });

  it("una plantilla sana no se toca", () => {
    const tpl = normalizeCompetitionTemplate(filaJsonb({}), "AEP-2");
    expect(tpl[0]?.roles).toEqual([{ key: "central", rol: "Central", slots: 2 }]);
    expect(countRequiredSlots(tpl)).toBe(2);
  });
});

describe("cobertura con números imposibles", () => {
  it("no se pinta «NaN%»", () => {
    expect(coveragePct(Number.NaN, 5)).toBe(0);
    expect(coveragePct(2, Number.NaN)).toBe(0);
    expect(coveragePct(2, 0)).toBe(0);
  });

  it("una plantilla rota cae al fallback de plazas requeridas", () => {
    // Sin plantilla utilizable, la cobertura se cuenta desde las asignaciones
    // reales contra el `requeridos` guardado en la competición.
    const tpl = normalizeCompetitionTemplate(filaJsonb({ roles: null }), "AEP-2");
    const cobertura = computeRosterCoverage(tpl, { S1_central_0: "r1" }, 4);
    expect(cobertura.requeridos).toBe(4);
    expect(cobertura.confirmados).toBe(1);
    expect(cobertura.pct).toBe(25);
  });
});

describe("snapshot de propuesta con forma inesperada", () => {
  function propuesta(assignments: unknown) {
    return mapApproval({
      id: "ap-1",
      competition_id: "evt-1",
      competition_name: "Copa",
      zona: "CENTRO",
      submitted_by: "Ana",
      submitted_at: "2026-01-01",
      status: "pendiente",
      assignments,
    });
  }

  it("una cadena o un array dejan de pasar como mapa de asignaciones", () => {
    // `Object.entries("roto")` daba pares ["0","r"], ["1","o"]…: el panel de
    // aprobaciones pintaba filas inventadas y la revisión intentaba insertar
    // asignaciones con claves numéricas.
    expect(propuesta("roto").assignments).toEqual({});
    expect(propuesta([1, 2]).assignments).toEqual({});
    expect(propuesta(null).assignments).toEqual({});
  });

  it("descarta los valores que no son un id de juez", () => {
    expect(propuesta({ S1_central_0: "r1", S1_lateral_0: null, S1_mesa_0: 7, S1_jurado_0: "" })
      .assignments).toEqual({ S1_central_0: "r1" });
  });

  it("un snapshot sano no se toca", () => {
    expect(propuesta({ S1_central_0: "r1", S1_lateral_0: "r2" }).assignments).toEqual({
      S1_central_0: "r1",
      S1_lateral_0: "r2",
    });
  });
});
