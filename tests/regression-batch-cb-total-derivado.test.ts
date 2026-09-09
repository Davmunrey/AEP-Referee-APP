import { describe, expect, it } from "vitest";
import { arbitrajeStatsTotal, arbitrajeYears } from "@/lib/judges-registry/arbitraje-stats";
import { mapReferee } from "@/server/db/mappers";
import type { RefereeArbitrajeStatsByYear } from "@/lib/judges-registry/arbitraje-stats";

/**
 * `total` es la suma de los recuentos por rol: un dato derivado guardado junto
 * a los datos de los que deriva. En cuanto los dos discrepan —un JSONB de una
 * importación antigua, una corrección a mano— gana el que se mira, y aquí se
 * mira el total.
 *
 * Y lo que cuelga de él no es cosmético: `arbitrajeYears` esconde el año entero
 * si el total está a cero, y el recuento de eventos que sostiene un ascenso
 * sale de ahí. Un juez podía quedarse sin años y sin arbitrajes con sus
 * recuentos intactos en la misma fila.
 */

const FILA_CON_TOTAL_A_CERO = {
  id: "ref-1",
  nombre: "Ana Ruiz",
  zona: "CENTRO",
  nivel: "Nacional",
  estado: "Activo",
  arbitraje_stats_by_year: {
    "2025": { aep1: { central: 3 }, aep2: { lateral: 2 }, aep3: {}, ipf: 1, total: 0 },
  },
  arbitraje_stats: { aep1: { central: 3 }, aep2: { lateral: 2 }, aep3: {}, ipf: 1, total: 0 },
};

describe("el total de arbitrajes se recalcula al leer", () => {
  it("un total a cero con recuentos dentro deja de mentir", () => {
    const referee = mapReferee(FILA_CON_TOTAL_A_CERO);
    expect(referee.arbitrajeStats?.total).toBe(6);
    expect(referee.arbitrajeStatsByYear?.["2025"]?.total).toBe(6);
  });

  it("y el año vuelve a aparecer en la lista", () => {
    const referee = mapReferee(FILA_CON_TOTAL_A_CERO);
    expect(arbitrajeYears(referee.arbitrajeStatsByYear as RefereeArbitrajeStatsByYear)).toEqual([
      2025,
    ]);
  });

  it("un recuento ilegible no envenena la suma", () => {
    // `Number("tres")` es NaN, y NaN se propaga por toda la suma.
    const referee = mapReferee({
      ...FILA_CON_TOTAL_A_CERO,
      arbitraje_stats: { aep1: { central: "tres", lateral: 2 }, aep2: {}, aep3: {}, ipf: 1 },
    });
    expect(referee.arbitrajeStats?.total).toBe(3);
    expect(Number.isFinite(referee.arbitrajeStats?.total)).toBe(true);
  });

  it("un año realmente vacío sigue sin aparecer", () => {
    const vacio: RefereeArbitrajeStatsByYear = {
      "2024": { aep1: {}, aep2: {}, aep3: {}, ipf: 0, total: 0 },
    };
    expect(arbitrajeYears(vacio)).toEqual([]);
    expect(arbitrajeStatsTotal(vacio["2024"]!)).toBe(0);
  });
});
