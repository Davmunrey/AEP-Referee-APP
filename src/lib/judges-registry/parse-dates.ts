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

/**
 * La fecha, o `undefined` si ese día no existe en ese mes.
 *
 * El rango 1-31 no basta: «31/02/2026» lo pasaba y salía «2026-02-31». En una
 * columna de competición eso se convierte ahora en un aviso con la fila; en la
 * ficha de un juez se guardaba tal cual.
 */
function isoReal(y: number, m: string, d: number): string | undefined {
  const mes = Number(m);
  const fecha = new Date(Date.UTC(y, mes - 1, d));
  if (
    fecha.getUTCFullYear() !== y ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== d
  ) {
    return undefined;
  }
  return iso(y, m, d);
}

/**
 * Año de dos cifras.
 *
 * `2000 + yy` sin más convertía la antigüedad de un juez de 1985 en 2085, y la
 * de 1999 en 2099: son fechas que se escriben a mano en el Excel del censo y
 * las más antiguas son justo las de los jueces con más recorrido. Convenio
 * habitual: de 70 en adelante, siglo XX.
 */
function yearFrom2Digits(raw: string): number {
  const yy = Number(raw);
  return yy >= 70 ? 1900 + yy : 2000 + yy;
}

/** Excel serial o texto español → YYYY-MM-DD. */
export function excelDateToIso(v: unknown): string | undefined {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return iso(v.getFullYear(), pad2(v.getMonth() + 1), v.getDate());
  }
  if (typeof v === "number" && v > 30000) {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) return iso(parsed.y, pad2(parsed.m), parsed.d);
  }
  const s = typeof v === "string" ? v.trim() : v != null ? String(v).trim() : "";
  if (!s) return undefined;

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    // Sin validar rangos, una celda en formato US (MM/DD) producía fechas ISO
    // inválidas ("2026-13-05") que se colaban en la BD sin aviso.
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined;
    const y = dmy[3]!.length === 2 ? yearFrom2Digits(dmy[3]!) : Number(dmy[3]);
    return isoReal(y, pad2(mm), dd);
  }

  const es = s.match(
    /(\d{1,2})[-/]([a-z]{3,5})[-/](\d{2,4})/i,
  );
  if (es) {
    const mon = ES_MONTH[es[2]!.toLowerCase().slice(0, 4)] ?? ES_MONTH[es[2]!.toLowerCase().slice(0, 3)];
    if (mon) {
      const y = es[3]!.length === 2 ? yearFrom2Digits(es[3]!) : Number(es[3]);
      return isoReal(y, mon, Number(es[1]));
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
    const y =
      slashRange[5]!.length === 2 ? yearFrom2Digits(slashRange[5]!) : Number(slashRange[5]);
    const m1 = ES_MONTH[slashRange[2]!.toLowerCase().slice(0, 3)];
    const m2 = ES_MONTH[slashRange[4]!.toLowerCase().slice(0, 3)];
    if (m1 && m2) {
      // Rango que cruza el año (31-Dic/01-Ene-26): el año escrito corresponde
      // al extremo FINAL; el inicio en un mes posterior pertenece al año previo.
      const startYear = m2 < m1 ? y - 1 : y;
      const fecha = isoReal(startYear, m1, Number(slashRange[1]));
      const fechaFin = isoReal(y, m2, Number(slashRange[3]));
      if (fecha && fechaFin) return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
    }
  }

  const dualDay = startStr.match(
    /^(\d{1,2})[/_](\d{1,2})[-/]([a-z]{3,5})[-/](\d{2,4})$/i,
  );
  if (dualDay) {
    const mon = ES_MONTH[dualDay[3]!.toLowerCase().slice(0, 3)];
    if (mon) {
      const y = dualDay[4]!.length === 2 ? yearFrom2Digits(dualDay[4]!) : Number(dualDay[4]);
      const fecha = isoReal(y, mon, Number(dualDay[1]));
      const fechaFin = isoReal(y, mon, Number(dualDay[2]));
      if (fecha && fechaFin) return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
    }
  }

  // Pasa el valor ORIGINAL (no `startStr`): con cellDates:true una celda de un
  // solo día llega como Date/serial; stringificarla antes rompe las ramas
  // Date/number de excelDateToIso y descartaría la competición.
  const fecha = excelDateToIso(rawStart);
  if (!fecha) return undefined;
  const fechaFin = endFromCol ?? fecha;
  return { fecha, fechaFin: fechaFin < fecha ? fecha : fechaFin };
}
