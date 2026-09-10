import { describe, expect, it } from "vitest";
import { formatRosterExport } from "@/lib/roster-export";
import { enumerateSlotKeys } from "@/lib/roster-template";
import { countRequiredSlots } from "@/lib/roster-coverage";
import type { RosterSession } from "@/lib/types";

/**
 * Los puestos del acta son los huecos canónicos.
 *
 * `enumerateSlotKeys` es quien define la lista de huecos para la cobertura, el
 * dinero y el cuadrante, y quita repetidos: dos filas del mismo rol en una
 * sesión —o dos sesiones con el mismo código— comparten las claves
 * `${sesion}_${rol}_${índice}`, así que la segunda no aporta ningún hueco
 * asignable.
 *
 * El acta se construía la lista por su cuenta recorriendo `slots`, sin quitar
 * repetidos. Imprimía el puesto DOS VECES, con el mismo juez en las dos líneas,
 * mientras el cuadrante en Excel y en HTML lo imprimían una: dos documentos
 * oficiales del mismo campeonato, cada uno con un número de puestos distinto.
 *
 * El editor y la importación ya rechazan estas plantillas, pero nadie normalizó
 * las que se guardaron antes de esas guardas: siguen en `competitions.template`.
 */

const COMP = {
  nombre: "Campeonato",
  fecha: "2026-03-14",
  fechaFin: "2026-03-15",
  sede: "Madrid",
  tipo: "AEP-2",
};

const JUECES: Record<string, { nombre: string; nivel: string }> = {
  "j-1": { nombre: "Ana Ruiz", nivel: "Nacional" },
};

const lookup = (id: string) => JUECES[id];

function sesion(sesionId: string, roles: RosterSession["roles"]): RosterSession {
  return {
    sesion: sesionId,
    nombre: `Sesión ${sesionId}`,
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00 - 13:00",
    horarioPesaje: "08:00 - 09:30",
    roles,
    pesajeRoles: [],
  };
}

function contarLineas(acta: string, etiqueta: string): number {
  return acta.split("\n").filter((l) => l.trim().startsWith(`- ${etiqueta}`)).length;
}

/** Puestos del acta: las líneas que empiezan por «- ». */
function puestosDelActa(acta: string): number {
  return acta.split("\n").filter((l) => l.trim().startsWith("- ")).length;
}

describe("una plantilla con el mismo rol en dos filas de la sesión", () => {
  const template = [
    sesion("S1", [
      { key: "central", rol: "Juez Central", slots: 1 },
      { key: "lateral", rol: "Juez Lateral", slots: 2 },
      // La fila de más: comparte las claves S1_lateral_0 y S1_lateral_1.
      { key: "lateral", rol: "Juez Lateral", slots: 2 },
    ]),
  ];
  const assignments = { S1_central_0: "j-1", S1_lateral_0: "j-1" };

  it("no imprime el mismo puesto dos veces", () => {
    const acta = formatRosterExport(COMP, template, assignments, lookup);
    expect(contarLineas(acta, "Juez Lateral 1")).toBe(1);
    expect(contarLineas(acta, "Juez Lateral 2")).toBe(1);
  });

  it("y su número de puestos es el de la lista canónica", () => {
    const acta = formatRosterExport(COMP, template, assignments, lookup);
    expect(puestosDelActa(acta)).toBe(enumerateSlotKeys(template).length);
    expect(puestosDelActa(acta)).toBe(countRequiredSlots(template));
  });
});

describe("una plantilla con dos sesiones del mismo código", () => {
  const template = [
    sesion("S1", [{ key: "central", rol: "Juez Central", slots: 1 }]),
    sesion("S1", [{ key: "central", rol: "Juez Central", slots: 1 }]),
  ];

  it("tampoco duplica el puesto", () => {
    const acta = formatRosterExport(COMP, template, {}, lookup);
    expect(contarLineas(acta, "Juez Central")).toBe(1);
    expect(puestosDelActa(acta)).toBe(enumerateSlotKeys(template).length);
  });
});

describe("una plantilla normal no cambia", () => {
  const template = [
    sesion("S1", [
      { key: "central", rol: "Juez Central", slots: 1 },
      { key: "lateral", rol: "Juez Lateral", slots: 2 },
    ]),
    sesion("S2", [{ key: "central", rol: "Juez Central", slots: 1 }]),
  ];

  it("imprime todos sus puestos, una vez cada uno", () => {
    const acta = formatRosterExport(COMP, template, { S1_central_0: "j-1" }, lookup);
    expect(puestosDelActa(acta)).toBe(4);
    expect(puestosDelActa(acta)).toBe(enumerateSlotKeys(template).length);
  });

  it("y sigue distinguiendo el hueco vacío del juez que ya no está en el censo", () => {
    const acta = formatRosterExport(
      COMP,
      template,
      { S1_central_0: "j-1", S1_lateral_0: "j-borrado" },
      lookup,
    );
    expect(acta).toContain("Ana Ruiz (Nacional)");
    expect(acta).toContain("— JUEZ NO ENCONTRADO EN EL CENSO");
    expect(acta).toContain("— VACÍO");
  });
});
