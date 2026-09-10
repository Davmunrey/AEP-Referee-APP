import { enumerateSlotKeys } from "@/lib/roster-template";
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
 * Lo que se imprime cuando el puesto SÍ está asignado pero el juez no aparece
 * en el censo: alguien lo borró después de designarlo.
 *
 * No es «VACÍO». En el acta oficial esa palabra dice que el puesto está por
 * cubrir, y aquí lo que pasa es lo contrario: está cubierto por alguien que ya
 * no consta.
 */
export const EXPORT_REF_NOT_FOUND = "— JUEZ NO ENCONTRADO EN EL CENSO";
export const EXPORT_SLOT_EMPTY = "— VACÍO";

function formatRefName(
  ref: ExportRef | undefined,
  slotKey: string,
  flags: FlagsMap,
  assigned = false,
): string {
  if (!ref) return assigned ? EXPORT_REF_NOT_FOUND : EXPORT_SLOT_EMPTY;
  const suffix: string[] = [];
  const f = flags[slotKey];
  if (f?.compartido) suffix.push("*");
  if (f?.intercambio) suffix.push("↑↓");
  const flagStr = suffix.length ? ` ${suffix.join(" ")}` : "";
  return `${ref.nombre} (${ref.nivel})${flagStr}`;
}

/**
 * Formatea el acta de plantilla de jueces en texto, replicando la estructura
 * oficial AEP: agrupado por día, cada sesión con sus categorías, horarios y
 * los bloques de competición y de pesaje.
 */
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
    `Campeonato: ${comp.nombre}`,
    `Tipo:   ${comp.tipo}`,
    `Fechas: ${comp.fecha} – ${comp.fechaFin}`,
    `Sede:   ${comp.sede}`,
  ];

  // Los puestos del acta son los huecos canónicos, los mismos que enumera
  // `enumerateSlotKeys` para la cobertura, el dinero y el cuadrante. El acta se
  // los construía por su cuenta recorriendo `slots`, y esa cuenta no quita
  // repetidos: dos filas del mismo rol en una sesión —o dos sesiones con el
  // mismo código— comparten las claves `${sesion}_${rol}_${índice}`, así que el
  // acta imprimía el puesto DOS VECES, con el mismo juez en las dos líneas,
  // mientras el cuadrante en Excel y en HTML lo imprimían una. Dos documentos
  // oficiales del mismo campeonato, cada uno con un número de puestos.
  //
  // El editor y la importación ya rechazan esas plantillas, pero nadie
  // normalizó las que se guardaron antes: siguen en `competitions.template`.
  const huecosValidos = new Set(enumerateSlotKeys(template));
  const yaImpresos = new Set<string>();

  const renderRoles = (
    sesion: string,
    roles: RosterSession["roles"],
  ): void => {
    for (const role of roles) {
      for (let i = 0; i < role.slots; i++) {
        const slotKey = `${sesion}_${role.key}_${i}`;
        if (!huecosValidos.has(slotKey) || yaImpresos.has(slotKey)) continue;
        yaImpresos.add(slotKey);
        const refId = assignments[slotKey];
        const ref = refId ? refLookup(refId) : undefined;
        const label = role.slots > 1 ? `${role.rol} ${i + 1}` : role.rol;
        lines.push(`   - ${label}: ${formatRefName(ref, slotKey, flags, Boolean(refId))}`);
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
