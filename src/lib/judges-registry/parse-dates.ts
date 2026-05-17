import * as XLSX from "xlsx";

const ES_MONTH: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dic: "12",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function iso(y: number, m: string, d: number): string {
  return `${y}-${m}-${pad2(d)}`;
}

/** Excel serial o texto español → YYYY-MM-DD. */
export function excelDateToIso(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && v > 30000) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return iso(parsed.y, pad2(parsed.m), parsed.d);
  }
  const s = typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
  if (!s) return undefined;

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    return iso(y, pad2(Number(dmy[2])), Number(dmy[1]));
  }

  const es = s.match(
    /(\d{1,2})[-/]([a-z]{3,5})[-/](\d{2,4})/i,
  );
  if (es) {
    const mon = ES_MONTH[es[2]!.toLowerCase().slice(0, 4)] ?? ES_MONTH[es[2]!.toLowerCase().slice(0, 3)];
    if (mon) {
      const y = es[3]!.length === 2 ? 2000 + Number(es[3]) : Number(es[3]);
      return iso(y, mon, Number(es[1]));
    }
  }

  return undefined;
}

/** «28-Feb/01-Mar-26» o «21/22-Mar-26» → inicio y fin. */
export function parseCompetitionDateRange(
  rawStart: unknown,
  rawEnd?: unknown,
): { fecha: string; fechaFin: string } | undefined {
  const endFromCol = excelDateToIso(rawEnd);
  const startStr = typeof rawStart === "string" ? rawStart.trim() : String(rawStart ?? "").trim();
  if (!startStr && endFromCol) {
    return { fecha: endFromCol, fechaFin: endFromCol };
  }
  if (!startStr) return undefined;

  const slashRange = startStr.match(
    /(\d{1,2})[-/]([a-z]{3,5})[-/](\d{1,2})[-/]([a-z]{3,5})[-/](\d{2,4})/i,
  );
  if (slashRange) {
    const y = slashRange[5]!.length === 2 ? 2000 + Number(slashRange[5]) : Number(slashRange[5]);
    const m1 = ES_MONTH[slashRange[2]!.toLowerCase().slice(0, 3)];
    const m2 = ES_MONTH[slashRange[4]!.toLowerCase().slice(0, 3)];
    if (m1 && m2) {
      const fecha = iso(y, m1, Number(slashRange[1]));
      const fechaFin = iso(y, m2, Number(slashRange[3]));
      return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
    }
  }

  const dualDay = startStr.match(
    /^(\d{1,2})[/_](\d{1,2})[-/]([a-z]{3,5})[-/](\d{2,4})$/i,
  );
  if (dualDay) {
    const mon = ES_MONTH[dualDay[3]!.toLowerCase().slice(0, 3)];
    if (mon) {
      const y = dualDay[4]!.length === 2 ? 2000 + Number(dualDay[4]) : Number(dualDay[4]);
      const fecha = iso(y, mon, Number(dualDay[1]));
      const fechaFin = iso(y, mon, Number(dualDay[2]));
      return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
    }
  }

  const fecha = excelDateToIso(startStr);
  if (!fecha) return undefined;
  const fechaFin = endFromCol ?? fecha;
  return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
}
