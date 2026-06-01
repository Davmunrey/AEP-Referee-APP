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

const SN_RE = /\bS(\d{1,2})\b/g;
const TIME_RANGE_RE = /\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:?\d{2}/;
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
    const label = `S${Number(m[1])}`;
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

/** ¿La línea parece una rejilla de cuadrante con layout (varias columnas Sn)? */
export function looksLikeLayout(text: string): boolean {
  return text.split(/\r?\n/).some((l) => detectColumns(l).length >= 2);
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
  const validSessions = new Set(template.map((s) => s.sesion.toUpperCase()));

  // Separa páginas por form-feed (pdftotext) o cae a una sola.
  const pages = text.includes("\f") ? text.split("\f") : [text];

  let emittedAny = false;

  for (const page of pages) {
    const lines = page.split(/\r?\n/);
    let cols: Column[] = [];
    let mode: "comp" | "pesaje" = "comp";
    // El marcador de pesaje precede a la cabecera del bloque de pesaje; al ver la
    // cabecera consumimos el flag. Así cada bloque resetea a 'comp' salvo que un
    // marcador de pesaje lo preceda — robusto sin depender de saltos de página.
    let pesajePending = false;
    let inBody = false;
    let roleIndex = 0;

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, "");
      if (!line.trim()) {
        continue;
      }

      // Marcador de pesaje: el siguiente bloque de sesiones es de pesaje.
      if (PESAJE_MARKER_RE.test(line)) {
        pesajePending = true;
        inBody = false;
        continue;
      }

      // Cabecera de sesiones (S1 S2 …): nuevo bloque.
      const headerCols = detectColumns(line);
      if (headerCols.length >= 2) {
        cols = headerCols.filter((c) => validSessions.has(c.label.toUpperCase()));
        if (cols.length === 0) cols = headerCols; // sesiones no en plantilla: avisaremos
        mode = pesajePending ? "pesaje" : "comp";
        pesajePending = false;
        inBody = false;
        roleIndex = 0;
        continue;
      }

      // Fila de horarios: marca el inicio del cuerpo de jueces.
      if (TIME_RANGE_RE.test(line)) {
        inBody = cols.length > 0;
        roleIndex = 0;
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
