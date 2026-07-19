import { parseCampeonatos26, type ParsedRegistryCompetition } from "./parse-xlsx";

/**
 * Autodetección del separador: Excel en locale español exporta CSV con `;`
 * (la coma es el separador decimal). Sin esto, un ;-CSV colapsaba cada fila en
 * una sola celda y TODAS las filas se descartaban sin aviso ("0 campeonatos").
 */
function detectSeparator(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

/** CSV simple (comillas opcionales) → filas. */
function parseCsvRows(text: string): unknown[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const separator = lines.length > 0 ? detectSeparator(lines[0]!) : ",";
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (ch === separator && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

export function parseCampeonatosCsv(
  text: string,
): { competitions: ParsedRegistryCompetition[]; warnings: string[] } {
  const warnings: string[] = [];
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    warnings.push("CSV vacío o sin filas de datos");
    return { competitions: [], warnings };
  }
  const competitions = parseCampeonatos26(rows, warnings);
  return { competitions, warnings };
}
