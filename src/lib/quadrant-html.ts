import type { AssignmentsMap, Competition, FlagsMap, RosterSession } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/roster-template";

interface RefInfo {
  nombre: string;
  nivel: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function refCell(
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
  const badge = f?.compartido ? " *" : f?.intercambio ? " ↑↓" : "";
  return `${esc(ref.nombre)}${badge}`;
}

function categoriaLabel(s: RosterSession): string {
  const cats = (s.categorias ?? []).map((c) => `${c.genero} ${c.pesos}`).join(" · ");
  return cats || s.nombre;
}

export function generateQuadrantHtml(
  comp: Competition,
  template: RosterSession[],
  assignments: AssignmentsMap,
  refLookup: (id: string) => RefInfo | undefined,
  flags: FlagsMap = {},
): string {
  // Group sessions by day
  const dayOrder: string[] = [];
  const byDay = new Map<string, RosterSession[]>();
  for (const s of template) {
    const dia = s.dia || "—";
    if (!byDay.has(dia)) { byDay.set(dia, []); dayOrder.push(dia); }
    byDay.get(dia)!.push(s);
  }

  // Build table sections per day
  const tableSections: string[] = [];

  for (const dia of dayOrder) {
    const sessions = byDay.get(dia)!;
    const colCount = sessions.length;
    const hasPesaje = sessions.some((s) => (s.pesajeRoles ?? []).length > 0);

    // Header row: day + session names
    let headerRow = `<tr class="hdr-day"><th class="cell-role">${esc(dia)}</th>`;
    for (const s of sessions) {
      headerRow += `<th class="cell-session">${esc(s.sesion)}</th>`;
    }
    headerRow += "</tr>";

    // Categories row
    let catRow = `<tr class="hdr-cat"><td class="cell-role"></td>`;
    for (const s of sessions) {
      catRow += `<td class="cell-session cell-cat">${esc(categoriaLabel(s))}</td>`;
    }
    catRow += "</tr>";

    // Horario competición row
    let timeRow = `<tr class="hdr-time"><td class="cell-role"></td>`;
    for (const s of sessions) {
      timeRow += `<td class="cell-session cell-time">${esc(s.horarioCompeticion ?? "")}</td>`;
    }
    timeRow += "</tr>";

    // Competition roles — collect unique role+slot combos from all sessions
    const allRoles: Array<{ key: string; roleLabel: string; slotIndex: number }> = [];
    const seenRoles = new Set<string>();
    for (const s of sessions) {
      for (const role of s.roles) {
        for (let i = 0; i < role.slots; i++) {
          const uid = `${role.key}_${i}`;
          if (!seenRoles.has(uid)) {
            seenRoles.add(uid);
            const label = role.slots > 1
              ? `${ROLE_LABELS[role.key] ?? role.rol} ${i + 1}`
              : (ROLE_LABELS[role.key] ?? role.rol);
            allRoles.push({ key: role.key, roleLabel: label, slotIndex: i });
          }
        }
      }
    }

    let compRows = "";
    for (const { key, roleLabel, slotIndex } of allRoles) {
      compRows += `<tr class="role-row role-${esc(key)}"><td class="cell-role">${esc(roleLabel)}</td>`;
      for (const s of sessions) {
        const cell = refCell(s.sesion, key, slotIndex, assignments, flags, refLookup);
        compRows += `<td class="cell-name">${esc(cell)}</td>`;
      }
      compRows += "</tr>";
    }

    // Pesaje section
    let pesajeRows = "";
    if (hasPesaje) {
      pesajeRows += `<tr class="pesaje-sep"><td class="cell-pesaje-hdr" colspan="${colCount + 1}">PESAJE Y CONTROL DE EQUIPAMIENTO</td></tr>`;

      // Pesaje horario row
      let pesajeTimeRow = `<tr class="hdr-time"><td class="cell-role"></td>`;
      for (const s of sessions) {
        pesajeTimeRow += `<td class="cell-session cell-time">${esc(s.horarioPesaje ?? "")}</td>`;
      }
      pesajeTimeRow += "</tr>";
      pesajeRows += pesajeTimeRow;

      const pesajeRoles: Array<{ key: string; roleLabel: string; slotIndex: number }> = [];
      const seenP = new Set<string>();
      for (const s of sessions) {
        for (const role of (s.pesajeRoles ?? [])) {
          for (let i = 0; i < role.slots; i++) {
            const uid = `${role.key}_${i}`;
            if (!seenP.has(uid)) {
              seenP.add(uid);
              const label = role.slots > 1
                ? `${ROLE_LABELS[role.key] ?? role.rol} ${i + 1}`
                : (ROLE_LABELS[role.key] ?? role.rol);
              pesajeRoles.push({ key: role.key, roleLabel: label, slotIndex: i });
            }
          }
        }
      }
      for (const { key, roleLabel, slotIndex } of pesajeRoles) {
        pesajeRows += `<tr class="role-row role-pesaje-row"><td class="cell-role">${esc(roleLabel)}</td>`;
        for (const s of sessions) {
          const cell = refCell(s.sesion, key, slotIndex, assignments, flags, refLookup);
          pesajeRows += `<td class="cell-name">${esc(cell)}</td>`;
        }
        pesajeRows += "</tr>";
      }
    }

    tableSections.push(`
      <table class="cuadrante">
        <thead>${headerRow}${catRow}${timeRow}</thead>
        <tbody>${compRows}${pesajeRows}</tbody>
      </table>`);
  }

  const fechaRange = comp.fecha === comp.fechaFin || !comp.fechaFin
    ? comp.fecha
    : `${comp.fecha} – ${comp.fechaFin}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Cuadrante – ${esc(comp.nombre)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5pt; color: #111; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ── Header ─────────────────────────────── */
  .doc-header { display: flex; align-items: center; gap: 14px; border-bottom: 2px solid #1a1a6e; padding-bottom: 8px; margin-bottom: 10px; }
  .doc-header img { height: 44px; width: auto; }
  .doc-header-text { flex: 1; }
  .doc-org { font-size: 8pt; font-weight: 700; letter-spacing: .04em; color: #1a1a6e; text-transform: uppercase; }
  .doc-title { font-size: 13pt; font-weight: 900; color: #111; line-height: 1.2; margin: 2px 0; }
  .doc-meta { font-size: 7.5pt; color: #555; }
  .doc-tipo { display: inline-block; background: #1a1a6e; color: #fff; font-size: 7pt; font-weight: 700; padding: 1px 7px; border-radius: 3px; margin-left: 6px; }

  /* ── Table ───────────────────────────────── */
  .cuadrante { width: 100%; border-collapse: collapse; margin-bottom: 10px; break-inside: avoid; table-layout: fixed; }
  .cuadrante th, .cuadrante td { border: 1px solid #bbb; padding: 3px 5px; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; }
  .cell-session, .cell-name { width: auto; }
  .hdr-day th { background: #1a1a6e; color: #fff; font-size: 8pt; font-weight: 700; text-align: center; }
  .hdr-day .cell-role { background: #f0f0f0; color: #111; font-size: 7pt; }
  .hdr-cat td { background: #e8ecf8; font-size: 7.5pt; text-align: center; font-style: italic; color: #333; }
  .hdr-time td { background: #f5f5f5; font-size: 7pt; text-align: center; color: #666; }
  .cell-role { width: 110px; font-weight: 700; font-size: 7.5pt; background: #f9f9f9; color: #1a1a6e; white-space: nowrap; }
  .cell-session { text-align: center; }
  .cell-cat { font-size: 7pt; }
  .cell-time { font-size: 7pt; }
  .cell-name { text-align: center; font-size: 8pt; min-height: 16px; }
  .cell-pesaje-hdr { background: #2e6b2e; color: #fff; font-weight: 700; font-size: 7.5pt; text-align: center; padding: 3px 5px; }

  /* Role accent strips */
  .role-central .cell-role   { border-left: 3px solid #1a1a6e; }
  .role-lateral .cell-role   { border-left: 3px solid #4a6fa5; }
  .role-ordenador .cell-role { border-left: 3px solid #8b5cf6; }
  .role-speaker .cell-role   { border-left: 3px solid #d97706; }
  .role-control .cell-role   { border-left: 3px solid #dc2626; }
  .role-jurado .cell-role    { border-left: 3px solid #64748b; }
  .role-pesaje-row .cell-role { border-left: 3px solid #2e6b2e; }

  /* ── Footer ─────────────────────────────── */
  .doc-footer { margin-top: 6px; border-top: 1px solid #ddd; padding-top: 4px; font-size: 6.5pt; color: #888; display: flex; justify-content: space-between; }
  @media print { .no-print { display: none; } }

  /* ── Print button ────────────────────────── */
  .print-btn { position: fixed; top: 12px; right: 12px; padding: 8px 18px; background: #1a1a6e; color: #fff; border: none; border-radius: 6px; font-size: 11pt; cursor: pointer; z-index: 999; }
  .print-btn:hover { background: #131055; }
  .empty-note { padding: 24px; text-align: center; color: #777; font-size: 10pt; border: 1px dashed #ccc; border-radius: 8px; margin: 16px 0; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>

<div class="doc-header">
  <img src="/assets/aep-mark.png" alt="AEP" onerror="this.style.display='none'"/>
  <div class="doc-header-text">
    <div class="doc-org">Asociación Española de Powerlifting</div>
    <div class="doc-title">${esc(comp.nombre)}<span class="doc-tipo">${esc(comp.tipo)}</span></div>
    <div class="doc-meta">${esc(comp.sede)} &nbsp;·&nbsp; ${esc(fechaRange)}</div>
  </div>
</div>

${tableSections.length > 0 ? tableSections.join("\n") : `<p class="empty-note">Sin plantilla de tarima. Importa el horario o crea la plantilla antes de exportar el cuadrante.</p>`}

<div class="doc-footer">
  <span>Cuadrante oficial AEP · ${esc(comp.nombre)}</span>
  <span>Generado: ${new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}</span>
</div>
</body>
</html>`;
}
