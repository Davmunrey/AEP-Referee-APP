/**
 * Normaliza texto extraído con pdf-parse (columnas pegadas) al formato línea-a-línea
 * que espera parseAepCalendarText (como pdftotext / fixture de tests).
 */

const NIVEL_RE = /^(AEP\s?[123]|AEP[123]|EPF|IPF|ESP\.?)$/i;
const MERGED_DATA_RE =
  /^(.+?)(AEP\s?([123])|EPF|IPF|ESP\.?)(OPEN(?:\s*\([^)]+\))?(?:-[A-Z]+(?:-[A-Z]+)*)?|SUBJ(?:UNIOR)?|JUN(?:IOR)?|MASTERs?)(.*)$/i;
const TRIMESTER_HEADER_RE =
  /^COMPETICIONES\s+(\d+º\s+TRIMESTRE\s+\d{4})LOCALIDADORGANIZADORNIVELDIVISIONESPBMR\/E$/i;

function normalizeNivelToken(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

function isMergedDataLine(line: string): boolean {
  return MERGED_DATA_RE.test(line.trim());
}

function splitEquipment(rest: string): { modalidades: string; equipamiento: string } {
  const s = rest.trim();
  if (!s) return { modalidades: "", equipamiento: "" };

  if (s.startsWith("P-B")) {
    return { modalidades: "P-B", equipamiento: formatEquipment(s.slice(3)) };
  }
  if (s.startsWith("B-M")) {
    return { modalidades: "B-M", equipamiento: formatEquipment(s.slice(3)) };
  }
  if (s.startsWith("P")) {
    return { modalidades: "P", equipamiento: formatEquipment(s.slice(1)) };
  }
  return { modalidades: "", equipamiento: formatEquipment(s) };
}

function formatEquipment(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s === "R-E" || s === "RE") return "R-E";
  if (s === "PR") return "R";
  if (s === "PE") return "E";
  return s;
}

function splitGluedNombreLocalidadOrganizador(
  raw: string,
): [string, string, string] | null {
  const text = raw.trim();
  const aepNombre = text.match(
    /^(AEP\s*\d+\s*-\s*.+?)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)(.+)$/,
  );
  if (aepNombre) {
    return [aepNombre[1].trim(), aepNombre[2].trim(), aepNombre[3].trim()];
  }

  const region = text.match(
    /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9\s,.-]+?)([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)([A-Z].+)$/,
  );
  if (region) {
    return [region[1].trim(), region[2].trim(), region[3].trim()];
  }

  const cityOrg = text.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)([A-Z].+)$/);
  if (cityOrg) {
    return ["", cityOrg[1].trim(), cityOrg[2].trim()];
  }

  return null;
}

function splitMergedDataLine(line: string): string[] {
  const m = line.trim().match(MERGED_DATA_RE);
  if (!m) return [line];

  const organizadorRaw = m[1].trim();
  const nivel = normalizeNivelToken(m[2]);
  const divisiones = m[4].trim();
  const { modalidades, equipamiento } = splitEquipment(m[5] ?? "");

  const triple = splitGluedNombreLocalidadOrganizador(organizadorRaw);
  if (triple) {
    const [nombre, localidad, organizador] = triple;
    return [
      nombre,
      localidad,
      organizador,
      nivel,
      divisiones,
      modalidades,
      equipamiento,
    ];
  }

  return ["", "", organizadorRaw, nivel, divisiones, modalidades, equipamiento];
}

function parsePrefixFieldLines(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const provIdx = lines.findIndex((l) => /^\([^)]+\)$/.test(l));
  if (provIdx >= 1) {
    const localidad = `${lines[provIdx - 1]} ${lines[provIdx]}`.replace(/\s+/g, " ").trim();
    const nombre = lines.slice(0, provIdx - 1).join(" ").replace(/\s+/g, " ").trim();
    return nombre ? [nombre, localidad] : [localidad];
  }

  if (lines.length >= 2) {
    const localidad = lines[lines.length - 1];
    const nombre = lines
      .slice(0, -1)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return [nombre, localidad];
  }

  return lines;
}

function parseFieldLines(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const nivelIdx = lines.findIndex((l) => NIVEL_RE.test(l.trim()));
  if (nivelIdx >= 0) {
    const prefix = parsePrefixFieldLines(lines.slice(0, nivelIdx));
    const nivel = normalizeNivelToken(lines[nivelIdx]);
    const tail = lines.slice(nivelIdx + 1);
    if (tail.length > 0) return [...prefix, nivel, ...tail];
    return [...prefix, nivel];
  }

  const last = lines[lines.length - 1].trim();
  if (isMergedDataLine(last)) {
    const prefix = parsePrefixFieldLines(lines.slice(0, -1));
    return [...prefix, ...splitMergedDataLine(last)];
  }

  return parsePrefixFieldLines(lines);
}

