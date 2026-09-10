import { describe, expect, it } from "vitest";
import {
  assessCompensationReadiness,
  buildCompensationClaim,
  type CompensationClaim,
  type CompensationClaimInput,
} from "@/lib/judge-compensation";
import type { Competition } from "@/lib/types";

/**
 * Una liquidación «fuera de tarima» no bloquea el envío de los recibos.
 *
 * Cuando a un juez lo sustituyen después de haberle creado la liquidación, su
 * fila se conserva y se marca —esconder un importe registrado sería peor—,
 * pero no forma parte de la tarima vigente: sus km pendientes no pueden
 * impedir que se envíen los recibos de quienes sí están.
 *
 * Ese descarte vivía en `summarizeCompensation`, o sea solo en el servidor. La
 * pantalla de liquidación vuelve a calcular la preparación por su cuenta cada
 * vez que se edita una fila, y lo hacía con la lista entera: al tocar
 * cualquier casilla, el juez fuera de tarima aparecía en «km pendientes» y el
 * botón de exportar se apagaba, hasta recargar la página. El mismo tablero
 * decía dos cosas distintas sobre el mismo campeonato.
 */

const COMPETICION = {
  id: "evt-1",
  nombre: "Campeonato",
  tipo: "AEP-2",
  fecha: "2026-03-14",
  fechaFin: "2026-03-15",
  zona: "CENTRO",
  sede: "Madrid",
  sesiones: 2,
  requeridos: 6,
  confirmados: 0,
  estado: "Borrador",
  compensationOrganizer: "aep",
} as unknown as Competition;

function claim(
  refereeId: string,
  refereeName: string,
  over: Partial<CompensationClaimInput> = {},
): CompensationClaim {
  const input: CompensationClaimInput = {
    competitionId: "evt-1",
    refereeId,
    refereeName,
    tipo: "AEP-2",
    ambito: "nacional",
    fecha: "2026-03-14",
    fechaFin: "2026-03-15",
    dutyLines: [
      {
        dutyType: "session",
        session: "S1",
        roleKey: "central",
        roleLabel: "Juez Central",
        unitAmount: 30,
        quantity: 1,
        amount: 30,
        slotKeys: ["S1_central_0"],
      },
    ],
    travelMode: "km_rate",
    distanceKmRoundTrip: 100,
    travelApproved: false,
    isCompetitionManager: false,
    competitionManagerPerDay: false,
    isComputerSetup: false,
    status: "borrador",
    ...over,
  };
  return buildCompensationClaim(`claim-${refereeId}`, input);
}

function preparacion(claims: CompensationClaim[]) {
  return assessCompensationReadiness({
    competition: COMPETICION,
    claims,
    refereesById: new Map(),
    organizerIsClub: false,
    clubEmails: [],
  });
}

describe("un juez al que sustituyeron, con su liquidación a medias", () => {
  const enTarima = claim("j-1", "Ana Ruiz");
  const fueraDeTarima: CompensationClaim = {
    ...claim("j-2", "Luis Soto", { distanceKmRoundTrip: undefined }),
    offRoster: true,
  };

  it("no aparece entre los km pendientes", () => {
    const r = preparacion([enTarima, fueraDeTarima]);
    expect(r.pendingTravelReferees).toEqual([]);
    expect(r.allTravelResolved).toBe(true);
  });

  it("no deja el aviso de km sobre la mesa", () => {
    const r = preparacion([enTarima, fueraDeTarima]);
    expect(r.issues).toEqual([]);
  });

  it("y no apaga el botón de exportar", () => {
    expect(preparacion([enTarima, fueraDeTarima]).readyForExport).toBe(true);
  });

  it("da el mismo resultado que si ya no estuviera en la lista", () => {
    expect(preparacion([enTarima, fueraDeTarima])).toEqual(preparacion([enTarima]));
  });
});

describe("y el que sí está en la tarima sigue mandando", () => {
  it("sin sus km, la exportación se queda bloqueada y lo dice", () => {
    const sinKm = claim("j-1", "Ana Ruiz", { distanceKmRoundTrip: undefined });
    const r = preparacion([sinKm]);
    expect(r.pendingTravelReferees).toEqual(["Ana Ruiz"]);
    expect(r.readyForExport).toBe(false);
    expect(r.issues.join(" ")).toContain("Ana Ruiz");
  });

  it("sin ninguna liquidación de tarima no hay nada que exportar", () => {
    const soloHuerfana: CompensationClaim = { ...claim("j-2", "Luis Soto"), offRoster: true };
    expect(preparacion([soloHuerfana]).readyForExport).toBe(false);
  });
});
