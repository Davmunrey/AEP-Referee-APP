import { describe, expect, it } from "vitest";
import {
  markCrossZoneCandidates,
  type QuadrantAssignmentCandidate,
} from "@/lib/quadrant-parser";

function candidate(
  over: Partial<QuadrantAssignmentCandidate> = {},
): QuadrantAssignmentCandidate {
  return {
    key: "k1",
    session: "S1",
    roleKey: "central",
    roleLabel: "Juez Central",
    slotKey: "S1_central_0",
    refereeId: "j1",
    refereeName: "Ana Ruiz",
    confidence: "alta",
    importable: true,
    reason: "coincidencia exacta",
    ...over,
  };
}

describe("importar un cuadrante con jueces de otras zonas", () => {
  const zonas = new Map<string, string | undefined>([
    ["j1", "CENTRO"],
    ["j2", "ANDALUCIA"],
    ["j3", "2- CENTRO"],
    ["j4", undefined],
  ]);

  it("marca al juez de otra zona y respeta al de la propia", () => {
    const [propio, ajeno] = markCrossZoneCandidates(
      [candidate({ refereeId: "j1" }), candidate({ key: "k2", refereeId: "j2" })],
      zonas,
      "CENTRO",
    );
    expect(propio?.crossZone).toBe(false);
    expect(ajeno?.crossZone).toBe(true);
    expect(ajeno?.refereeZona).toBe("ANDALUCIA");
    // Se marca, no se descarta: el cruce es una función real de la aplicación.
    expect(ajeno?.importable).toBe(true);
  });

  it("un alias de la misma zona no es un cruce", () => {
    const [alias] = markCrossZoneCandidates([candidate({ refereeId: "j3" })], zonas, "CENTRO");
    expect(alias?.crossZone).toBe(false);
  });

  it("sin zona en algún lado no se afirma el cruce", () => {
    const [sinZonaJuez] = markCrossZoneCandidates([candidate({ refereeId: "j4" })], zonas, "CENTRO");
    expect(sinZonaJuez?.crossZone).toBe(false);
    const [sinZonaComp] = markCrossZoneCandidates([candidate({ refereeId: "j2" })], zonas, null);
    expect(sinZonaComp?.crossZone).toBe(false);
  });

  it("una fila sin juez emparejado se deja intacta", () => {
    const [sinJuez] = markCrossZoneCandidates(
      [candidate({ refereeId: null, importable: false })],
      zonas,
      "CENTRO",
    );
    expect(sinJuez?.crossZone).toBeUndefined();
    expect(sinJuez?.refereeZona).toBeUndefined();
  });
});