function isMonthMarkerLine(line: string): boolean {
  return /^[A-ZÁÉÍÓÚ]$/.test(line) && line.length === 1;
}

function isQuarterHeaderLine(line: string): boolean {
  return TRIMESTER_HEADER_RE.test(line.replace(/\s+/g, ""));
}

function splitGluedHeaders(line: string): string[] | null {
  const trimmed = line.replace(/\s+/g, "");
  if (trimmed === "FECHACOMPETICIONES1ºTRIMESTRE2026LOCALIDADORGANIZADORNIVELDIVISIONESPBMR/E") {
    return [
      "FECHA",
      "COMPETICIONES 1º TRIMESTRE 2026",
      "LOCALIDAD",
      "ORGANIZADOR",
      "NIVEL",
      "DIVISIONES",
      "P",
      "B",
      "M",
      "R",
      "E",
    ];
  }
  const quarter = line.match(TRIMESTER_HEADER_RE);
  if (quarter) {
    return [
      `COMPETICIONES ${quarter[1]}`,
      "LOCALIDAD",
      "ORGANIZADOR",
      "NIVEL",
      "DIVISIONES",
      "P",
      "B",
      "M",
      "R",
      "E",
    ];
  }
  return null;
}

function isDateLine(line: string): boolean {
  return (
    /^pendiente$/i.test(line) ||
    /^sin confirmar$/i.test(line) ||
    /^variable(?:\s+\*\*)?$/i.test(line) ||
    /^[a-záéíóú]{3,5}\s*-\s*[a-záéíóú]{3,5}(?:\s+\*\*)?$/i.test(line) ||
    /^\d{1,2}-[a-záéíóú]{3,5}$/i.test(line) ||
    /^\d{1,2}(?:-\d{1,2})*-\d{1,2}\s+[a-záéíóú]{3,5}$/i.test(line) ||
    /^\d{1,2}-\d{1,2}\s+[a-záéíóú]{3,5}-[a-záéíóú]{3,5}$/i.test(line) ||
    /^\d{1,2}\s+[a-záéíóú]{3,5}\s*-\s*\d{1,2}\s+[a-záéíóú]{3,5}$/i.test(line)
  );
}

/** Detecta salida típica de pdf-parse (columnas pegadas sin saltos de línea). */
export function needsAepCalendarPdfNormalize(input: string): boolean {
  return (
    /FECHACOMPETICIONES/i.test(input) ||
    /LOCALIDADORGANIZADORNIVEL/i.test(input) ||
    /[a-záéíóúñ](?:AEP\s?[123]|EPF|IPF)/i.test(input)
  );
}

/**
 * Reconstruye registros del calendario cuando pdf-parse fusiona columnas de la tabla.
 * No modifica texto ya normalizado (pdftotext / fixture).
 */
export function normalizeAepCalendarPdfText(input: string): string {
  if (!needsAepCalendarPdfNormalize(input)) return input;

  const rawLines = input.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    if (!line) {
      i++;
      continue;
    }

    const glued = splitGluedHeaders(line);
    if (glued) {
      for (const part of glued) out.push(part, "");
      i++;
      continue;
    }

    if (isMonthMarkerLine(line)) {
      i++;
      continue;
    }

    if (isQuarterHeaderLine(line.replace(/\s+/g, ""))) {
      const q = splitGluedHeaders(line);
      if (q) {
        for (const part of q) out.push(part, "");
        i++;
        continue;
      }
    }

    if (!isDateLine(line)) {
      out.push(line, "");
      i++;
      continue;
    }

    out.push(line, "");
    i++;
    const fieldLines: string[] = [];
    while (i < rawLines.length && rawLines[i]) {
      const current = rawLines[i];
      if (isDateLine(current)) break;
      if (isMonthMarkerLine(current)) {
        i++;
        continue;
      }
      if (isQuarterHeaderLine(current.replace(/\s+/g, ""))) break;
      if (/^COMPETICIONES\s+\d/i.test(current) && !isMergedDataLine(current)) break;
      fieldLines.push(current);
      i++;
    }

    for (const field of parseFieldLines(fieldLines)) {
      out.push(field, "");
    }
  }

  return out.join("\n");
}
