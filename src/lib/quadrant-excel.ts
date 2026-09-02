import { sessionOrder } from "@/lib/session-order";
import * as XLSX from "xlsx";
import { ROLE_LABELS } from "@/lib/roster-template";
import type { AssignmentsMap, Competition, FlagsMap, RoleKey, RosterSession } from "@/lib/types";

interface RefInfo {
  nombre: string;
  nivel: string;
}

function refName(
  sesion: string,
  roleKey: string,
  slotIndex: number,
  assignments: AssignmentsMap,
  flags: FlagsMap,
  refLookup: (id: string) => RefInfo | undefined,
): string {
  const slotKey = `${sesion}_${roleKey}_${slotIndex}`;
  const refId = assignments[slotKey];
  if (!refId) return "";
  const ref = refLookup(refId);
  if (!ref) return "";
  const f = flags[slotKey];
  const sfx: string[] = [];
  if (f?.compartido) sfx.push("*");
  if (f?.intercambio) sfx.push("↑↓");
  return sfx.length ? `${ref.nombre} ${sfx.join(" ")}` : ref.nombre;
}

interface RoleSlot {
  key: RoleKey;
  slotIndex: number;
}

function collectRoles(sessions: RosterSession[], pesaje: boolean): RoleSlot[] {
  const out: RoleSlot[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    for (const role of pesaje ? s.pesajeRoles ?? [] : s.roles) {
      for (let i = 0; i < role.slots; i++) {
        const uid = `${role.key}_${i}`;
        if (!seen.has(uid)) { seen.add(uid); out.push({ key: role.key, slotIndex: i }); }
      }
    }
  }
  return out;
}

function roleLabel(rs: RoleSlot, total: number): string {
  const base = ROLE_LABELS[rs.key] ?? rs.key;
  return total > 1 ? `${base} ${rs.slotIndex + 1}` : base;
}

function categoria(s: RosterSession): string {
  return (s.categorias ?? []).map((c) => `${c.genero} ${c.pesos}`).join(" ") || s.nombre;
}

/** Genera un .xlsx (Buffer) con una hoja por día: roles=filas, sesiones=columnas. */
export function generateQuadrantExcel(
  comp: Competition,
  template: RosterSession[],
  assignments: AssignmentsMap,
  refLookup: (id: string) => RefInfo | undefined,
  flags: FlagsMap = {},
): Buffer {
  const wb = XLSX.utils.book_new();

  // Agrupa por día
  const dayOrder: string[] = [];
  const byDay = new Map<string, RosterSession[]>();
  for (const s of template) {
    const dia = s.dia || "Cuadrante";
    if (!byDay.has(dia)) { byDay.set(dia, []); dayOrder.push(dia); }
    byDay.get(dia)!.push(s);
  }

  if (dayOrder.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[comp.nombre], ["Sin plantilla de tarima."]]);
    XLSX.utils.book_append_sheet(wb, ws, "Cuadrante");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  const usedSheetNames = new Set<string>();
  dayOrder.forEach((dia, di) => {
    const sessions = byDay.get(dia)!;
    const rows: (string | number)[][] = [];
    rows.push([comp.nombre]);
    rows.push([`${comp.tipo} · ${comp.sede} · ${comp.fecha}${comp.fechaFin && comp.fechaFin !== comp.fecha ? ` – ${comp.fechaFin}` : ""}`]);
    rows.push([]);
    rows.push([dia]);
    rows.push(["", ...sessions.map((s) => sessionHeader(s.sesion))]);
    rows.push(["", ...sessions.map(categoria)]);
    rows.push(["Competición", ...sessions.map((s) => s.horarioCompeticion ?? "")]);

    const compRoles = collectRoles(sessions, false);
    const totalsByKey = new Map<string, number>();
    for (const rs of compRoles) totalsByKey.set(rs.key, (totalsByKey.get(rs.key) ?? 0) + 1);
    for (const rs of compRoles) {
      const cells = sessions.map((s) => refName(s.sesion, rs.key, rs.slotIndex, assignments, flags, refLookup));
      if (cells.every((c) => c === "")) continue;
      rows.push([roleLabel(rs, totalsByKey.get(rs.key) ?? 1), ...cells]);
    }

    const pesajeRoles = collectRoles(sessions, true);
    const pTotals = new Map<string, number>();
    for (const rs of pesajeRoles) pTotals.set(rs.key, (pTotals.get(rs.key) ?? 0) + 1);
    const pesajeRows: (string | number)[][] = [];
    for (const rs of pesajeRoles) {
      const cells = sessions.map((s) => refName(s.sesion, rs.key, rs.slotIndex, assignments, flags, refLookup));
      if (cells.every((c) => c === "")) continue;
      pesajeRows.push([roleLabel(rs, pTotals.get(rs.key) ?? 1), ...cells]);
    }
    if (pesajeRows.length > 0) {
      rows.push([]);
      rows.push(["Pesaje", ...sessions.map((s) => s.horarioPesaje ?? "")]);
      rows.push(...pesajeRows);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 18 }, ...sessions.map(() => ({ wch: 24 }))];
    // Nombre de hoja: máx 31 chars, sin caracteres inválidos, sin apóstrofos en
    // los extremos (SheetJS los rechaza) y ÚNICO ignorando mayúsculas: dos días
    // que truncaban al mismo nombre ("… – mañana" / "… – tarde") hacían que
    // book_append_sheet lanzara y la ruta devolviera un 500 en vez del fichero.
    const base =
      (dia.replace(/[\\/?*[\]:]/g, " ").replace(/^'+|'+$/g, "").slice(0, 28) || `Día ${di + 1}`)
        .trim() || `Día ${di + 1}`;
    let name = base;
    for (let k = 2; usedSheetNames.has(name.toLowerCase()); k++) {
      const suffix = ` (${k})`;
      name = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    }
    usedSheetNames.add(name.toLowerCase());
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** "SESIÓN n" para ids numéricos (S1, "Sesión 3"); ids libres se muestran tal cual. */
function sessionHeader(sesion: string): string {
  const n = sessionOrder(sesion);
  return n < Number.MAX_SAFE_INTEGER ? `SESIÓN ${n}` : sesion;
}
