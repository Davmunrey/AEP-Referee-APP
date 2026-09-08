import { describe, expect, it } from "vitest";
import { COMPENSATION_RATE_TABLE } from "@/lib/judge-compensation/normativa-content";
import {
  competitionManagerRate,
  KM_RATE_EUR,
  LODGING_PER_DAY_EUR,
  unitRateForDuty,
} from "@/lib/judge-compensation/rates";

function fila(concept: string) {
  const row = COMPENSATION_RATE_TABLE.find((r) => r.concept.startsWith(concept));
  if (!row) throw new Error(`Falta la fila ${concept} en la tabla de la normativa`);
  return row;
}
const num = (cell: string) => Number(cell.replace(/[^\d.,]/g, "").replace(",", "."));

describe("el baremo que se enseña es el que se paga", () => {
  // La tabla de la normativa llevaba las cifras escritas a mano mientras las
  // cuentas salían de `rates.ts`. Mientras coincidan no pasa nada; el día que
  // se actualice el baremo, la pantalla seguiría enseñando el anterior y el
  // juez cobraría otra cosa distinta de la que le prometen.
  it("pesaje y sesión coinciden con la tarifa que aplica el cálculo", () => {
    const pesaje = fila("Pesaje");
    expect(num(pesaje.aep3)).toBe(unitRateForDuty("pesaje", "AEP-3", "nacional"));
    expect(num(pesaje.aep1)).toBe(unitRateForDuty("pesaje", "AEP-1", "nacional"));
    expect(num(pesaje.intl)).toBe(unitRateForDuty("pesaje", "AEP-1", "ipf"));

    const sesion = fila("Sesión");
    expect(num(sesion.aep2)).toBe(unitRateForDuty("session", "AEP-2", "nacional"));
    expect(num(sesion.aep1)).toBe(unitRateForDuty("session", "AEP-1", "nacional"));
    expect(num(sesion.intl)).toBe(unitRateForDuty("session", "AEP-1", "ipf"));
  });

  it("el responsable de competición también, incluido el 0 € internacional", () => {
    const resp = fila("Responsable");
    expect(num(resp.aep3)).toBe(competitionManagerRate("AEP-3", "nacional", false, 1));
    expect(num(resp.aep1)).toBe(competitionManagerRate("AEP-1", "nacional", false, 1));
    expect(num(resp.intl)).toBe(competitionManagerRate("AEP-1", "ipf", false, 1));
    // El asterisco remite a la nota de AEP-1 (por día o dos responsables).
    expect(resp.aep1).toContain("*");
  });

  it("km y alojamiento siguen saliendo de sus constantes", () => {
    expect(num(fila("Km").aep3)).toBe(KM_RATE_EUR);
    expect(num(fila("Alojamiento").aep3)).toBe(LODGING_PER_DAY_EUR);
  });
});
