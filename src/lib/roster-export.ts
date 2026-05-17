import type { AssignmentsMap, FlagsMap, RosterSession } from "@/lib/types";

interface ExportComp {
  nombre: string;
  fecha: string;
  fechaFin: string;
  sede: string;
  tipo: string;
}

interface ExportRef {
  nombre: string;
  nivel: string;
}

/**
 * Formatea el acta de plantilla de jueces en texto, replicando la estructura
 * oficial AEP: agrupado por día, cada sesión con sus categorías, horarios y
 * los bloques de competición y de pesaje.
 */
function formatRefName(
  ref: ExportRef | undefined,
  slotKey: string,
  flags: FlagsMap,
): string {
  if (!ref) return "— VACÍO";
  const suffix: string[] = [];
  const f = flags[slotKey];
  if (f?.compartido) suffix.push("*");
  if (f?.intercambio) suffix.push("↑↓");
  const flagStr = suffix.length ? ` ${suffix.join(" ")}` : "";
  return `${ref.nombre} (${ref.nivel})${flagStr}`;
}

export function formatRosterExport(
  comp: ExportComp,
  template: RosterSession[],
  assignments: AssignmentsMap,
  refLookup: (id: string) => ExportRef | undefined,
  flags: FlagsMap = {},
): string {
  const lines: string[] = [
    "ASOCIACIÓN ESPAÑOLA DE POWERLIFTING",
    "Acta de plantilla de jueces",
    "",
    `Evento: ${comp.nombre}`,
    `Tipo:   ${comp.tipo}`,
    `Fechas: ${comp.fecha} – ${comp.fechaFin}`,
    `Sede:   ${comp.sede}`,
  ];

  const renderRoles = (
    sesion: string,
    roles: RosterSession["roles"],
  ): void => {
    for (const role of roles) {
      for (let i = 0; i < role.slots; i++) {
        const refId = assignments[`${sesion}_${role.key}_${i}`];
        const slotKey = `${sesion}_${role.key}_${i}`;
        const ref = refId ? refLookup(refId) : undefined;
        const label = role.slots > 1 ? `${role.rol} ${i + 1}` : role.rol;
        lines.push(`   - ${label}: ${formatRefName(ref, slotKey, flags)}`);
      }
    }
  };

  let currentDia = "";
  for (const s of template) {
    const dia = s.dia || "Sesiones";
    if (dia !== currentDia) {
      lines.push("", `═══  ${dia.toUpperCase()}  ═══`);
      currentDia = dia;
    }
    const cats = (s.categorias ?? [])
      .map((c) => `${c.genero} ${c.pesos}`)
      .join(" · ");
    lines.push("", `## ${s.sesion} · ${s.nombre}`);
    if (cats) lines.push(`   Categorías: ${cats}`);
    if (s.grupos && s.grupos.length > 0) {
      for (const g of s.grupos) {
        const gcats = g.categorias
          .map((c) => `${c.genero} ${c.pesos}`)
          .join(" · ");
        const lev = typeof g.levantadores === "number" ? ` (${g.levantadores} lev.)` : "";
        lines.push(`   ${g.nombre}: ${gcats}${lev}`);
      }
    }
    lines.push(`   Competición · ${s.horarioCompeticion}`);
    renderRoles(s.sesion, s.roles);

    const pesaje = s.pesajeRoles ?? [];
    if (pesaje.length > 0) {
      lines.push(`   Pesaje y revisión de equipamiento · ${s.horarioPesaje}`);
      renderRoles(s.sesion, pesaje);
    }
  }

  return lines.join("\n");
}
