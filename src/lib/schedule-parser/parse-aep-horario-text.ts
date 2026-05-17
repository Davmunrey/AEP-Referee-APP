import type { EventType, RosterCategoria } from "@/lib/types";
import type {
  ParsedDay,
  ParsedGrupo,
  ParsedHeader,
  ParsedHorario,
  ParsedSession,
} from "./types";

const DAY_RE =
  /^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo),\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}$/i;
const SESSION_RE = /^SESI[ÓO]N\s+(\d+)\s*:$/i;
const GROUP_RE = /^\*?\s*Grupo\s+(\d+)\s*:$/i;
const SCHEDULE_RE =
  /Pesaje\s+(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\s*\/\s*Inicio\s+(\d{1,2}:\d{2})\s*\/\s*Fin\s+(\d{1,2}:\d{2})/i;
const LEV_RE = /^(\d+)\s+lev\.?$/i;
const REV_RE = /^rev\.\s*(.+)$/i;
const TYPE_RE = /\bAEP-([123])\b/i;
const HEADER_TITLE_RE = /^(ASOCIACI[ÓO]N\s+ESPA[ÑN]OLA.*POWERLIFTING)$/i;
const SEDE_RE = /^([^|]+)\|(.+)$/;
const ENTREGA_RE = /^Entrega\s+medallas$/i;

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dayToIso(raw: string): string | undefined {
  const m = raw.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = MONTHS[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (!day || !month || !year) return undefined;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function dayShort(raw: string): string {
  return raw.split(",")[0].trim();
}

function makeDay(raw: string): ParsedDay {
  return { raw, short: dayShort(raw), iso: dayToIso(raw) };
}

/**
 * Divide una línea de categoría por separadores que precedan a un género distinto.
 * Soporta " | Hombres", " // Mujeres", etc. Si no hay separador, devuelve la línea entera.
 */
function splitByGender(line: string): string[] {
  return line.split(/\s(?:\||\/\/)\s(?=(?:Hombres|Mujeres))/i);
}

function parseCategoryLine(line: string): RosterCategoria[] {
  const parts = splitByGender(line.trim());
  return parts.map((part) => {
    const m = part.match(/^(Hombres|Mujeres)\s+(.+)$/i);
    if (!m) {
      return { genero: "Hombres", pesos: part.trim() };
    }
    const genero = m[1].toLowerCase().startsWith("h") ? "Hombres" : "Mujeres";
    return { genero, pesos: m[2].trim() };
  });
}

function normalizeRange(range: string): string {
  return range.replace(/\s*-\s*/, " - ").trim();
}

function competicionRange(inicio: string, fin: string): string {
  return `${inicio.trim()} - ${fin.trim()}`;
}

function detectHeader(lines: string[]): ParsedHeader {
  const header: ParsedHeader = {};
  let captured = 0;
  for (let i = 0; i < lines.length && captured < 5; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (DAY_RE.test(line) || SESSION_RE.test(line)) break;
    if (HEADER_TITLE_RE.test(line)) {
      captured++;
      continue;
    }
    if (TYPE_RE.test(line)) {
      const m = line.match(TYPE_RE);
      if (m) header.tipo = `AEP-${m[1]}` as EventType;
      captured++;
      continue;
    }
    const rev = line.match(REV_RE);
    if (rev) {
      header.revision = rev[1].trim();
      captured++;
      continue;
    }
    const sede = line.match(SEDE_RE);
    if (sede) {
      header.sede = sede[1].trim();
      header.fechasTexto = sede[2].trim();
      captured++;
      continue;
    }
    if (!header.campeonato) {
      header.campeonato = line;
      captured++;
    }
  }
  return header;
}

/**
 * Parser determinista: convierte texto plano (extraído de PDF AEP)
 * en una estructura intermedia con días, sesiones y grupos.
 */
export function parseAepHorarioText(input: string): ParsedHorario {
  const rawLines = input.split(/\r?\n/);
  const lines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !HEADER_TITLE_RE.test(l) || rawLines.indexOf(l) < 6);

  const header = detectHeader(rawLines);
  const days: ParsedDay[] = [];
  const sessions: ParsedSession[] = [];
  const warnings: string[] = [];

  let currentDay: ParsedDay | undefined;
  let currentSession: ParsedSession | undefined;
  let currentGroup: ParsedGrupo | undefined;
  /** "session" tras detectar SESIÓN N esperando categoría; "group" tras "* Grupo N:". */
  let pendingCategory: "session" | "group" | undefined;

  const linesNoHeader = lines.filter((l) => {
    if (HEADER_TITLE_RE.test(l)) return false;
    if (l === header.campeonato) return false;
    if (TYPE_RE.test(l) && !DAY_RE.test(l) && !SESSION_RE.test(l)) {
      const m = l.match(TYPE_RE);
      if (m && (l.includes("Nacional") || l.includes("Regional") || l.length < 30)) {
        return false;
      }
    }
    if (REV_RE.test(l)) return false;
    if (header.sede && l.startsWith(header.sede)) return false;
    return true;
  });

  for (const line of linesNoHeader) {
    if (DAY_RE.test(line)) {
      currentDay = makeDay(line);
      days.push(currentDay);
      pendingCategory = undefined;
      continue;
    }

    const sessionMatch = line.match(SESSION_RE);
    if (sessionMatch) {
      if (!currentDay) {
        warnings.push(`Sesión "${line}" sin día previo`);
        currentDay = { raw: "Sesión", short: "Sesión" };
        days.push(currentDay);
      }
      const num = sessionMatch[1];
      currentSession = {
        sesion: `S${num}`,
        nombre: `Sesión ${num}`,
        dia: currentDay,
        categorias: [],
        grupos: [],
      };
      sessions.push(currentSession);
      currentGroup = undefined;
      pendingCategory = "session";
      continue;
    }

    if (ENTREGA_RE.test(line)) {
      pendingCategory = undefined;
      continue;
    }

    const groupMatch = line.match(GROUP_RE);
    if (groupMatch) {
      if (!currentSession) {
        warnings.push(`Grupo "${line}" sin sesión previa`);
        continue;
      }
      const num = groupMatch[1];
      currentGroup = {
        nombre: `Grupo ${num}`,
        rawCategoria: "",
        categorias: [],
      };
      currentSession.grupos.push(currentGroup);
      pendingCategory = "group";
      continue;
    }

    const sched = line.match(SCHEDULE_RE);
    if (sched && currentSession) {
      currentSession.horarioPesaje = normalizeRange(sched[1]);
      currentSession.horarioCompeticion = competicionRange(sched[2], sched[3]);
      pendingCategory = undefined;
      continue;
    }

    const lev = line.match(LEV_RE);
    if (lev) {
      const n = Number(lev[1]);
      if (currentGroup && currentGroup.levantadores === undefined) {
        currentGroup.levantadores = n;
      } else if (currentSession && currentSession.totalLevantadores === undefined) {
        currentSession.totalLevantadores = n;
      }
      continue;
    }

    if (pendingCategory === "session" && currentSession) {
      currentSession.rawCategoria = line;
      currentSession.categorias = parseCategoryLine(line);
      pendingCategory = undefined;
      continue;
    }

    if (pendingCategory === "group" && currentGroup) {
      currentGroup.rawCategoria = line;
      currentGroup.categorias = parseCategoryLine(line);
      pendingCategory = undefined;
      continue;
    }
  }

  if (sessions.length === 0) {
    warnings.push("No se detectó ninguna sesión en el documento");
  }
  for (const s of sessions) {
    if (!s.horarioCompeticion) warnings.push(`Sesión ${s.sesion} sin horario de competición`);
    if (s.categorias.length === 0)
      warnings.push(`Sesión ${s.sesion} sin categorías`);
  }

  return { header, days, sessions, warnings };
}
