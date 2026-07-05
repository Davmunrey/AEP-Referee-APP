import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseJudgesRegistryXlsx } from "@/lib/judges-registry";
import {
  aggregateArbitrajeYears,
  arbitrajeYears,
  emptyArbitrajeStats,
  type RefereeArbitrajeStatsByYear,
} from "@/lib/judges-registry/arbitraje-stats";

describe("aggregateArbitrajeYears", () => {
  it("sums role maps and ipf across calendar years", () => {
    const byYear: RefereeArbitrajeStatsByYear = {
      "2024": { aep1: {}, aep2: {}, aep3: { central: 2, lateral: 1 }, ipf: 1, total: 4 },
      "2025": { aep1: { jurado: 1 }, aep2: {}, aep3: { central: 3 }, ipf: 2, total: 6 },
    };
    const agg = aggregateArbitrajeYears(byYear);
    expect(agg.aep3.central).toBe(5);
    expect(agg.aep3.lateral).toBe(1);
    expect(agg.aep1.jurado).toBe(1);
    expect(agg.ipf).toBe(3);
    expect(agg.total).toBe(10);
  });

  it("returns an empty aggregate for no years", () => {
    expect(aggregateArbitrajeYears({})).toEqual(emptyArbitrajeStats());
  });
});

describe("arbitrajeYears", () => {
  it("lists years with activity, most recent first", () => {
    const byYear: RefereeArbitrajeStatsByYear = {
      "2024": { aep1: {}, aep2: {}, aep3: { central: 1 }, ipf: 0, total: 1 },
      "2026": { aep1: {}, aep2: {}, aep3: { central: 2 }, ipf: 0, total: 2 },
      "2025": { aep1: {}, aep2: {}, aep3: {}, ipf: 0, total: 0 },
    };
    expect(arbitrajeYears(byYear)).toEqual([2026, 2024]);
  });
});

/** Cabecera + una fila de arbitrajes para un juez (ID en col 0, central AEP3 en col 4). */
function arbitrajeSheetRows(id: number, centralAep3: number): unknown[][] {
  const header = ["ID", "Nombre", ...Array(26).fill("")];
  const row = Array(28).fill(0);
  row[0] = id;
  row[1] = "Juez";
  row[5] = centralAep3; // col 2 = mesa … col 5 = central (AEP3 tier begins at col 2)
  return [header, row];
}

function datosRows(): unknown[][] {
  // Columnas usadas por parseDatos: 0=ID, 1=Nombre, 2=Nivel, 4=Zona, 7=Activo.
  const header = Array(13).fill("");
  const row = Array(13).fill(null);
  row[0] = 7;
  row[1] = "Juez Multiaño";
  row[2] = "Nacional";
  row[4] = "2- CENTRO";
  row[7] = true;
  return [header, row];
}

function buildWorkbook(): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(datosRows()), "Datos");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(arbitrajeSheetRows(7, 2)),
    "Arbitrajes2024",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(arbitrajeSheetRows(7, 3)),
    "Arbitrajes2025",
  );
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

describe("parseJudgesRegistryXlsx multi-year arbitrajes", () => {
  it("reads every ArbitrajesAAAA sheet and aggregates by year", () => {
    const parsed = parseJudgesRegistryXlsx(buildWorkbook());
    const juez = parsed.referees.find((r) => r.excelId === 7);
    expect(juez).toBeTruthy();
    // Desglose por año natural.
    expect(juez?.arbitrajeStatsByYear?.["2024"]?.aep3.central).toBe(2);
    expect(juez?.arbitrajeStatsByYear?.["2025"]?.aep3.central).toBe(3);
    // Agregado histórico = suma de todos los años.
    expect(juez?.arbitrajeStats?.aep3.central).toBe(5);
    expect(juez?.arbitrajeStats?.total).toBe(5);
    expect(juez?.eventos).toBe(5);
  });
});
