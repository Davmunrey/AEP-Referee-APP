import type { AssignmentsMap, Competition, FlagsMap, RoleKey, RosterSession } from "@/lib/types";

interface RefInfo {
  nombre: string;
  nivel: string;
}

/**
 * Estilo por rol — replica EXACTO la leyenda de colores del cuadrante oficial AEP.
 * El rol NO se rotula por columna: se identifica por el COLOR de la fila + leyenda.
 */
const ROLE_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  central: { bg: "#FF0000", fg: "#000000", label: "CENTRAL" },
  lateral: { bg: "#FFFF00", fg: "#000000", label: "LATERAL" },
  ordenador: { bg: "#FFC000", fg: "#000000", label: "ORDENADOR" }, // naranja claro
  liftingcast: { bg: "#92D050", fg: "#000000", label: "LIFTINGCAST/OPENLIFTER" },
  speaker: { bg: "#ED7D31", fg: "#000000", label: "MESA/SPEAKER" }, // naranja oscuro
  mesa: { bg: "#ED7D31", fg: "#000000", label: "MESA/SPEAKER" },
  control: { bg: "#00B050", fg: "#000000", label: "CONTROL" },
  pesaje: { bg: "#A6611A", fg: "#000000", label: "PESAJE" }, // marrón
  equipamiento: { bg: "#8EAADB", fg: "#000000", label: "EQUIPAMIENTO" },
  jurado: { bg: "#BFBFBF", fg: "#000000", label: "JURADO" },
  material: { bg: "#D9D9D9", fg: "#000000", label: "MATERIAL" },
};

// Orden de la leyenda (como aparece en el cuadrante oficial)
const LEGEND_ORDER: RoleKey[] = [
  "central",
  "control",
  "pesaje",
  "lateral",
  "ordenador",
  "equipamiento",
  "mesa",
];

