import { ROLE_LABELS } from "@/lib/roster-template";
import type { Referee, RoleKey, RosterSession, SlotFlags } from "@/lib/types";

export interface QuadrantAssignmentCandidate {
  key: string;
  session: string;
  roleKey: RoleKey;
  roleLabel: string;
  slotKey: string | null;
  refereeId: string | null;
  refereeName: string;
  matchedName?: string;
  confidence: "alta" | "media" | "baja";
  importable: boolean;
  reason: string;
  flags?: SlotFlags;
}

export interface ParsedQuadrant {
  candidates: QuadrantAssignmentCandidate[];
  warnings: string[];
}

type NameHit = {
  index: number;
  text: string;
  referee: Referee;
  confidence: QuadrantAssignmentCandidate["confidence"];
};

const PAGE_RE = /(?:Página\s+\d+\s+de\s+\d+|Página\s+\d+\s+de|(?=TARIMA\s+\d+))/gi;
const SESSION_RE = /\bS(?:ESI[ÓO]N\s*)?(\d{1,2})\b/gi;
const ROLE_ANCHOR_RE = /JUEZ\s+CENTRAL|Central|Lateral|Ordenador|Jurado|SPEAKER/i;
const TIME_RE = /\d{1,2}:\d{2}\s*-\s*\d{1,2}:?\d{2}/g;

const COMP_ROLE_ORDER_AEP2: RoleKey[] = [
  "central",
  "control",
  "lateral",
  "lateral",
  "ordenador",
  "speaker",
];
const COMP_ROLE_ORDER_AEP1: RoleKey[] = [
  "central",
  "control",
  "lateral",
  "lateral",
  "ordenador",
  "speaker",
  "jurado",
  "jurado",
  "jurado",
];
const PESAJE_ROLE_ORDER: RoleKey[] = ["pesaje", "equipamiento", "pesaje", "equipamiento"];

