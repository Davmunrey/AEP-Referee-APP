import { describe, expect, it } from "vitest";
import { sessionOrder, compareSessions } from "@/lib/session-order";
import { nextSessionId } from "@/components/competitions/roster-session-helpers";
import { buildRefereeCompetitionHistory } from "@/lib/referee-competition-history";
import type { Competition } from "@/lib/types";

/**
 * El número de una sesión se lee en UN sitio: `sessionOrder`, que toma el
 * PRIMER grupo de dígitos —«Sesión 2 grupo 3» es la 2, no la 23— y manda al
 * final lo que no lleva número.
 *
 * El código de sesión es texto libre: el editor de plantilla tiene un campo
 * abierto con «S1» de sugerencia, y el horario en PDF trae lo que traiga. Tres
 * sitios más lo volvían a deducir con `replace(/\D/g, "")`, que concatena todos
 * los dígitos, y uno de ellos además mandaba las sesiones sin número las
 * primeras (`|| 0`) en vez de las últimas.
 */

describe("la regla, en su sitio", () => {
  it("toma el primer grupo de dígitos", () => {
    expect(sessionOrder("Sesión 2 grupo 3")).toBe(2);
    expect(sessionOrder("S10")).toBe(10);
  });

  it("y manda al final lo que no lleva número", () => {
    expect(sessionOrder("Mañana")).toBe(Number.MAX_SAFE_INTEGER);
    expect(compareSessions("S9", "Mañana")).toBeLessThan(0);
  });
});

describe("el siguiente código de sesión que propone el editor", () => {
  it("sigue al número más alto, no al de más cifras concatenadas", () => {
    expect(nextSessionId([{ sesion: "S1 - grupo 2" } as never])).toBe("S2");
  });

  it("cuenta bien una lista normal", () => {
    expect(nextSessionId([{ sesion: "S1" }, { sesion: "S2" }] as never[])).toBe("S3");
  });

  it("empieza en S1 sin sesiones, y también si ninguna lleva número", () => {
    expect(nextSessionId([])).toBe("S1");
    expect(nextSessionId([{ sesion: "Mañana" }] as never[])).toBe("S1");
  });

  it("no se sale del rango por una sesión sin número", () => {
    expect(nextSessionId([{ sesion: "S3" }, { sesion: "Tarde" }] as never[])).toBe("S4");
  });
});

describe("el historial de campeonatos del juez", () => {
  const competitions = [
    {
      id: "evt-1",
      nombre: "Campeonato",
      tipo: "AEP-2",
      fecha: "2026-03-14",
      fechaFin: "2026-03-15",
      zona: "CENTRO",
      sede: "Madrid",
      sesiones: 3,
      requeridos: 9,
      confirmados: 0,
      estado: "Borrador",
    } as unknown as Competition,
  ];

  it("ordena «Sesión 2 grupo 3» antes que la 10, no después", () => {
    const [item] = buildRefereeCompetitionHistory(competitions, [
      { competitionId: "evt-1", slotKey: "S10_central_0" },
      { competitionId: "evt-1", slotKey: "Sesión 2 grupo 3_central_0" },
    ]);
    expect(item!.positions.map((p) => p.session)).toEqual([
      "Sesión 2 grupo 3",
      "S10",
    ]);
  });

  it("y sigue ordenando las sesiones corrientes por su número", () => {
    const [item] = buildRefereeCompetitionHistory(competitions, [
      { competitionId: "evt-1", slotKey: "S10_central_0" },
      { competitionId: "evt-1", slotKey: "S2_central_0" },
    ]);
    expect(item!.positions.map((p) => p.session)).toEqual(["S2", "S10"]);
  });
});

/**
 * La vista previa del cuadrante ordena con el mismo comparador. Antes lo hacía
 * con `Number(session.replace(/\D/g, "")) || 0`, que además de concatenar los
 * dígitos mandaba las sesiones sin número las PRIMERAS, delante de S1.
 */
describe("el orden de la vista previa del cuadrante", () => {
  it("pone las sesiones sin número al final, no delante de S1", () => {
    expect(["Mañana", "S1", "S10", "Sesión 2 grupo 3"].sort(compareSessions)).toEqual([
      "S1",
      "Sesión 2 grupo 3",
      "S10",
      "Mañana",
    ]);
  });
});