function styleFor(key: string): { bg: string; fg: string; label: string } {
  return ROLE_STYLE[key] ?? { bg: "#FFFFFF", fg: "#000000", label: key.toUpperCase() };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Nombre + sufijos de flag: `*` compartido, `↑↓` intercambio. Vacío si no asignado. */
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

function categoriaLabel(s: RosterSession): string {
  const cats = (s.categorias ?? []).map((c) => `${c.genero} ${c.pesos}`).join(" ");
  return (cats || s.nombre).toUpperCase();
}

interface RoleSlot {
  key: RoleKey;
  slotIndex: number;
}

/** Lista ordenada de (rol, slot) presentes en un grupo de sesiones, sin duplicar. */
function collectRoles(sessions: RosterSession[], pesaje: boolean): RoleSlot[] {
  const out: RoleSlot[] = [];
  const seen = new Set<string>();
  for (const s of sessions) {
    const roles = pesaje ? s.pesajeRoles ?? [] : s.roles;
    for (const role of roles) {
      for (let i = 0; i < role.slots; i++) {
        const uid = `${role.key}_${i}`;
        if (!seen.has(uid)) {
          seen.add(uid);
          out.push({ key: role.key, slotIndex: i });
        }
      }
    }
  }
  return out;
}

/** Una fila de N celdas (una por sesión). Devuelve "" si todas vacías -> fila omitida. */
function roleRow(
  sessions: RosterSession[],
  rs: RoleSlot,
  assignments: AssignmentsMap,
  flags: FlagsMap,
  refLookup: (id: string) => RefInfo | undefined,
): string {
  const st = styleFor(rs.key);
  const cells = sessions.map((s) => refName(s.sesion, rs.key, rs.slotIndex, assignments, flags, refLookup));
  if (cells.every((c) => c === "")) return "";
  let row = "<tr>";
  for (const name of cells) {
    row += name
      ? `<td class="cell-name" style="background:${st.bg};color:${st.fg}">${esc(name)}</td>`
      : `<td class="cell-name"></td>`;
  }
  return row + "</tr>";
}

export function generateQuadrantHtml(
  comp: Competition,
  template: RosterSession[],
  assignments: AssignmentsMap,
  refLookup: (id: string) => RefInfo | undefined,
  flags: FlagsMap = {},
  autoPrint = false,
): string {
  // Agrupa sesiones por día
  const dayOrder: string[] = [];
  const byDay = new Map<string, RosterSession[]>();
  for (const s of template) {
    const dia = s.dia || "—";
    if (!byDay.has(dia)) { byDay.set(dia, []); dayOrder.push(dia); }
    byDay.get(dia)!.push(s);
  }

  const usedRoleKeys = new Set<string>();
  const tables: string[] = [];

  for (const dia of dayOrder) {
    const sessions = byDay.get(dia)!;
    const n = sessions.length;

    // Cabecera del día (span todas las columnas de sesión)
    let html = `<table class="cuadrante"><tbody>`;
    html += `<tr><td class="cell-day" colspan="${n}">${esc(dia)}</td></tr>`;

    // Fila de sesiones: SESIÓN N + categoría
    html += `<tr>`;
    for (const s of sessions) {
      const num = s.sesion.replace(/^S/i, "");
      html += `<td class="cell-sess"><span class="sess-n">SESIÓN ${esc(num)}</span><span class="sess-cat">${esc(categoriaLabel(s))}</span></td>`;
    }
    html += `</tr>`;

    // Horario competición (rojo)
    html += `<tr>`;
    for (const s of sessions) html += `<td class="cell-time">${esc(s.horarioCompeticion ?? "")}</td>`;
    html += `</tr>`;

    // Filas de rol (competición) coloreadas
    for (const rs of collectRoles(sessions, false)) {
      const r = roleRow(sessions, rs, assignments, flags, refLookup);
      if (r) { html += r; usedRoleKeys.add(rs.key); }
    }

    // Bloque pesaje (si hay asignaciones)
    const pesajeSlots = collectRoles(sessions, true);
    let pesajeBody = "";
    for (const rs of pesajeSlots) {
      const r = roleRow(sessions, rs, assignments, flags, refLookup);
      if (r) { pesajeBody += r; usedRoleKeys.add(rs.key); }
    }
    if (pesajeBody) {
      html += `<tr><td class="cell-gap" colspan="${n}"></td></tr>`;
      html += `<tr>`;
      for (const s of sessions) html += `<td class="cell-time">${esc(s.horarioPesaje ?? "")}</td>`;
      html += `</tr>`;
      html += pesajeBody;
    }

    html += `</tbody></table>`;
    tables.push(html);
  }

  // Leyenda de colores (solo roles usados, en orden oficial)
  const legendKeys = LEGEND_ORDER.filter((k) => usedRoleKeys.has(k));
  // añade cualquier rol usado no contemplado en LEGEND_ORDER
  for (const k of usedRoleKeys) {
    if (!legendKeys.includes(k as RoleKey)) legendKeys.push(k as RoleKey);
  }
  const legendChips = legendKeys
    .map((k) => {
      const st = styleFor(k);
      return `<span class="leg-chip" style="background:${st.bg};color:${st.fg}">${esc(st.label)}</span>`;
    })
    .join("");

  const fechaRange = comp.fecha === comp.fechaFin || !comp.fechaFin
    ? comp.fecha
    : `${comp.fecha} - ${comp.fechaFin}`;
  const hoy = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

  const body = tables.length > 0
    ? tables.join("\n")
    : `<p class="empty-note">Sin plantilla de tarima. Importa el horario o crea la plantilla antes de exportar el cuadrante.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<title>Cuadrante – ${esc(comp.nombre)}</title>
<style>
  /* margin:0 en @page elimina el encabezado/pie que el navegador imprime por
   * defecto (URL, fecha y título). El margen real del documento lo da el
   * padding del body. */
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9pt; color: #000; background: #fff; padding: 12mm 14mm; }

  /* ── Cabecera ─────────────────────────────── */
  .doc-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 4px; }
  .doc-header img { height: 56px; width: auto; }
  .doc-header-text { flex: 1; line-height: 1.25; }
  .doc-org { font-size: 11pt; font-weight: 700; color: #000; }
  .doc-title { font-size: 12pt; font-weight: 700; color: #000; }
  .doc-sub { font-size: 9.5pt; color: #000; }
  .doc-loc { font-size: 9.5pt; font-weight: 700; color: #1F4E79; }
  .doc-date { text-align: right; color: #C00000; font-weight: 700; font-size: 9.5pt; margin: 2px 0 14px; }

  /* ── Tabla cuadrante ──────────────────────── */
  .cuadrante { width: 100%; border-collapse: collapse; margin: 0 auto 18px; table-layout: fixed; border: 1.5px solid #000; }
  .cuadrante td { border: 1px solid #000; padding: 3px 4px; text-align: center; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; }
  .cell-day { font-weight: 700; font-size: 9.5pt; padding: 4px; background: #fff; }
  .cell-sess { font-weight: 700; font-size: 8pt; padding: 4px 3px; }
  .cell-sess .sess-n { display: block; }
  .cell-sess .sess-cat { display: block; font-weight: 700; }
  .cell-time { color: #C00000; font-weight: 700; font-size: 8.5pt; }
  .cell-name { font-weight: 700; font-size: 8.5pt; height: 19px; }
  .cell-gap { height: 14px; background: #fff; border-left: 1px solid #000; border-right: 1px solid #000; }

  /* ── Leyenda ──────────────────────────────── */
  .legend { display: flex; flex-wrap: wrap; gap: 0; justify-content: center; margin: 14px auto 10px; max-width: 80%; }
  .leg-chip { display: inline-block; min-width: 150px; text-align: center; font-weight: 700; font-size: 8.5pt; padding: 4px 8px; border: 1px solid #000; }

  /* ── Notas ────────────────────────────────── */
  .notes { margin: 10px auto; font-size: 8.5pt; font-weight: 700; text-align: center; line-height: 1.8; }
  .empty-note { padding: 24px; text-align: center; color: #777; font-size: 10pt; border: 1px dashed #ccc; border-radius: 8px; margin: 16px 0; }

  /* ── Footer + botón ───────────────────────── */
  .doc-footer { margin-top: 8px; text-align: center; font-size: 8pt; color: #555; }
  @media print { .no-print { display: none; } }
  .print-btn { position: fixed; top: 12px; right: 12px; padding: 8px 18px; background: #C00000; color: #fff; border: none; border-radius: 6px; font-size: 11pt; cursor: pointer; z-index: 999; }
  .print-btn:hover { background: #9c0000; }
</style>
</head>
<body>
<button class="print-btn no-print" onclick="window.print()">Imprimir / Guardar PDF</button>

<div class="doc-header">
  <img src="/assets/aep-mark.png" alt="AEP" onerror="this.style.display='none'"/>
  <div class="doc-header-text">
    <div class="doc-org">ASOCIACIÓN ESPAÑOLA de POWERLIFTING</div>
    <div class="doc-title">${esc(comp.nombre)}</div>
    <div class="doc-sub">${esc(comp.tipo)}</div>
    <div class="doc-loc">${esc(comp.sede)} - ${esc(fechaRange)}</div>
  </div>
</div>
<div class="doc-date">${esc(hoy)}</div>

${body}

${tables.length > 0 ? `<div class="legend">${legendChips}</div>
<div class="notes">
  <div>* &nbsp;Compartiendo funciones con otra Sesión</div>
  <div>↑↓ &nbsp;Intercambio de funciones según esté en el pesaje hombres o mujeres</div>
</div>` : ""}

<div class="doc-footer">Cuadrante oficial AEP · ${esc(comp.nombre)}</div>
${autoPrint ? `<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},250);});</script>` : ""}
</body>
</html>`;
}
