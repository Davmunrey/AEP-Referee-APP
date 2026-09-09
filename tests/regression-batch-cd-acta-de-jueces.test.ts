import { describe, expect, it } from "vitest";
import {
  EXPORT_REF_NOT_FOUND,
  EXPORT_SLOT_EMPTY,
  formatRosterExport,
} from "@/lib/roster-export";
import type { RosterSession } from "@/lib/types";

/**
 * El acta de plantilla de jueces es el documento oficial de la designación: el
 * que se manda. Y no tenía ni una prueba.
 *
 * En él, «VACÍO» significa que el puesto está por cubrir. Se imprimía también
 * cuando el puesto SÍ estaba asignado y el juez no aparecía en el censo —lo
 * borraron después de designarlo—, que es lo contrario. Y el mapa de jueces se
 * construía tirando el error de lectura, así que un corte imprimía el acta
 * entera con todos los puestos «VACÍO».
 */

const COMP = {
  nombre: "Open de Primavera",
  fecha: "2026-05-01",
  fechaFin: "2026-05-02",
  sede: "Madrid",
  tipo: "AEP-2",
};

const TEMPLATE: RosterSession[] = [
  {
    sesion: "S1",
    nombre: "Sesión 1",
    dia: "Sábado",
    categorias: [],
    horarioCompeticion: "10:00",
    horarioPesaje: "08:00",
    roles: [{ key: "central", rol: "Juez Central", slots: 1 }],
    pesajeRoles: [],
  } as RosterSession,
];

const CENSO = new Map([["ref-1", { nombre: "Ana Ruiz", nivel: "Nacional" }]]);
const buscar = (id: string) => CENSO.get(id);

describe("el acta distingue un puesto vacío de un juez que ya no consta", () => {
  it("un puesto sin asignar sale como vacío", () => {
    const texto = formatRosterExport(COMP, TEMPLATE, {}, buscar);
    expect(texto).toContain(`Juez Central: ${EXPORT_SLOT_EMPTY}`);
  });

  it("un juez asignado que no aparece en el censo NO sale como vacío", () => {
    const texto = formatRosterExport(COMP, TEMPLATE, { S1_central_0: "ref-borrado" }, buscar);
    expect(texto).toContain(`Juez Central: ${EXPORT_REF_NOT_FOUND}`);
    expect(texto).not.toContain(EXPORT_SLOT_EMPTY);
  });

  it("un juez normal sale con su nombre y su nivel", () => {
    const texto = formatRosterExport(COMP, TEMPLATE, { S1_central_0: "ref-1" }, buscar);
    expect(texto).toContain("Juez Central: Ana Ruiz (Nacional)");
  });

  it("las marcas de compartido e intercambio siguen saliendo", () => {
    const texto = formatRosterExport(
      COMP,
      TEMPLATE,
      { S1_central_0: "ref-1" },
      buscar,
      { S1_central_0: { compartido: true, intercambio: true } },
    );
    expect(texto).toContain("Ana Ruiz (Nacional) * ↑↓");
  });

  it("la cabecera lleva campeonato, tipo, fechas y sede", () => {
    const texto = formatRosterExport(COMP, TEMPLATE, {}, buscar);
    expect(texto).toContain("Campeonato: Open de Primavera");
    expect(texto).toContain("Tipo:   AEP-2");
    expect(texto).toContain("Fechas: 2026-05-01 – 2026-05-02");
    expect(texto).toContain("Sede:   Madrid");
    expect(texto).toContain("═══  SÁBADO  ═══");
  });
});
