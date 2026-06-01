import { ROLE_LABELS } from "@/lib/roster-template";
import type { Referee, RoleKey, RosterSession, SlotFlags } from "@/lib/types";
import type { ParsedQuadrant, QuadrantAssignmentCandidate } from "@/lib/quadrant-parser";

/**
 * Parser de cuadrantes basado en GEOMETRÍA de columnas (texto `pdftotext -layout`).
 *
 * El cuadrante AEP es una rejilla: filas = roles, columnas = sesiones. Con
 * `-layout` cada línea conserva la posición de columna, así que asignamos cada
 * nombre a la columna (sesión) más cercana por posición de carácter. Esto resuelve
 * el bug del parser plano: celdas vacías en medio ya no desplazan al resto.
 */

function stripAccents(raw: string): string {
  return raw.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function normalize(raw: string): string {
  return stripAccents(raw)
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(raw: string): string[] {
  return normalize(raw).split(" ").filter(Boolean);
}

/** Alias normalizados de un juez para casar contra una celda del PDF. */
function aliasesForReferee(referee: Referee): string[] {
  const parts = words(referee.nombre);
  const aliases = new Set<string>();
  aliases.add(normalize(referee.nombre));
  if (parts.length >= 2) aliases.add(`${parts[0]} ${parts[1]}`);
  if (parts.length >= 3) aliases.add(`${parts[0]} ${parts[1]} ${parts[2]}`);
  if (parts.length >= 4) aliases.add(`${parts[0]} ${parts[2]}`);
  return [...aliases].filter((a) => a.length >= 5);
}

interface RefereeMatch {
  referee: Referee;
  confidence: QuadrantAssignmentCandidate["confidence"];
  matched: string;
}

/** Casa el texto de una celda con el juez del directorio más probable. */
function matchReferee(cell: string, referees: Referee[]): RefereeMatch | null {
  const target = normalize(cell);
  if (target.length < 4) return null;

  let best: RefereeMatch | null = null;
  let bestLen = 0;
  for (const referee of referees) {
    for (const alias of aliasesForReferee(referee)) {
      // La celda contiene el alias o el alias contiene la celda (nombres recortados).
      const hit = target === alias || target.includes(alias) || alias.includes(target);
      if (!hit) continue;
      const len = alias.length;
      if (len > bestLen) {
        bestLen = len;
        const full = normalize(referee.nombre);
        best = {
          referee,
          matched: cell,
          confidence: target === full || alias === full ? "alta" : alias.split(" ").length >= 2 ? "alta" : "media",
        };
      }
    }
  }
  return best;
}

interface Column {
  label: string; // "S1"
  center: number;
}

// Cabeceras de sesión: "SESIÓN 1", "SESION 2" o la forma corta "S1".
const SN_RE = /\bSESI[OÓ]N\s*(\d{1,2})\b|\bS(\d{1,2})\b/gi;
const TIME_RANGE_RE = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:?\d{2}/;
const TIME_RANGE_G = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:?\d{2}/g;
const CATEGORY_RE = /^(?:Hombres|Mujeres|[-+]?\d{1,3}\s*kg|[-+]\d|\(?(?:Todas|raw|RAW))/i;
const PESAJE_MARKER_RE = /PESAJE\s*y?\s*(?:REVISI[ÓO]N|CONTROL)|REVISI[ÓO]N\s+EQUIPAMIENTO/i;
const LEGEND_RE = /JUEZ\s+CENTRAL|JUEZ\s+LATERAL|ORDENADOR|SPEAKER|JUEZ\s+CONTROL|JURADO|CONTROL\s+DE\s+EQUIPAMIENTO/i;
const NOISE_RE = /ASOCIACI[ÓO]N|POWERLIFTING|Revisado|P[áa]gina|Compartiendo|Intercambio|Campeonato|Nacional|Regional/i;
const DAY_RE = /(?:lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)/i;

/** Detecta la fila de cabecera de sesiones y devuelve columna+centro de cada Sn. */
function detectColumns(line: string): Column[] {
  const cols: Column[] = [];
  const seen = new Set<string>();
  for (const m of line.matchAll(SN_RE)) {
    const num = Number(m[1] ?? m[2]); // grupo 1 = "SESIÓN N"; grupo 2 = "Sn"
    if (!num) continue;
    const label = `S${num}`;
    if (seen.has(label)) continue;
    seen.add(label);
    cols.push({ label, center: (m.index ?? 0) + m[0].length / 2 });
  }
  return cols;
}

interface Segment {
  text: string;
  center: number;
}

/** Divide una línea en segmentos de nombre (separados por 2+ espacios) con su centro. */
function rowSegments(line: string): Segment[] {
  const segs: Segment[] = [];
  // Runs de tokens unidos por UN espacio; los huecos de 2+ espacios separan columnas.
  const re = /\S+(?: \S+)*/g;
  for (const m of line.matchAll(re)) {
    const text = m[0].trim();
    if (!text) continue;
    segs.push({ text, center: (m.index ?? 0) + m[0].length / 2 });
  }
  return segs;
}

/** Asigna cada segmento a la columna (sesión) más cercana por posición. */
function assignToColumns(segs: Segment[], cols: Column[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const seg of segs) {
    let best: Column | null = null;
    let bestDist = Infinity;
    for (const col of cols) {
      const d = Math.abs(seg.center - col.center);
      if (d < bestDist) {
        bestDist = d;
        best = col;
      }
    }
    if (best && !out.has(best.label)) out.set(best.label, seg.text);
  }
  return out;
}

/** Quita marcas de flag del nombre y devuelve el texto limpio + flags. */
function extractFlags(cell: string): { name: string; flags?: SlotFlags } {
  let name = cell;
  const flags: SlotFlags = {};
  if (/[↑↓]/.test(name)) {
    flags.intercambio = true;
    name = name.replace(/[↑↓]/g, "");
  }
  if (/\*/.test(name)) {
    flags.compartido = true;
    name = name.replace(/\*/g, "");
  }
  name = name.replace(/\s+/g, " ").trim();
  return { name, flags: flags.intercambio || flags.compartido ? flags : undefined };
}

interface RoleSlot {
  key: RoleKey;
  slotIndex: number;
}

/** Expande los roles de una sesión a [rol, índice] en orden de fila. */
function expandRoles(roles: RosterSession["roles"]): RoleSlot[] {
  const out: RoleSlot[] = [];
  for (const role of roles) {
    for (let i = 0; i < role.slots; i++) out.push({ key: role.key, slotIndex: i });
  }
  return out;
}

function roleLabel(key: RoleKey): string {
  return ROLE_LABELS[key] ?? key;
}

/** Centros x de los rangos horarios de una línea (define las columnas reales). */
function timeColumns(line: string): number[] {
  const centers: number[] = [];
  for (const m of line.matchAll(TIME_RANGE_G)) {
    centers.push((m.index ?? 0) + m[0].length / 2);
  }
  return centers;
}

/**
 * Construye las columnas finales mapeando las etiquetas de sesión acumuladas a
 * los centros del time-row (que siempre está alineado, aunque las cabeceras
 * estén escalonadas en diagonal). Cae a las propias cabeceras si no hay horario.
 */
function buildColumns(sessionTokens: Column[], timeCenters: number[]): Column[] {
  if (timeCenters.length === 0) {
    return [...sessionTokens].sort((a, b) => a.center - b.center);
  }
  const cols: Column[] = [];
  for (const center of timeCenters) {
    // Sesión cuya cabecera está más cerca de este centro horario.
    let best: Column | null = null;
    let bestDist = Infinity;
    for (const s of sessionTokens) {
      const d = Math.abs(s.center - center);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    if (best && !cols.some((c) => c.label === best!.label)) {
      cols.push({ label: best.label, center });
    }
  }
  return cols.length > 0 ? cols : [...sessionTokens].sort((a, b) => a.center - b.center);
}

/** ¿El texto parece una rejilla de cuadrante? (varias sesiones o time-row múltiple) */
export function looksLikeLayout(text: string): boolean {
  const lines = text.split(/\r?\n/);
  if (lines.some((l) => timeColumns(l).length >= 2)) return true;
  // Cabeceras de sesión escalonadas: cuenta etiquetas únicas en todo el texto.
  const labels = new Set<string>();
  for (const l of lines) for (const c of detectColumns(l)) labels.add(c.label);
  return labels.size >= 2;
}

export function parseQuadrantLayout(
  text: string,
  referees: Referee[],
  template: RosterSession[],
): ParsedQuadrant {
  const warnings: string[] = [];
  const candidates: QuadrantAssignmentCandidate[] = [];
  const usedSlots = new Set<string>();

  const templateBySession = new Map(template.map((s) => [s.sesion.toUpperCase(), s]));

  // Separa páginas por form-feed (pdftotext) o cae a una sola.
  const pages = text.includes("\f") ? text.split("\f") : [text];

  let emittedAny = false;

  for (const page of pages) {
    const lines = page.split(/\r?\n/);
    let cols: Column[] = [];
    let mode: "comp" | "pesaje" = "comp";
    let pesajePending = false;
    let timeRowsInBlock = 0;
    let inBody = false;
    let roleIndex = 0;
    // Etiquetas de sesión acumuladas desde el último time-row. Las cabeceras
    // pueden estar escalonadas (diagonal); se mapean a las columnas reales
    // (centros del time-row) cuando aparece el horario.
    let sessionTokens: Column[] = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      if (!line.trim()) {
        continue;
      }

      // Marcador explícito de pesaje (AEP-1): el siguiente bloque es de pesaje.
      if (PESAJE_MARKER_RE.test(line)) {
        pesajePending = true;
        inBody = false;
        continue;
      }

      // Fila de horarios: define las columnas REALES y abre el cuerpo de jueces.
      // La 2ª fila de horario del bloque (sin nuevas cabeceras) inicia el pesaje.
      const timeCenters = timeColumns(line);
      if (timeCenters.length >= 1 && TIME_RANGE_RE.test(line)) {
        if (sessionTokens.length > 0) {
          // Nuevo bloque: construir columnas mapeando sesiones a los horarios.
          cols = buildColumns(sessionTokens, timeCenters);
          sessionTokens = [];
          timeRowsInBlock = 1;
          mode = pesajePending ? "pesaje" : "comp";
          pesajePending = false;
        } else {
          // Mismo bloque, 2º horario -> pesaje sobre las mismas columnas.
          timeRowsInBlock += 1;
          if (timeRowsInBlock >= 2 && mode === "comp") mode = "pesaje";
          // Reajusta los centros por si el time-row de pesaje desplaza columnas.
          if (cols.length === timeCenters.length) {
            cols = cols.map((c, i) => ({ label: c.label, center: timeCenters[i]! }));
          }
        }
        inBody = cols.length > 0;
        roleIndex = 0;
        continue;
      }

      // Acumula etiquetas de sesión (cabecera, posiblemente escalonada).
      const headerCols = detectColumns(line);
      if (headerCols.length >= 1 && !inBody) {
        for (const c of headerCols) {
          if (!sessionTokens.some((s) => s.label === c.label)) sessionTokens.push(c);
        }
        continue;
      }

      // Leyenda de roles o ruido: termina el bloque.
      if (LEGEND_RE.test(line) || NOISE_RE.test(line) || DAY_RE.test(line)) {
        inBody = false;
        continue;
      }

      // Categorías antes del cuerpo: ignorar.
      if (!inBody && CATEGORY_RE.test(line.trim())) {
        continue;
      }

      if (!inBody || cols.length === 0) continue;

      // Fila de jueces: asignar cada segmento a su columna/sesión.
      const segs = rowSegments(line);
      if (segs.length === 0) continue;
      const byCol = assignToColumns(segs, cols);
      if (byCol.size === 0) {
        continue;
      }

      const currentRole = roleIndex;
      roleIndex++;

      for (const [sessionLabel, cellRaw] of byCol) {
        const sessionKey = sessionLabel.toUpperCase();
        const tpl = templateBySession.get(sessionKey);
        if (!tpl) {
          warnings.push(`Sesión ${sessionLabel} no existe en la plantilla; se omite.`);
          continue;
        }
        const roleSeq = expandRoles(mode === "pesaje" ? tpl.pesajeRoles ?? [] : tpl.roles);
        const slot = roleSeq[currentRole];
        if (!slot) continue; // más filas que roles → fila extra, se ignora

        const { name, flags } = extractFlags(cellRaw);
        if (!name) continue;
        const match = matchReferee(name, referees);
        const slotKey = `${tpl.sesion}_${slot.key}_${slot.slotIndex}`;

        if (usedSlots.has(slotKey)) continue; // no duplicar el mismo hueco
        usedSlots.add(slotKey);
        emittedAny = true;

        const importable = Boolean(match && match.referee.id);
        candidates.push({
          key: `layout-${slotKey}`,
          session: tpl.sesion,
          roleKey: slot.key,
          roleLabel: roleLabel(slot.key),
          slotKey: importable ? slotKey : null,
          refereeId: match?.referee.id ?? null,
          refereeName: match?.referee.nombre ?? name,
          matchedName: name,
          confidence: match?.confidence ?? "baja",
          importable,
          reason: importable
            ? "Lista para asignar"
            : `Sin coincidencia en el directorio para "${name}"`,
          flags,
        });
      }
    }
  }

  if (!emittedAny) {
    warnings.push("No se detectó rejilla de cuadrante con columnas. Revisa el PDF.");
  }

  // Orden estable: por sesión y rol para una preview legible.
  candidates.sort((a, b) => {
    const sa = Number(a.session.replace(/\D/g, "")) || 0;
    const sb = Number(b.session.replace(/\D/g, "")) || 0;
    return sa - sb || a.slotKey?.localeCompare(b.slotKey ?? "") || 0;
  });

  return { candidates, warnings };
}