function stripAccents(raw: string): string {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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

function aliasesForReferee(referee: Referee): string[] {
  const parts = words(referee.nombre);
  const aliases = new Set<string>();
  if (parts.length >= 2) aliases.add(`${parts[0]} ${parts[1]}`);
  if (parts.length >= 3) aliases.add(`${parts[0]} ${parts[1]} ${parts[2]}`);
  if (parts.length >= 4) aliases.add(`${parts[0]} ${parts[2]}`);
  aliases.add(normalize(referee.nombre));
  return [...aliases].filter((a) => a.length >= 7);
}

function findNameHits(rawText: string, referees: Referee[]): NameHit[] {
  const normalizedText = normalize(rawText);
  const hits: NameHit[] = [];
  const occupied: Array<{ start: number; end: number }> = [];
  const aliases = referees.flatMap((referee) =>
    aliasesForReferee(referee).map((alias) => ({ alias, referee })),
  );
  aliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const { alias, referee } of aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "g");
    for (const match of normalizedText.matchAll(re)) {
      const index = match.index ?? -1;
      if (index < 0) continue;
      const end = index + alias.length;
      if (occupied.some((r) => index < r.end && end > r.start)) continue;
      occupied.push({ start: index, end });
      hits.push({
        index,
        text: alias,
        referee,
        confidence: alias === normalize(referee.nombre) ? "alta" : alias.split(" ").length >= 3 ? "alta" : "media",
      });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

function splitBlocks(text: string): string[] {
  return text
    .split(PAGE_RE)
    .map((b) => b.trim())
    .filter((b) => b.length > 80);
}

function findRoleAnchor(block: string): number {
  let found = -1;
  for (const match of block.matchAll(new RegExp(ROLE_ANCHOR_RE, "gi"))) {
    if (match.index != null) found = match.index;
  }
  return found;
}

function uniqueSessions(block: string): string[] {
  const seen = new Set<string>();
  const sessions: string[] = [];
  for (const match of block.matchAll(SESSION_RE)) {
    const session = `S${Number(match[1])}`;
    if (!seen.has(session)) {
      seen.add(session);
      sessions.push(session);
    }
  }
  return sessions;
}

function existingSlotKeys(template: RosterSession[], session: string, roleKey: RoleKey): string[] {
  const found = template.find((s) => s.sesion.toLowerCase() === session.toLowerCase());
  if (!found) return [];
  const roles = [...found.roles, ...(found.pesajeRoles ?? [])].filter((r) => r.key === roleKey);
  return roles.flatMap((role) =>
    Array.from({ length: role.slots }, (_, i) => `${found.sesion}_${role.key}_${i}`),
  );
}

function roleLabel(roleKey: RoleKey): string {
  return ROLE_LABELS[roleKey] ?? roleKey;
}

function assignSlot(
  template: RosterSession[],
  usedSlots: Set<string>,
  session: string,
  roleKey: RoleKey,
): string | null {
  const slots = existingSlotKeys(template, session, roleKey);
  const slot = slots.find((key) => !usedSlots.has(key));
  if (slot) usedSlots.add(slot);
  return slot ?? null;
}

function roleOrderForTemplate(template: RosterSession[]): RoleKey[] {
  const hasJury = template.some((s) => s.roles.some((r) => r.key === "jurado"));
  return hasJury ? COMP_ROLE_ORDER_AEP1 : COMP_ROLE_ORDER_AEP2;
}

function makeCandidate(input: {
  hit: NameHit;
  session: string;
  roleKey: RoleKey;
  slotKey: string | null;
  index: number;
  kind: "competicion" | "pesaje";
}): QuadrantAssignmentCandidate {
  const importable = Boolean(input.slotKey && input.hit.referee.id);
  return {
    key: `${input.kind}-${input.session}-${input.roleKey}-${input.index}-${input.hit.referee.id}`,
    session: input.session,
    roleKey: input.roleKey,
    roleLabel: roleLabel(input.roleKey),
    slotKey: input.slotKey,
    refereeId: input.hit.referee.id,
    refereeName: input.hit.referee.nombre,
    matchedName: input.hit.text,
    confidence: input.hit.confidence,
    importable,
    reason: importable ? "Lista para asignar" : "Slot no existe en plantilla",
  };
}

export function parseQuadrantAssignments(
  text: string,
  referees: Referee[],
  template: RosterSession[],
): ParsedQuadrant {
  const warnings: string[] = [];
  if (text.trim().length < 50) {
    return {
      candidates: [],
      warnings: ["PDF sin texto extraíble. Sube versión exportada con texto o CSV/Excel."],
    };
  }

  const usedSlots = new Set<string>();
  const candidates: QuadrantAssignmentCandidate[] = [];
  const blocks = splitBlocks(text);
  const compOrder = roleOrderForTemplate(template);

  for (const block of blocks) {
    const sessions = uniqueSessions(block).filter((s) =>
      template.some((t) => t.sesion.toLowerCase() === s.toLowerCase()),
    );
    if (sessions.length === 0) continue;

    const anchor = findRoleAnchor(block);
    const assignmentText = anchor >= 0 ? block.slice(0, anchor) : block;
    const pesajeMatches = [...assignmentText.matchAll(/PESAJE|Pesaje y Revisión/gi)];
    const pesajeIdx = pesajeMatches.at(-1)?.index ?? -1;
    const compText = pesajeIdx >= 0 ? assignmentText.slice(0, pesajeIdx) : assignmentText;
    const pesajeText = pesajeIdx >= 0 ? assignmentText.slice(pesajeIdx) : "";

    const compHits = findNameHits(compText.replace(TIME_RE, " "), referees);
    const pesajeHits = findNameHits(pesajeText.replace(TIME_RE, " "), referees);
    const colCount = sessions.length;
    if (colCount === 0) continue;

    compHits.forEach((hit, idx) => {
      const row = Math.floor(idx / colCount);
      const col = idx % colCount;
      const session = sessions[col] ?? sessions[0]!;
      const roleKey = compOrder[row] ?? compOrder[compOrder.length - 1]!;
      const slotKey = assignSlot(template, usedSlots, session, roleKey);
      candidates.push(makeCandidate({ hit, session, roleKey, slotKey, index: idx, kind: "competicion" }));
    });

    pesajeHits.forEach((hit, idx) => {
      const row = Math.floor(idx / colCount);
      const col = idx % colCount;
      const session = sessions[col] ?? sessions[0]!;
      const roleKey = PESAJE_ROLE_ORDER[row] ?? PESAJE_ROLE_ORDER[PESAJE_ROLE_ORDER.length - 1]!;
      const slotKey = assignSlot(template, usedSlots, session, roleKey);
      candidates.push(makeCandidate({ hit, session, roleKey, slotKey, index: idx, kind: "pesaje" }));
    });
  }

  if (candidates.length === 0) {
    warnings.push("No se detectaron asignaciones. Puede ser PDF escaneado o formato no soportado.");
  }

  return { candidates, warnings };
}
